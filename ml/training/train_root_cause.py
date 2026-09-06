"""
SkyGuard AI - Root Cause Diagnostic Classifier (XGBoost)
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS

Multi-class XGBoost classifier predicting root-cause diagnosis across 8 classes:
- normal
- temperature_spike
- humidity_spike
- pressure_spike
- frozen_sensor
- sensor_drift
- communication_failure
- multivariate_inconsistency

Saves:
- ml/saved_models/root_cause_xgb.joblib
- ml/saved_models/label_encoder.joblib
- ml/saved_models/root_cause_metadata.json
"""

import sys
import json
from pathlib import Path
import numpy as np
import pandas as pd
from xgboost import XGBClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, accuracy_score, f1_score
import joblib

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.append(str(PROJECT_ROOT))

from ml.feature_engineering.features import FEATURE_NAMES

SPLITS_DIR = PROJECT_ROOT / "data" / "splits"
MODELS_DIR = PROJECT_ROOT / "ml" / "saved_models"
MODEL_FILE = MODELS_DIR / "root_cause_xgb.joblib"
ENCODER_FILE = MODELS_DIR / "label_encoder.joblib"
METADATA_FILE = MODELS_DIR / "root_cause_metadata.json"


def main():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    train_file = SPLITS_DIR / "train.csv"
    val_file = SPLITS_DIR / "val.csv"
    test_file = SPLITS_DIR / "test.csv"

    if not train_file.exists() or not val_file.exists():
        print(f"Error: Required splits not found in {SPLITS_DIR}. Run ml/training/split.py first.")
        sys.exit(1)

    print(f"Loading training split from: {train_file}")
    df_train = pd.read_csv(train_file)
    X_train = df_train[FEATURE_NAMES].to_numpy(dtype=np.float32)

    label_encoder = LabelEncoder()
    y_train = label_encoder.fit_transform(df_train["anomaly_type"].fillna("normal"))
    class_names = list(label_encoder.classes_)
    print(f"Target classes ({len(class_names)}): {class_names}")

    df_val = pd.read_csv(val_file)
    X_val = df_val[FEATURE_NAMES].to_numpy(dtype=np.float32)
    y_val = label_encoder.transform(df_val["anomaly_type"].fillna("normal"))

    # Compute class weights or sample weights to balance the minority anomaly classes
    classes, counts = np.unique(y_train, return_counts=True)
    total_samples = len(y_train)
    weights = {c: total_samples / (len(classes) * cnt) for c, cnt in zip(classes, counts)}
    sample_weight = np.array([weights[y] for y in y_train])

    print("Training multi-class XGBoost model (objective='multi:softprob', max_depth=6, n_estimators=100)...")
    clf = XGBClassifier(
        n_estimators=100,
        max_depth=6,
        learning_rate=0.1,
        objective="multi:softprob",
        num_class=len(class_names),
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        tree_method="hist",
        n_jobs=-1,
    )
    clf.fit(X_train, y_train, sample_weight=sample_weight, eval_set=[(X_val, y_val)], verbose=False)

    # Evaluate on validation
    val_preds = clf.predict(X_val)
    val_acc = accuracy_score(y_val, val_preds)
    val_macro_f1 = f1_score(y_val, val_preds, average="macro", zero_division=0)
    print(f"\nValidation Accuracy: {val_acc:.4f}, Macro F1: {val_macro_f1:.4f}")

    # Evaluate on test
    df_test = pd.read_csv(test_file)
    X_test = df_test[FEATURE_NAMES].to_numpy(dtype=np.float32)
    y_test = label_encoder.transform(df_test["anomaly_type"].fillna("normal"))
    test_preds = clf.predict(X_test)
    test_acc = accuracy_score(y_test, test_preds)
    test_macro_f1 = f1_score(y_test, test_preds, average="macro", zero_division=0)
    print(f"Test Accuracy:       {test_acc:.4f}, Macro F1: {test_macro_f1:.4f}")

    print("\nDetailed Test Classification Report:")
    print(classification_report(y_test, test_preds, target_names=class_names, zero_division=0))

    # Top feature importances
    importances = clf.feature_importances_
    sorted_idx = np.argsort(importances)[::-1]
    top_features = [{"feature": FEATURE_NAMES[i], "importance": float(importances[i])} for i in sorted_idx[:10]]
    print("\nTop 10 Most Diagnostic Features:")
    for rank, f_info in enumerate(top_features, 1):
        print(f"  {rank:2d}. {f_info['feature']:<28s} ({f_info['importance']:.4f})")

    print(f"\nSaving model to {MODEL_FILE}...")
    joblib.dump(clf, MODEL_FILE)
    print(f"Saving label encoder to {ENCODER_FILE}...")
    joblib.dump(label_encoder, ENCODER_FILE)

    metadata = {
        "model_type": "XGBoostClassifier",
        "classes": class_names,
        "n_classes": len(class_names),
        "feature_names": FEATURE_NAMES,
        "validation_accuracy": float(val_acc),
        "validation_macro_f1": float(val_macro_f1),
        "test_accuracy": float(test_acc),
        "test_macro_f1": float(test_macro_f1),
        "top_features": top_features,
    }

    with open(METADATA_FILE, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"Saved metadata to {METADATA_FILE}")
    print("XGBoost root cause classifier training pipeline completed successfully!")


if __name__ == "__main__":
    main()
