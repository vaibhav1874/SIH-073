"""
SkyGuard AI - Multi-Model Benchmark & Comparative Evaluation
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS

Benchmarks:
1. Physical Rule-Based Detector
2. Isolation Forest (Unsupervised tree ensemble)
3. PyTorch LSTM Autoencoder (Deep temporal reconstruction)
4. SkyGuard Hybrid Ensemble (Weighted fusion: Rule + IF + LSTM)

Generates comparative metrics:
- Precision, Recall, F1-Score
- False Positive Rate (FPR)
- Detection Latency per reading (milliseconds)
- Sensor-specific accuracy breakdown
Outputs: data/metadata/benchmark_comparison.json
"""

import sys
import time
import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.metrics import precision_score, recall_score, f1_score, confusion_matrix
import joblib
import torch
import torch.nn as nn

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.append(str(PROJECT_ROOT))

from ml.feature_engineering.features import FEATURE_NAMES
from ml.training.train_lstm_autoencoder import LSTMAutoencoder, CORE_FEATURES, SEQUENCE_LENGTH, create_sequences

SPLITS_DIR = PROJECT_ROOT / "data" / "splits"
MODELS_DIR = PROJECT_ROOT / "ml" / "saved_models"
BENCHMARK_OUTPUT = PROJECT_ROOT / "data" / "metadata" / "benchmark_comparison.json"


def evaluate_rules(df: pd.DataFrame) -> np.ndarray:
    """Evaluates rule-based physical plausibility and step change detection."""
    temp = df["temperature"].to_numpy()
    hum = df["humidity"].to_numpy()
    pres = df["pressure"].to_numpy()

    temp_diff = np.abs(df["temp_diff_1"].to_numpy())
    hum_diff = np.abs(df["humidity_diff_1"].to_numpy())
    pres_diff = np.abs(df["pressure_diff_1"].to_numpy())

    rule_preds = (
        (temp < -10.0) | (temp > 55.0) |
        (hum < 0.0) | (hum > 100.0) |
        (pres < 900.0) | (pres > 1080.0) |
        (temp_diff > 8.0) |
        (hum_diff > 35.0) |
        (pres_diff > 12.0) |
        ((temp > 42.0) & (hum > 85.0))
    ).astype(int)
    return rule_preds


