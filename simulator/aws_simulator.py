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

CITY_COORDINATES = {
    "abohar": (30.1453, 74.1993),
    "bathinda": (30.2110, 74.9455),
    "ludhiana": (30.9010, 75.8573),
    "amritsar": (31.6340, 74.8723),
    "patiala": (30.3398, 76.3869),
    "chandigarh": (30.7333, 76.7794),
    "delhi": (28.6139, 77.2090),
    "jaipur": (26.9124, 75.7873),
    "mumbai": (19.0760, 72.8777),
    "bengaluru": (12.9716, 77.5946),
    "kolkata": (22.5726, 88.3639),
    "pune": (18.5204, 73.8567),
}

# Live Open-Meteo cache state
_live_cache = {
    "last_fetch": 0.0,
    "temp": 24.0,
    "humidity": 55.0,
    "pressure": 1012.0,
}


def fetch_live_openmeteo(lat: float, lon: float) -> dict:
    """Fetch live meteorological observations from Open-Meteo free API (cached for 60s)"""
    now = time.time()
    if now - _live_cache["last_fetch"] < 60.0:
        return _live_cache

    try:
        url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={lat}&longitude={lon}&current="
            f"temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m"
        )
        resp = requests.get(url, timeout=4.0)
        if resp.status_code == 200:
            data = resp.json()
            curr = data.get("current", {})
            _live_cache["temp"] = float(curr.get("temperature_2m", _live_cache["temp"]))
            _live_cache["humidity"] = float(curr.get("relative_humidity_2m", _live_cache["humidity"]))
            _live_cache["pressure"] = float(curr.get("surface_pressure", _live_cache["pressure"]))
            _live_cache["last_fetch"] = now
            print(f"[Simulator Live] Fetched live Open-Meteo weather: {_live_cache['temp']}°C, {_live_cache['humidity']}%, {_live_cache['pressure']} hPa")
    except Exception as e:
        print(f"[Simulator Live] Notice: Could not refresh Open-Meteo ({e}), using last reading.")

    return _live_cache


def load_stream_dataset() -> pd.DataFrame:
    if CLEAN_DATA_FILE.exists():
        print(f"[Simulator] Loading clean replay data: {CLEAN_DATA_FILE}")
        return pd.read_csv(CLEAN_DATA_FILE)
    elif TEST_DATA_FILE.exists():
        print(f"[Simulator] Loading test split replay data: {TEST_DATA_FILE}")
        return pd.read_csv(TEST_DATA_FILE)
    else:
        print("[Simulator] Warning: Historical data file not found, will synthesize purely online.")
        return pd.DataFrame()


