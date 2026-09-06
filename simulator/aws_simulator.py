"""
SkyGuard AI - Multi-Station AWS Telemetry Simulator
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS

Streams realistic Automatic Weather Station telemetry into the backend:
1. Replays historical test data from Abohar AWS
2. Generates spatially correlated telemetry for regional Punjab network:
   - Bathinda, Ludhiana, Amritsar, Patiala
3. Intercepts outgoing packets with `live_injector` for on-demand fault injection
4. Posts to backend API endpoint /api/telemetry
"""

import sys
import time
import argparse
import random
from pathlib import Path
from datetime import datetime, timedelta
import pandas as pd
import requests

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(PROJECT_ROOT))

from ml.anomaly_injection.live_injector import live_injector

TEST_DATA_FILE = PROJECT_ROOT / "data" / "splits" / "test.csv"
CLEAN_DATA_FILE = PROJECT_ROOT / "data" / "processed" / "Abohar_clean.csv"

# Regional stations with meteorological offsets relative to Abohar
REGIONAL_STATIONS = [
    {"id": "BATHINDA", "temp_offset": 0.5, "hum_offset": -2.0, "pres_offset": -1.5},
    {"id": "LUDHIANA", "temp_offset": -0.8, "hum_offset": 4.0, "pres_offset": -3.2},
    {"id": "AMRITSAR", "temp_offset": -1.5, "hum_offset": 6.0, "pres_offset": -2.1},
    {"id": "PATIALA",  "temp_offset": -0.3, "hum_offset": 1.5, "pres_offset": -2.8},
]


def load_stream_dataset() -> pd.DataFrame:
    if TEST_DATA_FILE.exists():
        print(f"[Simulator] Loading test split replay data: {TEST_DATA_FILE}")
        return pd.read_csv(TEST_DATA_FILE)
    elif CLEAN_DATA_FILE.exists():
        print(f"[Simulator] Loading clean replay data: {CLEAN_DATA_FILE}")
        return pd.read_csv(CLEAN_DATA_FILE)
    else:
        print("[Simulator] Warning: Historical data file not found, will synthesize purely online.")
        return pd.DataFrame()


def run_simulator(api_url: str, interval_sec: float, loop: bool = True):
    print(f"[Simulator] Starting AWS telemetry stream to {api_url} at {interval_sec}s interval...")
    df = load_stream_dataset()
    row_idx = 0
    total_rows = len(df)

    # Simulated clock starting now
    sim_clock = datetime.utcnow()

    while True:
        sim_clock += timedelta(hours=1)

        # 1. Base telemetry for Primary Station (Abohar)
        if total_rows > 0 and row_idx < total_rows:
            row = df.iloc[row_idx]
            base_temp = float(row["temperature"])
            base_hum = float(row["humidity"])
            base_pres = float(row["pressure"])
            row_idx = (row_idx + 1) if (row_idx + 1 < total_rows or not loop) else 0
        else:
            # Diurnal sinusoidal weather cycle if no dataset
            hour = sim_clock.hour
            base_temp = 25.0 + 8.0 * random.uniform(0.9, 1.1)
            base_hum = 55.0 + 15.0 * random.uniform(0.9, 1.1)
            base_pres = 1010.0 + random.uniform(-2.0, 2.0)

        # Build Abohar packet
        abohar_packet = {
            "station_id": "ABOHAR",
            "timestamp": sim_clock.isoformat(),
            "temperature": round(base_temp + random.uniform(-0.1, 0.1), 2),
            "humidity": round(base_hum + random.uniform(-0.3, 0.3), 2),
            "pressure": round(base_pres + random.uniform(-0.05, 0.05), 2),
        }

        # Apply active live fault injection if active
        abohar_packet = live_injector.apply(abohar_packet)

        # Send Abohar packet
        try:
            resp = requests.post(f"{api_url}/api/telemetry", json=abohar_packet, timeout=3.0)
            if resp.status_code == 200:
                res = resp.json()
                anom_flag = "[ANOMALY!]" if res.get("is_anomaly") else "[NORMAL]"
                print(f"[ABOHAR {sim_clock.strftime('%H:%M')}] {anom_flag} T={abohar_packet['temperature']}°C H={abohar_packet['humidity']}% P={abohar_packet['pressure']}hPa | Cause: {res.get('result', {}).get('root_cause')}")
        except Exception as e:
            print(f"[Simulator] Connection error to backend: {e}")

        # 2. Cycle one regional station per tick for network coverage
        reg = random.choice(REGIONAL_STATIONS)
        reg_packet = {
            "station_id": reg["id"],
            "timestamp": sim_clock.isoformat(),
            "temperature": round(base_temp + reg["temp_offset"] + random.uniform(-0.3, 0.3), 2),
            "humidity": round(min(100.0, max(0.0, base_hum + reg["hum_offset"] + random.uniform(-0.8, 0.8))), 2),
            "pressure": round(base_pres + reg["pres_offset"] + random.uniform(-0.1, 0.1), 2),
        }
        try:
            requests.post(f"{api_url}/api/telemetry", json=reg_packet, timeout=3.0)
        except Exception:
            pass

        time.sleep(interval_sec)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SkyGuard AI AWS Telemetry Simulator")
    parser.add_argument("--api-url", default="http://localhost:8000", help="Backend API URL")
    parser.add_argument("--interval", type=float, default=1.5, help="Playback cadence in seconds")
    args = parser.parse_args()

    run_simulator(api_url=args.api_url, interval_sec=args.interval)
