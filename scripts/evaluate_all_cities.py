"""
SkyGuard AI - Multi-City Comprehensive Model Accuracy Evaluation
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS

Evaluates detection accuracy across all 7 cities:
1. Abohar (Punjab) - Ground Truth Test Split (23,161 samples, 1,701 labeled anomalies)
2. Delhi (National Capital) - Real Historical Weather + Fault Injection Benchmark
3. Jaipur (Rajasthan) - Real Historical Weather + Fault Injection Benchmark
4. Shimla (Himachal Pradesh) - Real Historical Weather + Fault Injection Benchmark
5. Mumbai (Maharashtra) - Real Historical Weather + Fault Injection Benchmark
6. Bengaluru (Karnataka) - Real Historical Weather + Fault Injection Benchmark
7. Bhopal (Madhya Pradesh) - Real Historical Weather + Fault Injection Benchmark

Evaluated Components per City:
- Isolation Forest (IF)
- PyTorch LSTM Autoencoder
- Physical Meteorological Rule-Based System
- SkyGuard Hybrid Ensemble (Weighted Fusion)
- XGBoost Multi-Class Root Cause Classifier
"""

import sys
import json
import time
from pathlib import Path
from typing import Dict, Any, List, Tuple

import numpy as np
import pandas as pd
import joblib
import torch
import torch.nn as nn
from sklearn.metrics import (
    precision_score, recall_score, f1_score, roc_auc_score,
    accuracy_score, confusion_matrix
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(PROJECT_ROOT))

from ml.feature_engineering.features import FEATURE_NAMES as ABOHAR_FEATURE_NAMES
from ml.training.train_lstm_autoencoder import LSTMAutoencoder, CORE_FEATURES, SEQUENCE_LENGTH
from scripts.train_all_cities import (
    compute_features, ALL_FEATURES as CITY_ALL_FEATURES,
    LSTMAutoencoder as CityLSTMAutoencoder
)

HISTORICAL_DIR = PROJECT_ROOT / "data" / "historical"
MODELS_DIR = PROJECT_ROOT / "ml" / "saved_models"
SPLITS_DIR = PROJECT_ROOT / "data" / "splits"
OUTPUT_FILE = PROJECT_ROOT / "data" / "metadata" / "all_cities_accuracy_benchmark.json"

ALL_CITIES = ["abohar", "delhi", "jaipur", "shimla", "mumbai", "bengaluru", "bhopal"]


def evaluate_rules(df: pd.DataFrame) -> np.ndarray:
    """Meteorological physical rules & step bounds."""
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


def calc_metrics(y_true: np.ndarray, y_pred: np.ndarray, scores: np.ndarray = None) -> Dict[str, Any]:
    """Calculates standard classification metrics."""
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    prec = precision_score(y_true, y_pred, zero_division=0)
    rec = recall_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)
    acc = accuracy_score(y_true, y_pred)
    fpr = float(fp / (fp + tn)) if (fp + tn) > 0 else 0.0

    auc = None
    if scores is not None and len(np.unique(y_true)) > 1:
        try:
            auc = float(roc_auc_score(y_true, scores))
        except Exception:
            auc = None

    return {
        "accuracy": round(float(acc), 4),
        "precision": round(float(prec), 4),
        "recall": round(float(rec), 4),
        "f1_score": round(float(f1), 4),
        "roc_auc": round(auc, 4) if auc is not None else "N/A",
        "fpr": round(float(fpr), 4),
        "true_positives": int(tp),
        "false_positives": int(fp),
        "false_negatives": int(fn),
        "true_negatives": int(tn),
        "support_total": int(len(y_true)),
        "anomalies_count": int(np.sum(y_true)),
    }