def main():
    test_file = SPLITS_DIR / "test.csv"
    if not test_file.exists():
        print(f"Error: Test split not found at {test_file}")
        sys.exit(1)

    print(f"Loading test split from: {test_file}")
    df_test = pd.read_csv(test_file)
    y_test_full = df_test["is_anomaly"].to_numpy(dtype=int)

    results = {}

    # 1. Rule-Based Evaluation
    print("\n[1/4] Evaluating Physical Rule-Based Detector...")
    t0 = time.perf_counter()
    rule_preds = evaluate_rules(df_test)
    t_rule = (time.perf_counter() - t0) / len(df_test) * 1000.0  # ms per sample

    tn, fp, fn, tp = confusion_matrix(y_test_full, rule_preds).ravel()
    results["RuleBased"] = {
        "name": "Rule-Based Expert System",
        "precision": float(precision_score(y_test_full, rule_preds, zero_division=0)),
        "recall": float(recall_score(y_test_full, rule_preds, zero_division=0)),
        "f1_score": float(f1_score(y_test_full, rule_preds, zero_division=0)),
        "fpr": float(fp / (fp + tn)),
        "latency_ms": round(t_rule, 4),
        "true_positives": int(tp),
        "false_positives": int(fp),
        "false_negatives": int(fn),
    }

    # 2. Isolation Forest Evaluation
    if_path = MODELS_DIR / "isolation_forest.joblib"
    if_scaler_path = MODELS_DIR / "if_scaler.joblib"
    if_meta_path = MODELS_DIR / "if_metadata.json"

    if if_path.exists() and if_scaler_path.exists() and if_meta_path.exists():
        print("\n[2/4] Evaluating Isolation Forest Ensemble...")
        if_model = joblib.load(if_path)
        if_scaler = joblib.load(if_scaler_path)
        with open(if_meta_path, "r") as f:
            if_meta = json.load(f)
        if_threshold = if_meta["threshold"]

        t0 = time.perf_counter()
        X_test_scaled = if_scaler.transform(df_test[FEATURE_NAMES].to_numpy(dtype=np.float32))
        raw_scores = -if_model.score_samples(X_test_scaled)
        if_preds = (raw_scores >= if_threshold).astype(int)
        t_if = (time.perf_counter() - t0) / len(df_test) * 1000.0

        tn, fp, fn, tp = confusion_matrix(y_test_full, if_preds).ravel()
        results["IsolationForest"] = {
            "name": "Isolation Forest (40 features)",
            "precision": float(precision_score(y_test_full, if_preds, zero_division=0)),
            "recall": float(recall_score(y_test_full, if_preds, zero_division=0)),
            "f1_score": float(f1_score(y_test_full, if_preds, zero_division=0)),
            "fpr": float(fp / (fp + tn)),
            "latency_ms": round(t_if, 4),
            "true_positives": int(tp),
            "false_positives": int(fp),
            "false_negatives": int(fn),
        }
    else:
        print("Warning: Isolation forest artifacts not found, skipping IF evaluation.")

    # 3. LSTM Autoencoder Evaluation
    lstm_path = MODELS_DIR / "lstm_autoencoder.pt"
    lstm_scaler_path = MODELS_DIR / "lstm_scaler.joblib"
    lstm_meta_path = MODELS_DIR / "lstm_metadata.json"

    # Align sequence target for sequence models
    y_test_seq = y_test_full[SEQUENCE_LENGTH - 1 :]

    if lstm_path.exists() and lstm_scaler_path.exists() and lstm_meta_path.exists():
        print("\n[3/4] Evaluating PyTorch LSTM Autoencoder...")
        device = torch.device("cpu")
        lstm_scaler = joblib.load(lstm_scaler_path)
        with open(lstm_meta_path, "r") as f:
            lstm_meta = json.load(f)
        lstm_thresh = lstm_meta["threshold"]

        model = LSTMAutoencoder(n_features=len(CORE_FEATURES), hidden_dim=32)
        model.load_state_dict(torch.load(lstm_path, map_location=device))
        model.eval()

        t0 = time.perf_counter()
        X_test_lstm = lstm_scaler.transform(df_test[CORE_FEATURES].to_numpy(dtype=np.float32))
        test_seqs = create_sequences(X_test_lstm, SEQUENCE_LENGTH)
        with torch.no_grad():
            t_seqs = torch.tensor(test_seqs, dtype=torch.float32)
            recon = model(t_seqs)
            lstm_errors = torch.mean((recon[:, -1, :] - t_seqs[:, -1, :]) ** 2, dim=1).numpy()
        lstm_preds = (lstm_errors >= lstm_thresh).astype(int)
        t_lstm = (time.perf_counter() - t0) / len(test_seqs) * 1000.0

        tn, fp, fn, tp = confusion_matrix(y_test_seq, lstm_preds).ravel()
        results["LSTMAutoencoder"] = {
            "name": "LSTM Autoencoder (Deep Temporal)",
            "precision": float(precision_score(y_test_seq, lstm_preds, zero_division=0)),
            "recall": float(recall_score(y_test_seq, lstm_preds, zero_division=0)),
            "f1_score": float(f1_score(y_test_seq, lstm_preds, zero_division=0)),
            "fpr": float(fp / (fp + tn)),
            "latency_ms": round(t_lstm, 4),
            "true_positives": int(tp),
            "false_positives": int(fp),
            "false_negatives": int(fn),
        }

    # 4. Hybrid Ensemble Evaluation
    if "IsolationForest" in results and "LSTMAutoencoder" in results:
        print("\n[4/4] Evaluating SkyGuard Hybrid Ensemble (Rules + IF + LSTM)...")
        # Sub-slice aligned with sequence length
        r_preds_sub = rule_preds[SEQUENCE_LENGTH - 1 :]
        if_preds_sub = if_preds[SEQUENCE_LENGTH - 1 :]

        # Normalize scores to [0, 1] probability range
        r_score = r_preds_sub.astype(float)

        if_min, if_max = raw_scores.min(), raw_scores.max()
        if_norm = (raw_scores[SEQUENCE_LENGTH - 1 :] - if_min) / (if_max - if_min + 1e-6)

        lstm_norm = np.clip(lstm_errors / (lstm_thresh * 2.0 + 1e-6), 0.0, 1.0)

        # Weighted blend: Rules 35% + IF 35% + LSTM 30%
        ensemble_score = 0.35 * r_score + 0.35 * if_norm + 0.30 * lstm_norm
        ensemble_preds = (ensemble_score >= 0.40).astype(int)

        t_hybrid = results["RuleBased"]["latency_ms"] + results["IsolationForest"]["latency_ms"] + results["LSTMAutoencoder"]["latency_ms"]
        tn, fp, fn, tp = confusion_matrix(y_test_seq, ensemble_preds).ravel()
        results["SkyGuardHybrid"] = {
            "name": "SkyGuard Hybrid Ensemble (Rules + IF + LSTM)",
            "precision": float(precision_score(y_test_seq, ensemble_preds, zero_division=0)),
            "recall": float(recall_score(y_test_seq, ensemble_preds, zero_division=0)),
            "f1_score": float(f1_score(y_test_seq, ensemble_preds, zero_division=0)),
            "fpr": float(fp / (fp + tn)),
            "latency_ms": round(t_hybrid, 4),
            "true_positives": int(tp),
            "false_positives": int(fp),
            "false_negatives": int(fn),
        }

    BENCHMARK_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(BENCHMARK_OUTPUT, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nSaved benchmark results to {BENCHMARK_OUTPUT}")
    print("\n" + "=" * 80)
    print(f"{'Model':<35s} | {'Precision':<9s} | {'Recall':<9s} | {'F1-Score':<9s} | {'FPR':<7s} | {'Latency'}")
    print("=" * 80)
    for k, v in results.items():
        print(f"{v['name']:<35s} | {v['precision']:<9.4f} | {v['recall']:<9.4f} | {v['f1_score']:<9.4f} | {v['fpr']:<7.4f} | {v['latency_ms']:.3f} ms")
    print("=" * 80)


if __name__ == "__main__":
    main()