def run_simulator(api_url: str, interval_sec: float, loop: bool = True, mode: str = "replay", lat: float = 30.1453, lon: float = 74.1993, location_label: str = "ABOHAR"):
    print(f"[Simulator] Starting AWS telemetry stream to {api_url} [Mode: {mode.upper()}] at {interval_sec}s interval...")
    if mode == "live":
        print(f"[Simulator] Live Station GPS Target: {location_label} ({lat}, {lon})")
        # Pre-fetch initial real-time reading
        fetch_live_openmeteo(lat, lon)
    df = load_stream_dataset()
    row_idx = 0
    sub_step = 0
    STEPS_PER_HOUR = 60  # Smoothly interpolate across 60 steps (2 mins per hour) so delta T per tick is realistic (~0.01C)
    total_rows = len(df)
    reg_idx = 0

    # Local state for persistent fault injection
    local_fault = None
    local_fault_steps = 0
    drift_val = 0.0

    while True:
        sim_clock = datetime.now()

        # Check backend for dynamic mode changes from Dashboard (Replay vs Live, City selection)
        try:
            m_resp = requests.get(f"{api_url}/api/simulator/mode", timeout=0.8)
            if m_resp.status_code == 200:
                m_data = m_resp.json()
                remote_mode = m_data.get("mode", mode)
                if remote_mode != mode:
                    print(f"[Simulator] Mode switch: {mode.upper()} -> {remote_mode.upper()}")
                    mode = remote_mode
                    sub_step = 0
                    row_idx = 0
                    drift_val = 0.0
                    local_fault = None
                remote_city = m_data.get("city", "").strip().lower()
                if remote_city and remote_city in CITY_COORDINATES:
                    c_lat, c_lon = CITY_COORDINATES[remote_city]
                    if c_lat != lat or c_lon != lon:
                        lat, lon = c_lat, c_lon
                        location_label = remote_city.upper()
                        sub_step = 0
                        drift_val = 0.0
                        local_fault = None
                        print(f"[Simulator] Location updated: {location_label} ({lat}, {lon})")
        except Exception:
            pass

        # Check backend for active fault injection if triggered from UI
        try:
            f_resp = requests.get(f"{api_url}/api/fault/status", timeout=0.8)
            if f_resp.status_code == 200:
                f_json = f_resp.json()
                if f_json.get("is_active"):
                    local_fault = f_json.get("active_fault")
                    local_fault_steps = local_fault.get("duration_steps", 10)
        except Exception:
            pass

        # 1. Base telemetry for Primary Station (Abohar or live station)
        if mode == "live":
            live_obs = fetch_live_openmeteo(lat, lon)
            base_temp = live_obs["temp"]
            base_hum = live_obs["humidity"]
            base_pres = live_obs["pressure"]
        elif total_rows > 1 and row_idx < total_rows:
            curr_row = df.iloc[row_idx]
            next_idx = (row_idx + 1) % total_rows
            next_row = df.iloc[next_idx]

            alpha = float(sub_step) / float(STEPS_PER_HOUR)

            # Linear interpolation between hourly measurements + subtle physical thermal sensor noise
            base_temp = (1.0 - alpha) * float(curr_row["temperature"]) + alpha * float(next_row["temperature"])
            base_hum = (1.0 - alpha) * float(curr_row["humidity"]) + alpha * float(next_row["humidity"])
            base_pres = (1.0 - alpha) * float(curr_row["pressure"]) + alpha * float(next_row["pressure"])

            # Advance sub-step smoothly
            sub_step += 1
            if sub_step >= STEPS_PER_HOUR:
                sub_step = 0
                row_idx = (row_idx + 1) if (row_idx + 1 < total_rows or not loop) else 0
        elif total_rows == 1:
            row = df.iloc[0]
            base_temp = float(row["temperature"])
            base_hum = float(row["humidity"])
            base_pres = float(row["pressure"])
        else:
            # Diurnal sinusoidal weather cycle if no dataset
            hour = sim_clock.hour + (sim_clock.minute / 60.0)
            import numpy as np
            base_temp = 25.0 + 8.0 * np.sin((hour - 9) * np.pi / 12.0)
            base_hum = 60.0 - 20.0 * np.sin((hour - 9) * np.pi / 12.0)
            base_pres = 1013.25 + 3.0 * np.cos((hour - 9) * np.pi / 12.0)

        # Build Abohar packet with high-precision, low-noise sensor telemetry
        abohar_packet = {
            "station_id": "ABOHAR",
            "timestamp": sim_clock.isoformat(),
            "temperature": round(base_temp + random.gauss(0, 0.02), 2),
            "humidity": round(min(100.0, max(0.0, base_hum + random.gauss(0, 0.06))), 2),
            "pressure": round(base_pres + random.gauss(0, 0.01), 2),
        }

        # Apply active live fault injection if active (from backend or local injector)
        if local_fault and local_fault_steps > 0:
            f_type = local_fault.get("fault_type")
            mag = local_fault.get("magnitude", 15.0)
            sensor = local_fault.get("target_sensor", "temperature")

            if f_type == "temperature_spike":
                abohar_packet["temperature"] = round(abohar_packet["temperature"] + mag, 2)
            elif f_type == "humidity_spike":
                abohar_packet["humidity"] = min(100.0, max(0.0, round(abohar_packet["humidity"] + mag, 2)))
            elif f_type == "pressure_spike":
                abohar_packet["pressure"] = round(abohar_packet["pressure"] + mag, 2)
            elif f_type == "frozen_sensor":
                abohar_packet[sensor] = 28.5
            elif f_type == "sensor_drift":
                drift_val += mag * 0.3
                abohar_packet[sensor] = round(abohar_packet[sensor] + drift_val, 2)
            elif f_type == "communication_failure":
                abohar_packet["temperature"] = -99.0
                abohar_packet["humidity"] = 0.0
                abohar_packet["pressure"] = 0.0
            elif f_type == "multivariate_inconsistency":
                abohar_packet["temperature"] = 46.5
                abohar_packet["humidity"] = 98.0

            local_fault_steps -= 1
            if local_fault_steps <= 0:
                local_fault = None
                drift_val = 0.0
                # Notify backend fault is finished
                try:
                    requests.post(f"{api_url}/api/fault/clear", timeout=1.0)
                except Exception:
                    pass
        else:
            abohar_packet = live_injector.apply(abohar_packet)

        # Send Abohar packet
        try:
            resp = requests.post(f"{api_url}/api/telemetry", json=abohar_packet, timeout=3.0)
            if resp.status_code == 200:
                res = resp.json()
                anom_flag = "[ANOMALY!]" if res.get("is_anomaly") else "[NORMAL]"
                print(f"[ABOHAR {sim_clock.strftime('%H:%M:%S')}] {anom_flag} T={abohar_packet['temperature']}C H={abohar_packet['humidity']}% P={abohar_packet['pressure']}hPa | Score: {res.get('result', {}).get('ensemble_score', 0):.2f} | Cause: {res.get('result', {}).get('root_cause')}")
        except Exception as e:
            print(f"[Simulator] Connection error to backend: {e}")

        # 2. Sequential cycle of regional Punjab stations with stable meteorological spatial correlation
        reg = REGIONAL_STATIONS[reg_idx]
        reg_idx = (reg_idx + 1) % len(REGIONAL_STATIONS)
        reg_packet = {
            "station_id": reg["id"],
            "timestamp": sim_clock.isoformat(),
            "temperature": round(base_temp + reg["temp_offset"] + random.gauss(0, 0.03), 2),
            "humidity": round(min(100.0, max(0.0, base_hum + reg["hum_offset"] + random.gauss(0, 0.08))), 2),
            "pressure": round(base_pres + reg["pres_offset"] + random.gauss(0, 0.02), 2),
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
    parser.add_argument("--mode", choices=["replay", "live"], default="replay", help="Replay historical IMD data or stream live Open-Meteo weather")
    parser.add_argument("--city", type=str, default=None, help="City name (e.g. abohar, delhi, chandigarh, jaipur, etc.)")
    parser.add_argument("--lat", type=float, default=None, help="Custom latitude for live mode")
    parser.add_argument("--lon", type=float, default=None, help="Custom longitude for live mode")
    args = parser.parse_args()

    # Determine coordinates
    target_lat = 30.1453
    target_lon = 74.1993
    target_label = "ABOHAR"

    if args.city:
        city_key = args.city.strip().lower()
        if city_key in CITY_COORDINATES:
            target_lat, target_lon = CITY_COORDINATES[city_key]
            target_label = args.city.upper()
        else:
            print(f"[Simulator] City '{args.city}' not in presets, using Abohar default.")
    elif args.lat is not None and args.lon is not None:
        target_lat = args.lat
        target_lon = args.lon
        target_label = f"CUSTOM ({target_lat:.2f}, {target_lon:.2f})"

    run_simulator(
        api_url=args.api_url,
        interval_sec=args.interval,
        mode=args.mode,
        lat=target_lat,
        lon=target_lon,
        location_label=target_label,
    )
