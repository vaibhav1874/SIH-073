"""
SkyGuard AI - Synthetic Anomaly Injection Pipeline (Phase 3)
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS

Injects 7 ground-truth fault types into the historical clean dataset:
1. Temperature Spike (sudden high-magnitude delta, 1-3 timesteps)
2. Humidity Spike (sudden jump to saturation or extreme drop, 1-3 timesteps)
3. Pressure Spike (abrupt jump/drop of 15-35 hPa, 1-2 timesteps)
4. Frozen Sensor (sensor value stuck invariant for 6-24 timesteps)
5. Sensor Drift (slow progressive calibration loss over 24-72 timesteps)
6. Communication Failure (dropped/zeroed sensor values for 2-8 timesteps)
7. Multivariate Inconsistency (physically impossible cross-sensor combinations)

Target: ~7% total anomalous rows with reproducible seed=42.
Outputs:
- data/injected/Abohar_anomaly.csv (injected sensor values + ground truth labels)
- data/metadata/anomaly_injection_log.csv (audit trail of all injected anomalies)
"""

import sys
import random
from pathlib import Path
from typing import List, Dict, Tuple
import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
INPUT_FILE = PROJECT_ROOT / "data" / "processed" / "Abohar_clean.csv"
OUTPUT_DATA_FILE = PROJECT_ROOT / "data" / "injected" / "Abohar_anomaly.csv"
OUTPUT_LOG_FILE = PROJECT_ROOT / "data" / "metadata" / "anomaly_injection_log.csv"

SEED = 42
TARGET_ANOMALY_PERCENTAGE = 0.07  # ~7% anomalous timesteps


def inject_anomalies(df_in: pd.DataFrame, seed: int = SEED) -> Tuple[pd.DataFrame, pd.DataFrame]:
    np.random.seed(seed)
    random.seed(seed)

    df = df_in.copy()
    n_rows = len(df)

    # Initialize ground truth annotation columns
    df["is_anomaly"] = 0
    df["anomaly_type"] = "normal"
    df["anomaly_severity"] = "none"
    df["affected_sensor"] = "none"

    logs: List[Dict] = []
    anomaly_id = 1

    # Target number of anomalous rows
    target_anom_rows = int(n_rows * TARGET_ANOMALY_PERCENTAGE)
    curr_anom_rows = 0

    # Ensure episodes don't overlap too closely: keep spacing of at least 30 timesteps
    occupied = np.zeros(n_rows, dtype=bool)

    # Define proportions of fault types
    fault_types = [
        "temperature_spike",
        "humidity_spike",
        "pressure_spike",
        "frozen_sensor",
        "sensor_drift",
        "communication_failure",
        "multivariate_inconsistency",
    ]
    weights = [0.18, 0.16, 0.14, 0.16, 0.14, 0.10, 0.12]

    # Pre-select candidate start positions (leaving buffer at ends)
    margin = 100
    candidate_indices = np.arange(margin, n_rows - margin)
    np.random.shuffle(candidate_indices)

    cand_idx = 0
    while curr_anom_rows < target_anom_rows and cand_idx < len(candidate_indices):
        start_pos = candidate_indices[cand_idx]
        cand_idx += 1

        fault = np.random.choice(fault_types, p=weights)

        # Determine duration based on fault type
        if fault == "temperature_spike":
            duration = np.random.randint(1, 4)
            affected = "temperature"
            mag = np.random.choice([-1, 1]) * np.random.uniform(10.0, 25.0)
            severity = "critical" if abs(mag) > 18 else "high"
        elif fault == "humidity_spike":
            duration = np.random.randint(1, 4)
            affected = "humidity"
            mag = np.random.choice([-1, 1]) * np.random.uniform(40.0, 60.0)
            severity = "high"
        elif fault == "pressure_spike":
            duration = np.random.randint(1, 3)
            affected = "pressure"
            mag = np.random.choice([-1, 1]) * np.random.uniform(16.0, 35.0)
            severity = "critical" if abs(mag) > 25 else "high"
        elif fault == "frozen_sensor":
            duration = np.random.randint(6, 25)
            affected = np.random.choice(["temperature", "humidity", "pressure"])
            mag = 0.0
            severity = "medium" if duration < 12 else "high"
        elif fault == "sensor_drift":
            duration = np.random.randint(24, 73)
            affected = np.random.choice(["temperature", "humidity"])
            drift_rate = np.random.uniform(0.2, 0.5) * np.random.choice([-1, 1])
            mag = drift_rate
            severity = "medium" if abs(drift_rate * duration) < 15 else "high"
        elif fault == "communication_failure":
            duration = np.random.randint(2, 9)
            affected = "all"
            mag = -999.0
            severity = "critical"
        elif fault == "multivariate_inconsistency":
            duration = np.random.randint(3, 10)
            affected = "temperature,humidity"
            mag = 0.0
            severity = "high"
        else:
            continue

        end_pos = start_pos + duration
        if end_pos >= n_rows - 10:
            continue

        # Check overlap
        if occupied[max(0, start_pos - 15): min(n_rows, end_pos + 15)].any():
            continue

        # Mark occupied
        occupied[start_pos:end_pos] = True

        # Apply fault injection
        if fault == "temperature_spike":
            df.loc[start_pos:end_pos - 1, "temperature"] += mag
        elif fault == "humidity_spike":
            new_val = 99.5 if mag > 0 else 0.5
            df.loc[start_pos:end_pos - 1, "humidity"] = new_val
        elif fault == "pressure_spike":
            df.loc[start_pos:end_pos - 1, "pressure"] += mag
        elif fault == "frozen_sensor":
            # Fix value to reading at start_pos - 1
            stuck_val = df.loc[start_pos - 1, affected]
            df.loc[start_pos:end_pos - 1, affected] = stuck_val
        elif fault == "sensor_drift":
            # Progressive linear deviation
            steps = np.arange(1, duration + 1)
            drift_values = mag * steps
            df.loc[start_pos:end_pos - 1, affected] += drift_values
        elif fault == "communication_failure":
            # Zero out or sentinel -999.0 representing AWS comms packet loss
            df.loc[start_pos:end_pos - 1, "temperature"] = -99.0
            df.loc[start_pos:end_pos - 1, "humidity"] = 0.0
            df.loc[start_pos:end_pos - 1, "pressure"] = 0.0
        elif fault == "multivariate_inconsistency":
            # Physically incompatible: Extreme hot temp (46 deg C) combined with 98% relative humidity
            df.loc[start_pos:end_pos - 1, "temperature"] = 46.5
            df.loc[start_pos:end_pos - 1, "humidity"] = 98.5

        # Annotate labels
        df.loc[start_pos:end_pos - 1, "is_anomaly"] = 1
        df.loc[start_pos:end_pos - 1, "anomaly_type"] = fault
        df.loc[start_pos:end_pos - 1, "anomaly_severity"] = severity
        df.loc[start_pos:end_pos - 1, "affected_sensor"] = affected

        curr_anom_rows += duration

        # Log episode
        start_time = str(df.loc[start_pos, "timestamp"])
        end_time = str(df.loc[end_pos - 1, "timestamp"])
        logs.append({
            "anomaly_id": f"ANOM_{anomaly_id:04d}",
            "start_index": start_pos,
            "end_index": end_pos - 1,
            "start_time": start_time,
            "end_time": end_time,
            "duration_hours": duration,
            "fault_type": fault,
            "affected_sensor": affected,
            "severity": severity,
            "magnitude": round(mag, 3),
        })
        anomaly_id += 1

    log_df = pd.DataFrame(logs)
    return df, log_df