def evaluate_abohar() -> Dict[str, Any]:
    """Evaluates Abohar models on the official ground-truth test split."""
    test_path = SPLITS_DIR / "test.csv"
    if not test_path.exists():
        return {"error": "Abohar test.csv split not found"}

    df_test = pd.read_csv(test_path)
    y_true_full = df_test["is_anomaly"].to_numpy(dtype=int)

    city_dir = MODELS_DIR / "abohar"
    if not city_dir.exists():
        city_dir = MODELS_DIR

    results = {}

    # 1. Rule-Based
    rule_preds = evaluate_rules(df_test)
    results["RuleBased"] = calc_metrics(y_true_full, rule_preds)

    # 2. Isolation Forest
    if_path = city_dir / "isolation_forest.joblib"
    if_scaler_path = city_dir / "if_scaler.joblib"
    if_meta_path = city_dir / "if_metadata.json"

    if if_path.exists() and if_scaler_path.exists() and if_meta_path.exists():
        if_model = joblib.load(if_path)
        if_scaler = joblib.load(if_scaler_path)
        with open(if_meta_path, "r") as f:
            if_meta = json.load(f)
        threshold = if_meta.get("threshold", 0.5081)
        feat_names = if_meta.get("feature_names", ABOHAR_FEATURE_NAMES)

        X = df_test[feat_names].to_numpy(dtype=np.float32)
        X_scaled = if_scaler.transform(X)
        raw_scores = -if_model.score_samples(X_scaled)
        if_preds = (raw_scores >= threshold).astype(int)
        results["IsolationForest"] = calc_metrics(y_true_full, if_preds, raw_scores)
    else:
        results["IsolationForest"] = {"status": "Model files missing"}

    # 3. LSTM Autoencoder
    lstm_path = city_dir / "lstm_autoencoder.pt"
    lstm_scaler_path = city_dir / "lstm_scaler.joblib"
    lstm_meta_path = city_dir / "lstm_metadata.json"

    y_true_seq = y_true_full[SEQUENCE_LENGTH - 1 :]

    if lstm_path.exists() and lstm_scaler_path.exists() and lstm_meta_path.exists():
        with open(lstm_meta_path, "r") as f:
            lstm_meta = json.load(f)
        lstm_thresh = lstm_meta.get("threshold", 0.5838)
        lstm_scaler = joblib.load(lstm_scaler_path)

        lstm_model = LSTMAutoencoder(n_features=len(CORE_FEATURES), hidden_dim=32, num_layers=1)
        lstm_model.load_state_dict(torch.load(lstm_path, map_location="cpu"))
        lstm_model.eval()

        X_lstm = lstm_scaler.transform(df_test[CORE_FEATURES].to_numpy(dtype=np.float32))
        # Build sequences
        seqs = np.array([X_lstm[i : i + SEQUENCE_LENGTH] for i in range(len(X_lstm) - SEQUENCE_LENGTH + 1)])
        with torch.no_grad():
            t_seqs = torch.tensor(seqs, dtype=torch.float32)
            recon = lstm_model(t_seqs)
            lstm_errors = torch.mean((recon[:, -1, :] - t_seqs[:, -1, :]) ** 2, dim=1).numpy()

        lstm_preds = (lstm_errors >= lstm_thresh).astype(int)
        results["LSTMAutoencoder"] = calc_metrics(y_true_seq, lstm_preds, lstm_errors)
    else:
        results["LSTMAutoencoder"] = {"status": "Model files missing"}

    # 4. Hybrid Ensemble
    if "IsolationForest" in results and "LSTMAutoencoder" in results and "accuracy" in results["IsolationForest"]:
        r_preds_sub = rule_preds[SEQUENCE_LENGTH - 1 :]
        if_preds_sub = if_preds[SEQUENCE_LENGTH - 1 :]
        r_score = r_preds_sub.astype(float)

        if_min, if_max = raw_scores.min(), raw_scores.max()
        if_norm = (raw_scores[SEQUENCE_LENGTH - 1 :] - if_min) / (if_max - if_min + 1e-6)
        lstm_norm = np.clip(lstm_errors / (lstm_thresh * 2.0 + 1e-6), 0.0, 1.0)

        ensemble_score = 0.35 * r_score + 0.35 * if_norm + 0.30 * lstm_norm
        ensemble_preds = (ensemble_score >= 0.40).astype(int)
        results["SkyGuardHybrid"] = calc_metrics(y_true_seq, ensemble_preds, ensemble_score)

    # 5. XGBoost Root Cause Classifier
    xgb_path = city_dir / "root_cause_xgb.joblib"
    enc_path = city_dir / "label_encoder.joblib"
    if xgb_path.exists() and enc_path.exists() and "anomaly_type" in df_test.columns:
        xgb_model = joblib.load(xgb_path)
        enc = joblib.load(enc_path)
        y_type = df_test["anomaly_type"].to_numpy()
        # Evaluate XGBoost on full test set and on anomaly subsets
        X_xgb = df_test[ABOHAR_FEATURE_NAMES].to_numpy(dtype=np.float32)
        y_test_encoded = enc.transform(df_test["anomaly_type"].fillna("normal"))
        y_pred_all_encoded = xgb_model.predict(X_xgb)
        overall_acc = float(accuracy_score(y_test_encoded, y_pred_all_encoded))
        overall_f1_macro = float(f1_score(y_test_encoded, y_pred_all_encoded, average="macro", zero_division=0))
        overall_f1_weighted = float(f1_score(y_test_encoded, y_pred_all_encoded, average="weighted", zero_division=0))

        # Subset with anomalies only
        anom_mask = (y_true_full == 1)
        anom_acc = float(accuracy_score(y_test_encoded[anom_mask], y_pred_all_encoded[anom_mask])) if np.sum(anom_mask) > 0 else 0.0

        results["RootCauseClassifier"] = {
            "overall_test_accuracy": round(overall_acc, 4),
            "macro_f1": round(overall_f1_macro, 4),
            "weighted_f1": round(overall_f1_weighted, 4),
            "anomaly_subset_accuracy": round(anom_acc, 4),
            "total_samples_evaluated": int(len(df_test)),
            "fault_samples_evaluated": int(np.sum(anom_mask)),
            "num_classes": len(enc.classes_),
            "classes": list(enc.classes_),
        }

    return results


