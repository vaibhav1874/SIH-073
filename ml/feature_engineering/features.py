"""
SkyGuard AI - Feature Engineering Pipeline (Phase 2)
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS

Computes 40 domain-specific meteorological features:
- Raw sensor values (3)
- Cyclical temporal encodings (8)
- Rate of change & acceleration (6)
- Multi-scale rolling statistics (18)
- Dynamic rolling Z-scores (3)
- Physical meteorological consistency (2)

Provides:
- Batch feature generation for training
- Real-time single-step feature extraction for live streaming inference
"""

import sys
from pathlib import Path
from typing import List, Optional, Tuple
import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
INPUT_FILE = PROJECT_ROOT / "data" / "processed" / "Abohar_clean.csv"
OUTPUT_FILE = PROJECT_ROOT / "data" / "processed" / "Abohar_features.csv"

# Exact list of 40 engineered feature names
FEATURE_NAMES = [
    # 1. Raw sensor values (3)
    "temperature", "humidity", "pressure",
    # 2. Cyclical temporal encodings (8)
    "hour_sin", "hour_cos",
    "month_sin", "month_cos",
    "day_of_year_sin", "day_of_year_cos",
    "day_of_week_sin", "day_of_week_cos",
    # 3. Rate of change (1st and 2nd differences) (6)
    "temp_diff_1", "humidity_diff_1", "pressure_diff_1",
    "temp_diff_2", "humidity_diff_2", "pressure_diff_2",
    # 4. Rolling statistics for temperature, humidity, pressure (18)
    "temp_rolling_mean_3h", "temp_rolling_std_3h",
    "temp_rolling_mean_6h", "temp_rolling_std_6h",
    "temp_rolling_mean_24h", "temp_rolling_std_24h",
    "humidity_rolling_mean_3h", "humidity_rolling_std_3h",
    "humidity_rolling_mean_6h", "humidity_rolling_std_6h",
    "humidity_rolling_mean_24h", "humidity_rolling_std_24h",
    "pressure_rolling_mean_3h", "pressure_rolling_std_3h",
    "pressure_rolling_mean_6h", "pressure_rolling_std_6h",
    "pressure_rolling_mean_24h", "pressure_rolling_std_24h",
    # 5. Dynamic Z-scores relative to 24h baseline (3)
    "temp_zscore_24h", "humidity_zscore_24h", "pressure_zscore_24h",
    # 6. Meteorological cross-sensor consistency (2)
    "dew_point_spread", "temp_humidity_ratio",
]


def compute_cyclical_features(timestamps: pd.Series) -> pd.DataFrame:
    """Computes sine and cosine cyclic encodings for temporal seasonality."""
    dt = pd.to_datetime(timestamps)
    hour = dt.dt.hour + dt.dt.minute / 60.0
    month = dt.dt.month
    day_of_year = dt.dt.dayofyear
    day_of_week = dt.dt.dayofweek

    df_time = pd.DataFrame(index=timestamps.index)
    df_time["hour_sin"] = np.sin(2.0 * np.pi * hour / 24.0)
    df_time["hour_cos"] = np.cos(2.0 * np.pi * hour / 24.0)
    df_time["month_sin"] = np.sin(2.0 * np.pi * (month - 1) / 12.0)
    df_time["month_cos"] = np.cos(2.0 * np.pi * (month - 1) / 12.0)
    df_time["day_of_year_sin"] = np.sin(2.0 * np.pi * (day_of_year - 1) / 365.25)
    df_time["day_of_year_cos"] = np.cos(2.0 * np.pi * (day_of_year - 1) / 365.25)
    df_time["day_of_week_sin"] = np.sin(2.0 * np.pi * day_of_week / 7.0)
    df_time["day_of_week_cos"] = np.cos(2.0 * np.pi * day_of_week / 7.0)
    return df_time