def main():
    if not INPUT_FILE.exists():
        print(f"[Phase 3] Error: Clean preprocessed file not found at {INPUT_FILE}")
        sys.exit(1)

    print(f"[Phase 3] Loading clean data from: {INPUT_FILE}")
    df = pd.read_csv(INPUT_FILE)
    print(f"[Phase 3] Total records: {len(df):,}")

    print(f"[Phase 3] Injecting 7 realistic AWS fault types (target ~{TARGET_ANOMALY_PERCENTAGE*100:.1f}% rate)...")
    injected_df, log_df = inject_anomalies(df, seed=SEED)

    anom_count = (injected_df["is_anomaly"] == 1).sum()
    anom_pct = 100.0 * anom_count / len(injected_df)

    OUTPUT_DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

    print(f"[Phase 3] Saving injected dataset to: {OUTPUT_DATA_FILE}")
    injected_df.to_csv(OUTPUT_DATA_FILE, index=False)

    print(f"[Phase 3] Saving anomaly episode log to: {OUTPUT_LOG_FILE}")
    log_df.to_csv(OUTPUT_LOG_FILE, index=False)

    print(f"[Phase 3] Injected anomalies summary:")
    print(f"  - Total rows: {len(injected_df):,}")
    print(f"  - Anomalous rows: {anom_count:,} ({anom_pct:.2f}%)")
    print(f"  - Total episodes: {len(log_df):,}")
    print("\nFault type breakdown:")
    print(injected_df[injected_df["is_anomaly"] == 1]["anomaly_type"].value_counts().to_string())
    print("\nSeverity breakdown:")
    print(injected_df[injected_df["is_anomaly"] == 1]["anomaly_severity"].value_counts().to_string())
    print("\n[Phase 3] Complete! Injected dataset ready for train/val/test split.")


if __name__ == "__main__":
    main()