def inject_synthetic_faults(df_in: pd.DataFrame, seed: int = 42) -> Tuple[pd.DataFrame, np.ndarray, np.ndarray]:
    """
    Injects realistic meteorological faults into a slice of weather data:
    Spikes, sensor drifts, frozen values, communication dropouts, multivariate anomalies.
    Returns: modified df, binary y_true (0/1), and string fault_labels.
    """
    np.random.seed(seed)
    df = df_in.copy().reset_index(drop=True)
    n = len(df)
    y_true = np.zeros(n, dtype=int)
    fault_labels = np.array(["normal"] * n, dtype=object)

    # 7% anomaly target
    target_anomalies = max(20, int(n * 0.07))
    injected = 0
    step = 40  # spacing between episodes

    for start_idx in range(20, n - 40, step):
        if injected >= target_anomalies:
            break

        fault_choice = np.random.choice([
            "temperature_spike", "humidity_spike", "pressure_spike",
            "frozen_sensor", "sensor_drift", "communication_failure", "multivariate_inconsistency"
        ])

        if fault_choice == "temperature_spike":
            dur = np.random.randint(1, 4)
            mag = np.random.choice([+12.0, +16.0, -14.0])
            for k in range(dur):
                idx = start_idx + k
                if idx < n:
                    df.at[idx, "temperature"] += mag
                    y_true[idx] = 1
                    fault_labels[idx] = "temperature_spike"
                    injected += 1

        elif fault_choice == "humidity_spike":
            dur = np.random.randint(1, 4)
            for k in range(dur):
                idx = start_idx + k
                if idx < n:
                    df.at[idx, "humidity"] = 100.0 if np.random.rand() > 0.5 else 5.0
                    y_true[idx] = 1
                    fault_labels[idx] = "humidity_spike"
                    injected += 1

        elif fault_choice == "pressure_spike":
            dur = np.random.randint(1, 3)
            mag = np.random.choice([+25.0, -25.0])
            for k in range(dur):
                idx = start_idx + k
                if idx < n:
                    df.at[idx, "pressure"] += mag
                    y_true[idx] = 1
                    fault_labels[idx] = "pressure_spike"
                    injected += 1

        elif fault_choice == "frozen_sensor":
            dur = np.random.randint(6, 15)
            frozen_val = df.at[start_idx, "temperature"]
            for k in range(dur):
                idx = start_idx + k
                if idx < n:
                    df.at[idx, "temperature"] = frozen_val
                    y_true[idx] = 1
                    fault_labels[idx] = "frozen_sensor"
                    injected += 1

        elif fault_choice == "sensor_drift":
            dur = np.random.randint(8, 20)
            drift_rate = 0.8
            for k in range(dur):
                idx = start_idx + k
                if idx < n:
                    df.at[idx, "temperature"] += drift_rate * (k + 1)
                    y_true[idx] = 1
                    fault_labels[idx] = "sensor_drift"
                    injected += 1

        elif fault_choice == "communication_failure":
            dur = np.random.randint(2, 6)
            for k in range(dur):
                idx = start_idx + k
                if idx < n:
                    df.at[idx, "temperature"] = -99.0
                    df.at[idx, "humidity"] = 0.0
                    df.at[idx, "pressure"] = 0.0
                    y_true[idx] = 1
                    fault_labels[idx] = "communication_failure"
                    injected += 1

        elif fault_choice == "multivariate_inconsistency":
            dur = np.random.randint(2, 5)
            for k in range(dur):
                idx = start_idx + k
                if idx < n:
                    df.at[idx, "temperature"] = 46.0  # Extreme heat
                    df.at[idx, "humidity"] = 98.0     # Extreme humidity (impossible dewpoint spread)
                    y_true[idx] = 1
                    fault_labels[idx] = "multivariate_inconsistency"
                    injected += 1

    return df, y_true, fault_labels


