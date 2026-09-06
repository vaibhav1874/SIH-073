"""
SkyGuard AI - Chronological Train / Validation / Test Splitter
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS

Splits dataset chronologically to prevent temporal data leakage:
- Train:       2010-01-01 to 2018-12-31 (Baseline historical training)
- Validation:  2019-01-01 to 2021-06-30 (Hyperparameter tuning & threshold calibration)
- Test:        2021-07-01 to 2024-02-20 (Final out-of-sample benchmark)

Outputs:
- data/splits/train.csv (features + labels)
- data/splits/val.csv   (features + labels)
- data/splits/test.csv  (features + labels)
- data/splits/train_clean.csv (clean training data for unsupervised models)
"""

import sys
from pathlib import Path
import pandas as pd
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.append(str(PROJECT_ROOT))

from ml.feature_engineering.features import compute_features, FEATURE_NAMES

INJECTED_FILE = PROJECT_ROOT / "data" / "injected" / "Abohar_anomaly.csv"
CLEAN_FILE = PROJECT_ROOT / "data" / "processed" / "Abohar_clean.csv"
SPLITS_DIR = PROJECT_ROOT / "data" / "splits"

# Chronological split boundaries
TRAIN_END = "2018-12-31 23:59:59"
VAL_END = "2021-06-30 23:59:59"


def main():
    if not INJECTED_FILE.exists():
        print(f"Error: Injected file not found at {INJECTED_FILE}")
        sys.exit(1)

    SPLITS_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Loading injected dataset from: {INJECTED_FILE}")
    df_injected = pd.read_csv(INJECTED_FILE)
    df_injected["timestamp"] = pd.to_datetime(df_injected["timestamp"])

    print("Computing 40 engineered features on injected dataset...")
    df_with_features = compute_features(df_injected)

    # Convert timestamps to tz-naive UTC or comparable string for splitting
    ts = pd.to_datetime(df_with_features["timestamp"], utc=True)
    t_end_train = pd.to_datetime(TRAIN_END, utc=True)
    t_end_val = pd.to_datetime(VAL_END, utc=True)

    mask_train = ts <= t_end_train
    mask_val = (ts > t_end_train) & (ts <= t_end_val)
    mask_test = ts > t_end_val

    df_train = df_with_features[mask_train].copy().reset_index(drop=True)
    df_val = df_with_features[mask_val].copy().reset_index(drop=True)
    df_test = df_with_features[mask_test].copy().reset_index(drop=True)

    print(f"Saving splits to {SPLITS_DIR}:")
    print(f"  - Train: {len(df_train):,} rows ({df_train['timestamp'].min()} -> {df_train['timestamp'].max()})")
    print(f"  - Val:   {len(df_val):,} rows ({df_val['timestamp'].min()} -> {df_val['timestamp'].max()})")
    print(f"  - Test:  {len(df_test):,} rows ({df_test['timestamp'].min()} -> {df_test['timestamp'].max()})")

    df_train.to_csv(SPLITS_DIR / "train.csv", index=False)
    df_val.to_csv(SPLITS_DIR / "val.csv", index=False)
    df_test.to_csv(SPLITS_DIR / "test.csv", index=False)

    # Generate clean training data for unsupervised Isolation Forest & LSTM Autoencoder
    print(f"Loading clean dataset from: {CLEAN_FILE} for unsupervised training split...")
    df_clean = pd.read_csv(CLEAN_FILE)
    df_clean_feat = compute_features(df_clean)
    ts_clean = pd.to_datetime(df_clean_feat["timestamp"], utc=True)
    df_clean_train = df_clean_feat[ts_clean <= t_end_train].copy().reset_index(drop=True)
    df_clean_train.to_csv(SPLITS_DIR / "train_clean.csv", index=False)
    print(f"  - Clean train (unsupervised): {len(df_clean_train):,} rows")

    # Distribution summaries
    print("\nAnomaly counts in Train / Val / Test:")
    for name, split_df in [("Train", df_train), ("Val", df_val), ("Test", df_test)]:
        anom_n = (split_df["is_anomaly"] == 1).sum()
        pct = 100.0 * anom_n / len(split_df)
        print(f"  {name:5s}: {anom_n:,} anomalies ({pct:.2f}%)")

    print("\nChronological split complete! Ready for model training.")


if __name__ == "__main__":
    main()
