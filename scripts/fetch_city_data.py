"""
SkyGuard AI - Multi-City Historical Data Fetcher
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS

Downloads 2 years of hourly historical meteorological data from Open-Meteo
Archive API (free, no API key required) for all supported Indian cities.

Usage:
    python scripts/fetch_city_data.py
    python scripts/fetch_city_data.py --city delhi  # single city only

Output:
    data/historical/<city>_historical.csv
"""

import sys
import time
import argparse
from pathlib import Path
from datetime import datetime, timedelta

import requests
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = PROJECT_ROOT / "data" / "historical"

# ── City registry ────────────────────────────────────────────────────────────
CITIES = {
    "delhi": {
        "lat": 28.6139, "lon": 77.2090,
        "state": "Delhi NCT",
        "climate": "Semi-arid continental"
    },
    "jaipur": {
        "lat": 26.9124, "lon": 75.7873,
        "state": "Rajasthan",
        "climate": "Hot desert"
    },
    "shimla": {
        "lat": 31.1048, "lon": 77.1734,
        "state": "Himachal Pradesh",
        "climate": "Alpine mountain"
    },
    "mumbai": {
        "lat": 19.0760, "lon": 72.8777,
        "state": "Maharashtra",
        "climate": "Tropical coastal"
    },
    "bengaluru": {
        "lat": 12.9716, "lon": 77.5946,
        "state": "Karnataka",
        "climate": "Tropical savanna"
    },
    "bhopal": {
        "lat": 23.2599, "lon": 77.4126,
        "state": "Madhya Pradesh",
        "climate": "Humid subtropical"
    },
}

# Open-Meteo variables to fetch
VARIABLES = [
    "temperature_2m",
    "relative_humidity_2m",
    "surface_pressure",
    "wind_speed_10m",
    "precipitation",
    "apparent_temperature",
    "dew_point_2m",
]

# Column rename mapping for consistency with existing pipeline
RENAME_MAP = {
    "temperature_2m": "temperature",
    "relative_humidity_2m": "humidity",
    "surface_pressure": "pressure",
    "wind_speed_10m": "wind_speed",
    "precipitation": "precipitation",
    "apparent_temperature": "apparent_temperature",
    "dew_point_2m": "dew_point",
}


def fetch_historical(city_key: str, lat: float, lon: float, start: str, end: str) -> pd.DataFrame:
    """Fetch hourly historical data from Open-Meteo Archive API."""
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start,
        "end_date": end,
        "hourly": ",".join(VARIABLES),
        "timezone": "Asia/Kolkata",
        "wind_speed_unit": "kmh",
    }

    print(f"  Fetching {city_key.upper()} ({lat}N, {lon}E)  [{start} -> {end}]...")
    for attempt in range(3):
        try:
            resp = requests.get(url, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            break
        except Exception as e:
            if attempt < 2:
                print(f"  Retry {attempt + 1}/3 after error: {e}")
                time.sleep(3)
            else:
                raise RuntimeError(f"Failed to fetch data for {city_key}: {e}")

    hourly = data.get("hourly", {})
    if not hourly or "time" not in hourly:
        raise ValueError(f"Unexpected API response for {city_key}: {list(data.keys())}")

    df = pd.DataFrame(hourly)
    df.rename(columns={"time": "timestamp"}, inplace=True)
    df.rename(columns={k: v for k, v in RENAME_MAP.items() if k in df.columns}, inplace=True)

    # Drop rows with any NaN sensor readings
    sensor_cols = [c for c in RENAME_MAP.values() if c in df.columns]
    before = len(df)
    df.dropna(subset=sensor_cols, inplace=True)
    print(f"  Rows: {before:,} fetched, {before - len(df):,} NaN dropped -> {len(df):,} clean records")

    return df


def main():
    parser = argparse.ArgumentParser(description="SkyGuard AI - Fetch historical weather data for all cities")
    parser.add_argument("--city", type=str, default=None,
                        help="Fetch only a specific city (e.g. delhi). Default: all cities.")
    parser.add_argument("--years", type=int, default=2,
                        help="Number of years of historical data to fetch (default: 2)")
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Date range: <years> years back from today
    end_date = (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d")  # 5-day lag for archive availability
    start_date = (datetime.now() - timedelta(days=365 * args.years + 5)).strftime("%Y-%m-%d")

    print(f"\n{'='*65}")
    print(f"  SkyGuard AI - Multi-City Historical Data Fetcher")
    print(f"  Date range: {start_date} -> {end_date} ({args.years} years)")
    print(f"  Output: {OUTPUT_DIR}")
    print(f"{'='*65}\n")

    cities_to_fetch = CITIES if args.city is None else {
        args.city.lower(): CITIES[args.city.lower()]
    }

    if args.city and args.city.lower() not in CITIES:
        print(f"ERROR: City '{args.city}' not recognized. Valid cities: {list(CITIES.keys())}")
        sys.exit(1)

    results = []
    for city_key, meta in cities_to_fetch.items():
        out_path = OUTPUT_DIR / f"{city_key}_historical.csv"
        if out_path.exists():
            print(f"[SKIP] {city_key.upper()} - file already exists: {out_path.name}")
            print(f"       Delete it and re-run to force re-fetch.")
            results.append((city_key, "skipped", str(out_path)))
            continue

        try:
            df = fetch_historical(city_key, meta["lat"], meta["lon"], start_date, end_date)
            df.to_csv(out_path, index=False)
            size_mb = out_path.stat().st_size / 1e6
            print(f"  Saved: {out_path.name}  ({len(df):,} rows, {size_mb:.2f} MB)\n")
            results.append((city_key, "success", str(out_path)))
        except Exception as e:
            print(f"  FAILED for {city_key}: {e}\n")
            results.append((city_key, "failed", str(e)))

    print(f"\n{'='*65}")
    print("  Summary:")
    for city_key, status, detail in results:
        icon = "OK" if status == "success" else ("SKIP" if status == "skipped" else "FAIL")
        print(f"  {icon} {city_key.upper():12s} -> {status}")
    print(f"{'='*65}\n")
    print("Next step: Run  python scripts/train_all_cities.py")


if __name__ == "__main__":
    main()