def evaluate_city(city: str) -> Dict[str, Any]:
    """Evaluates a specific city's models on clean nominal test data + fault injection benchmark."""
    csv_path = HISTORICAL_DIR / f"{city}_historical.csv"
    if not csv_path.exists():
        return {"error": f"No historical dataset found for {city}"}

    city_dir = MODELS_DIR / city
    if not city_dir.exists():
        return {"error": f"No models directory found for {city}"}

    df_raw = pd.read_csv(csv_path)
    df_raw["timestamp"] = pd.to_datetime(df_raw["timestamp"])
    df_raw = df_raw.sort_values("timestamp").reset_index(drop=True)

    # Held-out test set: last 20% of historical series (unseen during training)
    split_idx = int(len(df_raw) * 0.80)
    df_test_clean = df_raw.iloc[split_idx:].reset_index(drop=True)

    # 1. Clean Operational Stability Check
    df_clean_feat = compute_features(df_test_clean)

    # Load Isolation Forest
    if_path = city_dir / "isolation_forest.joblib"
    if_scaler_path = city_dir / "if_scaler.joblib"
    if_meta_path = city_dir / "if_metadata.json"

    if_model = joblib.load(if_path)
    if_scaler = joblib.load(if_scaler_path)
    with open(if_meta_path, "r") as f:
        if_meta = json.load(f)
    if_thresh = if_meta.get("threshold", 0.50)
    if_cols = if_meta.get("feature_names", CITY_ALL_FEATURES)

    X_clean = df_clean_feat[if_cols].to_numpy(dtype=np.float32)
    X_clean_scaled = if_scaler.transform(X_clean)
    raw_scores_clean = -if_model.score_samples(X_clean_scaled)
    clean_flags_if = (raw_scores_clean >= if_thresh).astype(int)
    if_clean_pass_rate = round(float(1.0 - np.mean(clean_flags_if)) * 100, 2)

    # Load LSTM Autoencoder
    lstm_path = city_dir / "lstm_autoencoder.pt"
    lstm_scaler_path = city_dir / "lstm_scaler.joblib"
    lstm_meta_path = city_dir / "lstm_metadata.json"

    with open(lstm_meta_path, "r") as f:
        lstm_meta = json.load(f)
    lstm_thresh = lstm_meta.get("threshold", 0.50)
    n_feat = lstm_meta.get("n_features", 6)
    lstm_cols = lstm_meta.get("feature_names", ["temperature", "humidity", "pressure", "temp_diff_1", "humidity_diff_1", "pressure_diff_1"])

    lstm_scaler = joblib.load(lstm_scaler_path)
    lstm_model = CityLSTMAutoencoder(n_features=n_feat, hidden_dim=32, n_layers=1)
    lstm_model.load_state_dict(torch.load(lstm_path, map_location="cpu"))
    lstm_model.eval()

    X_lstm_clean = lstm_scaler.transform(df_clean_feat[lstm_cols].to_numpy(dtype=np.float32))
    seqs_clean = np.array([X_lstm_clean[i : i + SEQUENCE_LENGTH] for i in range(len(X_lstm_clean) - SEQUENCE_LENGTH + 1)])
    with torch.no_grad():
        t_seqs_clean = torch.tensor(seqs_clean, dtype=torch.float32)
        recon_clean = lstm_model(t_seqs_clean)
        lstm_errors_clean = torch.mean((recon_clean - t_seqs_clean) ** 2, dim=(1, 2)).numpy()

    clean_flags_lstm = (lstm_errors_clean >= lstm_thresh).astype(int)
    lstm_clean_pass_rate = round(float(1.0 - np.mean(clean_flags_lstm)) * 100, 2)

    nominal_stability = {
        "test_records_evaluated": len(df_clean_feat),
        "if_threshold": round(float(if_thresh), 4),
        "if_clean_pass_rate_pct": if_clean_pass_rate,
        "if_false_alarm_rate_pct": round(100.0 - if_clean_pass_rate, 2),
        "lstm_threshold": round(float(lstm_thresh), 4),
        "lstm_clean_pass_rate_pct": lstm_clean_pass_rate,
        "lstm_false_alarm_rate_pct": round(100.0 - lstm_clean_pass_rate, 2),
    }

    # 2. Synthetic Fault Injection Stress Test (Empirical Ground-Truth Verification)
    df_injected, y_true_full, fault_labels = inject_synthetic_faults(df_test_clean, seed=42)
    df_inj_feat = compute_features(df_injected)

    # Sub-slice targets matching features length after diffs/drop
    y_true_full = y_true_full[:len(df_inj_feat)]

    # Rule-based on injected
    rule_preds = evaluate_rules(df_inj_feat)
    rule_metrics = calc_metrics(y_true_full, rule_preds)

    # IF on injected
    X_inj = df_inj_feat[if_cols].to_numpy(dtype=np.float32)
    X_inj_scaled = if_scaler.transform(X_inj)
    raw_scores_inj = -if_model.score_samples(X_inj_scaled)
    if_preds_inj = (raw_scores_inj >= if_thresh).astype(int)
    if_metrics = calc_metrics(y_true_full, if_preds_inj, raw_scores_inj)

    # LSTM on injected
    y_true_seq = y_true_full[SEQUENCE_LENGTH - 1 :]
    X_lstm_inj = lstm_scaler.transform(df_inj_feat[lstm_cols].to_numpy(dtype=np.float32))
    seqs_inj = np.array([X_lstm_inj[i : i + SEQUENCE_LENGTH] for i in range(len(X_lstm_inj) - SEQUENCE_LENGTH + 1)])
    with torch.no_grad():
        t_seqs_inj = torch.tensor(seqs_inj, dtype=torch.float32)
        recon_inj = lstm_model(t_seqs_inj)
        lstm_errors_inj = torch.mean((recon_inj - t_seqs_inj) ** 2, dim=(1, 2)).numpy()

    lstm_preds_inj = (lstm_errors_inj >= lstm_thresh).astype(int)
    lstm_metrics = calc_metrics(y_true_seq, lstm_preds_inj, lstm_errors_inj)

    # SkyGuard Hybrid Ensemble
    r_preds_sub = rule_preds[SEQUENCE_LENGTH - 1 :]
    if_min, if_max = raw_scores_inj.min(), raw_scores_inj.max()
    if_norm = (raw_scores_inj[SEQUENCE_LENGTH - 1 :] - if_min) / (if_max - if_min + 1e-6)
    lstm_norm = np.clip(lstm_errors_inj / (lstm_thresh * 2.0 + 1e-6), 0.0, 1.0)
    ensemble_score = 0.35 * r_preds_sub.astype(float) + 0.35 * if_norm + 0.30 * lstm_norm
    ensemble_preds = (ensemble_score >= 0.40).astype(int)
    hybrid_metrics = calc_metrics(y_true_seq, ensemble_preds, ensemble_score)

    return {
        "nominal_stability": nominal_stability,
        "fault_injection_benchmark": {
            "RuleBased": rule_metrics,
            "IsolationForest": if_metrics,
            "LSTMAutoencoder": lstm_metrics,
            "SkyGuardHybrid": hybrid_metrics,
        }
    }