def compute_features(df_in: pd.DataFrame) -> pd.DataFrame:
    """Generates the full set of 40 features on a DataFrame."""
    df = df_in.copy()

    # Cyclical temporal
    df_cyclic = compute_cyclical_features(df["timestamp"])
    for c in df_cyclic.columns:
        df[c] = df_cyclic[c]

    sensors = ["temperature", "humidity", "pressure"]

    # Rate of change: first difference & second difference (acceleration)
    for s in sensors:
        prefix = "temp" if s == "temperature" else s
        df[f"{prefix}_diff_1"] = df[s].diff(1).fillna(0.0)
        df[f"{prefix}_diff_2"] = df[f"{prefix}_diff_1"].diff(1).fillna(0.0)

    # Rolling statistics: 3h, 6h, 24h
    windows = [3, 6, 24]
    for s in sensors:
        prefix = "temp" if s == "temperature" else s
        for w in windows:
            roll = df[s].rolling(window=w, min_periods=1)
            df[f"{prefix}_rolling_mean_{w}h"] = roll.mean()
            df[f"{prefix}_rolling_std_{w}h"] = roll.std().fillna(0.0)

    # Dynamic Z-scores relative to 24h rolling stats
    for s in sensors:
        prefix = "temp" if s == "temperature" else s
        mean = df[f"{prefix}_rolling_mean_24h"]
        std = df[f"{prefix}_rolling_std_24h"] + 1e-6
        df[f"{prefix}_zscore_24h"] = (df[s] - mean) / std

    # Meteorological consistency features
    # Dew point spread: Temperature minus Dew Point
    if "dew_point" in df.columns:
        df["dew_point_spread"] = df["temperature"] - df["dew_point"]
    else:
        # Magnus approximation: Td ≈ T - ((100 - RH) / 5)
        approx_dew_point = df["temperature"] - ((100.0 - df["humidity"].clip(0.0, 100.0)) / 5.0)
        df["dew_point_spread"] = df["temperature"] - approx_dew_point

    # Temperature / Humidity ratio (with epsilon to prevent div-by-zero)
    df["temp_humidity_ratio"] = df["temperature"] / (df["humidity"].abs() + 1e-3)

    return df


def extract_feature_matrix(df: pd.DataFrame) -> np.ndarray:
    """Extracts exactly the 40 feature matrix as a numpy float32 array."""
    return df[FEATURE_NAMES].to_numpy(dtype=np.float32)


def compute_features_for_buffer(buffer_df: pd.DataFrame) -> dict:
    """
    Computes 40 features for the newest point in a rolling window buffer.
    Buffer should contain at least 25 historical rows sorted chronologically.
    Returns dictionary with all 40 feature values for the latest timestamp.
    """
    feat_df = compute_features(buffer_df)
    latest_row = feat_df.iloc[-1]
    return {name: float(latest_row[name]) for name in FEATURE_NAMES}


def main():
    if not INPUT_FILE.exists():
        print(f"[Phase 2] Error: Preprocessed file not found at {INPUT_FILE}")
        print("[Phase 2] Please run ml/preprocessing/preprocess.py first.")
        sys.exit(1)

    print(f"[Phase 2] Loading preprocessed data from: {INPUT_FILE}")
    df = pd.read_csv(INPUT_FILE)
    print(f"[Phase 2] Computing 40 engineered features across {len(df):,} rows...")
    df_features = compute_features(df)

    # Verify all 40 features are present with zero NaNs
    missing_cols = [col for col in FEATURE_NAMES if col not in df_features.columns]
    if missing_cols:
        raise ValueError(f"[Phase 2] Missing features: {missing_cols}")

    nan_counts = df_features[FEATURE_NAMES].isnull().sum()
    if nan_counts.any():
        print(f"[Phase 2] Warning: NaN values in features:\n{nan_counts[nan_counts > 0]}")
        df_features[FEATURE_NAMES] = df_features[FEATURE_NAMES].fillna(0.0)

    print(f"[Phase 2] Saving feature dataset to: {OUTPUT_FILE}")
    df_features.to_csv(OUTPUT_FILE, index=False)
    file_size_mb = OUTPUT_FILE.stat().st_size / (1024 * 1024)

    print(f"[Phase 2] Successfully generated {len(FEATURE_NAMES)} features!")
    print(f"[Phase 2] Output file size: {file_size_mb:.2f} MB")
    print(f"[Phase 2] Verified feature list ({len(FEATURE_NAMES)} total):")
    for i, name in enumerate(FEATURE_NAMES, 1):
        print(f"  {i:2d}. {name}")
    print("[Phase 2] Complete! Ready for Anomaly Injection (Phase 3).")


if __name__ == "__main__":
    main()
