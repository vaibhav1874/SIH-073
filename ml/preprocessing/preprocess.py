"""
SkyGuard AI - Data Preprocessing Pipeline (Phase 1)
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS

Processes raw Abohar Automatic Weather Station historical dataset:
- Cleans and standardizes columns
- Converts UTC timestamp to IST (Asia/Kolkata, +05:30)
- Validates sensor reading bounds
- Outputs clean dataset to data/processed/Abohar_clean.csv
"""

import os
import sys
from pathlib import Path
import pandas as pd
import numpy as np

# Base paths
PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW_DATA_CANDIDATES = [
    PROJECT_ROOT / "Abohar.csv",
    PROJECT_ROOT / "data" / "raw" / "Abohar.csv",
]
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
OUTPUT_FILE = PROCESSED_DIR / "Abohar_clean.csv"

# Physical plausible sensor limits for weather in North India (IMD standards)
BOUNDS = {
    "temperature": (-10.0, 60.0),      # deg C
    "humidity": (0.0, 100.0),          # %
    "pressure": (850.0, 1100.0),       # hPa
}

COLUMN_MAPPING = {
    "date": "timestamp",
    "temperature_2m": "temperature",
    "relative_humidity_2m": "humidity",
    "pressure_msl": "pressure",
    "dew_point_2m": "dew_point",
    "surface_pressure": "surface_pressure",
    "wind_speed_10m": "wind_speed",
}


def find_raw_file() -> Path:
    for path in RAW_DATA_CANDIDATES:
        if path.exists():
            return path
    raise FileNotFoundError(
        f"Could not find Abohar.csv in expected locations:\n"
        + "\n".join(str(p) for p in RAW_DATA_CANDIDATES)
    )


def preprocess_data(raw_file: Path) -> pd.DataFrame:
    print(f"[Phase 1] Loading raw data from: {raw_file}")
    df = pd.read_csv(raw_file)
    initial_rows = len(df)
    print(f"[Phase 1] Initial rows: {initial_rows}, columns: {list(df.columns)}")

    # Drop unnamed index column if present
    drop_cols = [c for c in df.columns if "Unnamed" in c]
    if drop_cols:
        df = df.drop(columns=drop_cols)
        print(f"[Phase 1] Dropped index column(s): {drop_cols}")

    # Verify required columns
    for col in ["date", "temperature_2m", "relative_humidity_2m", "pressure_msl"]:
        if col not in df.columns:
            raise KeyError(f"Missing required column in raw dataset: {col}")

    # Standardize column names
    rename_dict = {k: v for k, v in COLUMN_MAPPING.items() if k in df.columns}
    df = df.rename(columns=rename_dict)

    # Parse date to datetime (UTC aware) and convert to IST (Asia/Kolkata)
    print("[Phase 1] Parsing timestamps and converting to IST (+05:30)...")
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    df["timestamp"] = df["timestamp"].dt.tz_convert("Asia/Kolkata")

    # Add metadata
    df["station_id"] = "ABOHAR"

    # Sort chronologically and deduplicate
    df = df.sort_values("timestamp").drop_duplicates(subset=["timestamp"]).reset_index(drop=True)
    dedup_rows = len(df)
    if dedup_rows < initial_rows:
        print(f"[Phase 1] Removed {initial_rows - dedup_rows} duplicate timestamp rows.")

    # Validate physical bounds
    for col, (low, high) in BOUNDS.items():
        if col in df.columns:
            out_of_bounds = ((df[col] < low) | (df[col] > high)).sum()
            if out_of_bounds > 0:
                print(f"[Phase 1] Warning: {out_of_bounds} readings outside [{low}, {high}] for {col}.")
                # Clip to physical limits
                df[col] = df[col].clip(lower=low, upper=high)

    # Reorder columns: station_id, timestamp, temperature, humidity, pressure, then rest
    core_cols = ["station_id", "timestamp", "temperature", "humidity", "pressure"]
    extra_cols = [c for c in df.columns if c not in core_cols]
    df = df[core_cols + extra_cols]

    # Check for missing values
    missing = df.isnull().sum()
    if missing.any():
        print(f"[Phase 1] Missing values detected, applying forward-fill then backward-fill:\n{missing[missing > 0]}")
        df = df.ffill().bfill()
    else:
        print("[Phase 1] Zero missing values detected across all columns.")

    return df


def main():
    raw_path = find_raw_file()
    df = preprocess_data(raw_path)

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[Phase 1] Writing clean dataset to: {OUTPUT_FILE}")
    df.to_csv(OUTPUT_FILE, index=False)

    file_size_mb = OUTPUT_FILE.stat().st_size / (1024 * 1024)
    print(f"[Phase 1] Successfully processed {len(df):,} rows.")
    print(f"[Phase 1] Output file size: {file_size_mb:.2f} MB")
    print(f"[Phase 1] Date range: {df['timestamp'].min()} to {df['timestamp'].max()}")
    print("[Phase 1] Summary statistics for key sensors:")
    print(df[["temperature", "humidity", "pressure"]].describe().to_string())
    print("[Phase 1] Complete! Preprocessed data ready for feature engineering.")


if __name__ == "__main__":
    main()