def main():
    print("=" * 88)
    print(" SKYGUARD AI - MULTI-CITY MODEL ACCURACY & PERFORMANCE BENCHMARK")
    print(" SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS")
    print("=" * 88)

    all_results = {}

    for city in ALL_CITIES:
        print(f"\n[Evaluating {city.upper()} Models]...")
        t0 = time.perf_counter()
        if city == "abohar":
            res = evaluate_abohar()
        else:
            res = evaluate_city(city)
        elapsed = time.perf_counter() - t0
        all_results[city] = res
        print(f"✓ Completed {city.upper()} evaluation in {elapsed:.2f}s")

    # Save to JSON
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2)
    print(f"\nSaved detailed results to: {OUTPUT_FILE}")

    # Print Abohar Summary Table
    print("\n" + "=" * 88)
    print(" 1. ABOHAR (PUNJAB) - GROUND TRUTH TEST SET ACCURACY (23,161 SAMPLES)")
    print("=" * 88)
    print(f"{'Component / Model':<28s} | {'Accuracy':<9s} | {'Precision':<10s} | {'Recall':<9s} | {'F1-Score':<9s} | {'ROC-AUC':<9s}")
    print("-" * 88)
    abohar_res = all_results.get("abohar", {})
    for k in ["RuleBased", "IsolationForest", "LSTMAutoencoder", "SkyGuardHybrid"]:
        m = abohar_res.get(k, {})
        if "accuracy" in m:
            auc_str = f"{m['roc_auc']:.4f}" if isinstance(m['roc_auc'], (int, float)) else str(m['roc_auc'])
            print(f"{k:<28s} | {m['accuracy']:<9.4f} | {m['precision']:<10.4f} | {m['recall']:<9.4f} | {m['f1_score']:<9.4f} | {auc_str:<9s}")
    if "RootCauseClassifier" in abohar_res:
        rc = abohar_res["RootCauseClassifier"]
        print("-" * 88)
        print(f"XGBoost Root Cause Classifier: Overall Accuracy={rc['overall_test_accuracy']*100:.2f}%, Macro F1={rc['macro_f1']:.4f}, Anomaly Recall={rc['anomaly_subset_accuracy']*100:.2f}% across {rc['num_classes']} classes")

    # Print Multi-City Summary Table
    print("\n" + "=" * 88)
    print(" 2. MULTI-CITY FAULT DETECTION & STABILITY BENCHMARK (NEW CITIES)")
    print("=" * 88)
    print(f"{'City':<12s} | {'Clean Pass %':<12s} | {'IF Recall':<10s} | {'IF F1':<8s} | {'LSTM Recall':<12s} | {'LSTM F1':<8s} | {'Hybrid F1':<9s}")
    print("-" * 88)
    for city in ALL_CITIES[1:]:
        c_res = all_results.get(city, {})
        if "nominal_stability" in c_res:
            nom = c_res["nominal_stability"]
            bm = c_res.get("fault_injection_benchmark", {})
            if_m = bm.get("IsolationForest", {})
            lstm_m = bm.get("LSTMAutoencoder", {})
            hy_m = bm.get("SkyGuardHybrid", {})

            clean_pass = f"{nom['if_clean_pass_rate_pct']}%"
            if_rec = f"{if_m.get('recall', 0):.4f}"
            if_f1 = f"{if_m.get('f1_score', 0):.4f}"
            lstm_rec = f"{lstm_m.get('recall', 0):.4f}"
            lstm_f1 = f"{lstm_m.get('f1_score', 0):.4f}"
            hy_f1 = f"{hy_m.get('f1_score', 0):.4f}"

            print(f"{city.capitalize():<12s} | {clean_pass:<12s} | {if_rec:<10s} | {if_f1:<8s} | {lstm_rec:<12s} | {lstm_f1:<8s} | {hy_f1:<9s}")
    print("=" * 88)


if __name__ == "__main__":
    main()
