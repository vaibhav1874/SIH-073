"""
SkyGuard AI - Isolation Forest Training Pipeline
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS

Trains unsupervised Isolation Forest ensemble on clean historical meteorological features.
Calibrates optimal decision threshold on validation split.
Saves model artifacts for real-time inference.
"""

import sys
import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, f1_score, precision_score, recall_score, roc_auc_score
import joblib

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.append(str(PROJECT_ROOT))

from ml.feature_engineering.features import FEATURE_NAMES

SPLITS_DIR = PROJECT_ROOT / "data" / "splits"
MODELS_DIR = PROJECT_ROOT / "ml" / "saved_models"
MODEL_FILE = MODELS_DIR / "isolation_forest.joblib"
SCALER_FILE = MODELS_DIR / "if_scaler.joblib"
METADATA_FILE = MODELS_DIR / "if_metadata.json"


def main():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    train_clean_file = SPLITS_DIR / "train_clean.csv"
    val_file = SPLITS_DIR / "val.csv"
    test_file = SPLITS_DIR / "test.csv"

    if not train_clean_file.exists() or not val_file.exists():
        print(f"Error: Required splits not found in {SPLITS_DIR}. Run ml/training/split.py first.")
        sys.exit(1)

    print(f"Loading clean training data from: {train_clean_file}")
    df_train = pd.read_csv(train_clean_file)
    X_train_raw = df_train[FEATURE_NAMES].to_numpy(dtype=np.float32)

    print(f"Fitting StandardScaler on {X_train_raw.shape[0]:,} training samples (40 features)...")
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train_raw)

    print("Training Isolation Forest (150 trees, max_samples=0.8, n_jobs=-1, seed=42)...")
    model = IsolationForest(
        n_estimators=150,
        contamination=0.06,
        max_samples=0.8,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train)

    print(f"Evaluating and calibrating decision threshold on validation set...")
    df_val = pd.read_csv(val_file)
    X_val = scaler.transform(df_val[FEATURE_NAMES].to_numpy(dtype=np.float32))
    y_val = df_val["is_anomaly"].to_numpy(dtype=int)

    # Raw anomaly score: more negative = more anomalous.
    # scikit-learn score_samples() outputs negative anomaly score where lower means abnormal.
    # Invert so higher score = higher anomaly likelihood [0.0, 1.0]
    raw_val_scores = -model.score_samples(X_val)

    # Search for threshold that maximizes F1 score on validation set
    thresholds = np.percentile(raw_val_scores, np.linspace(80, 99.5, 50))
    best_f1, best_thresh = -1.0, float(np.median(thresholds))

    for th in thresholds:
        preds = (raw_val_scores >= th).astype(int)
        f1 = f1_score(y_val, preds, zero_division=0)
        if f1 > best_f1:
            best_f1 = f1
            best_thresh = float(th)

    val_preds = (raw_val_scores >= best_thresh).astype(int)
    val_precision = precision_score(y_val, val_preds, zero_division=0)
    val_recall = recall_score(y_val, val_preds, zero_division=0)
    val_roc_auc = roc_auc_score(y_val, raw_val_scores)

    print(f"\nOptimal Threshold: {best_thresh:.4f}")
    print(f"Validation F1-Score:   {best_f1:.4f}")
    print(f"Validation Precision:  {val_precision:.4f}")
    print(f"Validation Recall:     {val_recall:.4f}")
    print(f"Validation ROC-AUC:    {val_roc_auc:.4f}")

    # Evaluate on out-of-sample test set
    df_test = pd.read_csv(test_file)
    X_test = scaler.transform(df_test[FEATURE_NAMES].to_numpy(dtype=np.float32))
    y_test = df_test["is_anomaly"].to_numpy(dtype=int)
    raw_test_scores = -model.score_samples(X_test)
    test_preds = (raw_test_scores >= best_thresh).astype(int)
    test_f1 = f1_score(y_test, test_preds, zero_division=0)
    test_precision = precision_score(y_test, test_preds, zero_division=0)
    test_recall = recall_score(y_test, test_preds, zero_division=0)
    test_roc_auc = roc_auc_score(y_test, raw_test_scores)

    print(f"\nTest Benchmark Performance:")
    print(f"Test F1-Score:   {test_f1:.4f}")
    print(f"Test Precision:  {test_precision:.4f}")
    print(f"Test Recall:     {test_recall:.4f}")
    print(f"Test ROC-AUC:    {test_roc_auc:.4f}")
    print("\nDetailed Test Classification Report:")
    print(classification_report(y_test, test_preds, target_names=["Normal", "Anomaly"]))

    # Save artifacts
    print(f"Saving model to {MODEL_FILE}...")
    joblib.dump(model, MODEL_FILE)
    print(f"Saving scaler to {SCALER_FILE}...")
    joblib.dump(scaler, SCALER_FILE)

    metadata = {
        "model_type": "IsolationForest",
        "feature_names": FEATURE_NAMES,
        "n_features": len(FEATURE_NAMES),
        "threshold": best_thresh,
        "score_min": float(raw_val_scores.min()),
        "score_max": float(raw_val_scores.max()),
        "validation_metrics": {
            "f1": float(best_f1),
            "precision": float(val_precision),
            "recall": float(val_recall),
            "roc_auc": float(val_roc_auc),
        },
        "test_metrics": {
            "f1": float(test_f1),
            "precision": float(test_precision),
            "recall": float(test_recall),
            "roc_auc": float(test_roc_auc),
        },
    }

    with open(METADATA_FILE, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"Saved metadata to {METADATA_FILE}")
    print("Isolation Forest training pipeline completed successfully!")


if __name__ == "__main__":
    main()
