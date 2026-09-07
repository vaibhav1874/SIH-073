"""
SkyGuard AI - Multi-City Model Training Pipeline
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS

Trains city-specific Isolation Forest + LSTM Autoencoder models for each
Indian city using their locally-fetched historical Open-Meteo data.

Usage:
    python scripts/train_all_cities.py
    python scripts/train_all_cities.py --city delhi   # single city

Prerequisites:
    python scripts/fetch_city_data.py   (must run first)

Output per city:
    ml/saved_models/<city>/isolation_forest.joblib
    ml/saved_models/<city>/if_scaler.joblib
    ml/saved_models/<city>/if_metadata.json
    ml/saved_models/<city>/lstm_autoencoder.pt
    ml/saved_models/<city>/lstm_scaler.joblib
    ml/saved_models/<city>/lstm_metadata.json
"""

import sys
import json
import argparse
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import f1_score

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(PROJECT_ROOT))

HISTORICAL_DIR = PROJECT_ROOT / "data" / "historical"
MODELS_DIR     = PROJECT_ROOT / "ml" / "saved_models"

CITIES = ["delhi", "jaipur", "shimla", "mumbai", "bengaluru", "bhopal"]

# Minimal feature set compatible with Open-Meteo data (no injected-anomaly labels needed)
CORE_FEATURES = ["temperature", "humidity", "pressure"]

# Temporal feature columns derived in-script
ALL_FEATURES = [
    "temperature", "humidity", "pressure",
    "hour_sin", "hour_cos", "month_sin", "month_cos",
    "temp_diff_1", "humidity_diff_1", "pressure_diff_1",
    "temp_rolling_mean_3h", "temp_rolling_std_3h",
    "temp_rolling_mean_6h", "temp_rolling_std_6h",
    "humidity_rolling_mean_3h", "humidity_rolling_std_3h",
    "humidity_rolling_mean_6h", "humidity_rolling_std_6h",
    "pressure_rolling_mean_3h", "pressure_rolling_std_3h",
]

SEQUENCE_LENGTH = 12   # hours context for LSTM


# -- Dataset helpers --

def compute_features(df: pd.DataFrame) -> pd.DataFrame:
    """Compute temporal + rolling features compatible with ALL_FEATURES list."""
    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)

    # Cyclical time encoding
    hour = df["timestamp"].dt.hour + df["timestamp"].dt.minute / 60.0
    month = df["timestamp"].dt.month
    df["hour_sin"]  = np.sin(2 * np.pi * hour / 24)
    df["hour_cos"]  = np.cos(2 * np.pi * hour / 24)
    df["month_sin"] = np.sin(2 * np.pi * (month - 1) / 12)
    df["month_cos"] = np.cos(2 * np.pi * (month - 1) / 12)

    # Rate of change (1st difference)
    df["temp_diff_1"]     = df["temperature"].diff().fillna(0.0)
    df["humidity_diff_1"] = df["humidity"].diff().fillna(0.0)
    df["pressure_diff_1"] = df["pressure"].diff().fillna(0.0)

    # Rolling statistics (3h, 6h windows on hourly data)
    for col, short in [("temperature", "temp"), ("humidity", "humidity"), ("pressure", "pressure")]:
        for w, wname in [(3, "3h"), (6, "6h")]:
            df[f"{short}_rolling_mean_{wname}"] = df[col].rolling(w, min_periods=1).mean()
            df[f"{short}_rolling_std_{wname}"]  = df[col].rolling(w, min_periods=1).std().fillna(0.0)

    return df.dropna(subset=CORE_FEATURES).reset_index(drop=True)


def load_city_data(city: str):
    """Load and preprocess historical data for a city."""
    csv_path = HISTORICAL_DIR / f"{city}_historical.csv"
    if not csv_path.exists():
        raise FileNotFoundError(
            f"No data found for '{city}'. Run:  python scripts/fetch_city_data.py --city {city}"
        )
    df = pd.read_csv(csv_path)
    df = compute_features(df)
    return df


# -- Isolation Forest --

def train_isolation_forest(city: str, df: pd.DataFrame, city_models_dir: Path):
    """Train and save city-specific Isolation Forest."""
    print(f"  [IF] Training on {len(df):,} samples ({len(ALL_FEATURES)} features)...")

    feat_cols = [f for f in ALL_FEATURES if f in df.columns]
    X = df[feat_cols].to_numpy(dtype=np.float32)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # 70/30 chronological split
    split = int(len(X_scaled) * 0.70)
    X_train, X_val = X_scaled[:split], X_scaled[split:]

    model = IsolationForest(
        n_estimators=150,
        contamination=0.05,
        max_samples=0.8,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train)

    # Calibrate threshold on validation set
    raw_scores = -model.score_samples(X_val)
    thresholds = np.percentile(raw_scores, np.linspace(80, 99.5, 50))
    # Without labels, pick 95th percentile as reasonable anomaly threshold
    best_thresh = float(np.percentile(raw_scores, 95))

    joblib.dump(model, city_models_dir / "isolation_forest.joblib")
    joblib.dump(scaler, city_models_dir / "if_scaler.joblib")

    metadata = {
        "model_type": "IsolationForest",
        "city": city,
        "feature_names": feat_cols,
        "n_features": len(feat_cols),
        "threshold": best_thresh,
        "score_min": float(raw_scores.min()),
        "score_max": float(raw_scores.max()),
        "n_train_samples": split,
    }
    with open(city_models_dir / "if_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"  [IF] Done. Threshold={best_thresh:.4f}")
    return feat_cols


# -- LSTM Autoencoder --

class LSTMAutoencoder(nn.Module):
    def __init__(self, n_features: int, hidden_dim: int = 32, n_layers: int = 1):
        super().__init__()
        self.n_features = n_features
        self.hidden_dim = hidden_dim
        self.encoder = nn.LSTM(n_features, hidden_dim, n_layers, batch_first=True)
        self.decoder = nn.LSTM(hidden_dim, hidden_dim, n_layers, batch_first=True)
        self.fc = nn.Linear(hidden_dim, n_features)  # matches original Abohar LSTM

    def forward(self, x):
        _, (h, c) = self.encoder(x)
        # Repeat context vector across sequence
        dec_input = h[-1].unsqueeze(1).repeat(1, x.size(1), 1)
        dec_out, _ = self.decoder(dec_input)
        return self.fc(dec_out)


class SequenceDataset(Dataset):
    def __init__(self, data: np.ndarray, seq_len: int = SEQUENCE_LENGTH):
        self.data = torch.tensor(data, dtype=torch.float32)
        self.seq_len = seq_len

    def __len__(self):
        return max(0, len(self.data) - self.seq_len + 1)

    def __getitem__(self, idx):
        return self.data[idx: idx + self.seq_len]


def train_lstm_autoencoder(city: str, df: pd.DataFrame, city_models_dir: Path):
    """Train and save city-specific LSTM Autoencoder."""
    feat_cols = [f for f in CORE_FEATURES + ["temp_diff_1", "humidity_diff_1", "pressure_diff_1"] if f in df.columns]
    n_feat = len(feat_cols)
    print(f"  [LSTM] Training on {len(df):,} sequences  (seq_len={SEQUENCE_LENGTH}, features={n_feat})...")

    X = df[feat_cols].to_numpy(dtype=np.float32)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    split = int(len(X_scaled) * 0.80)
    X_train, X_val = X_scaled[:split], X_scaled[split:]

    train_ds = SequenceDataset(X_train, SEQUENCE_LENGTH)
    val_ds   = SequenceDataset(X_val, SEQUENCE_LENGTH)

    if len(train_ds) == 0:
        print(f"  [LSTM] Not enough data for LSTM training, skipping.")
        return

    train_loader = DataLoader(train_ds, batch_size=128, shuffle=True, num_workers=0)
    val_loader   = DataLoader(val_ds, batch_size=256, shuffle=False, num_workers=0)

    device = torch.device("cpu")
    model = LSTMAutoencoder(n_features=n_feat).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    criterion = nn.MSELoss()

    best_val_loss = float("inf")
    patience, no_improve = 5, 0
    EPOCHS = 30

    for epoch in range(1, EPOCHS + 1):
        model.train()
        train_loss = 0.0
        for batch in train_loader:
            batch = batch.to(device)
            optimizer.zero_grad()
            out = model(batch)
            loss = criterion(out, batch)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * batch.size(0)
        train_loss /= len(train_ds)

        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for batch in val_loader:
                batch = batch.to(device)
                out = model(batch)
                val_loss += criterion(out, batch).item() * batch.size(0)
        val_loss /= max(len(val_ds), 1)

        if epoch % 5 == 0 or epoch == 1:
            print(f"  [LSTM] Epoch {epoch:2d}/{EPOCHS}  train={train_loss:.4f}  val={val_loss:.4f}")

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(model.state_dict(), city_models_dir / "lstm_autoencoder.pt")
            no_improve = 0
        else:
            no_improve += 1
            if no_improve >= patience:
                print(f"  [LSTM] Early stopping at epoch {epoch}.")
                break

    # Calibrate MSE threshold on validation set
    model.load_state_dict(torch.load(city_models_dir / "lstm_autoencoder.pt", map_location="cpu"))
    model.eval()
    errors = []
    with torch.no_grad():
        for batch in val_loader:
            batch = batch.to(device)
            out = model(batch)
            mse = ((out - batch) ** 2).mean(dim=(1, 2))
            errors.extend(mse.cpu().numpy().tolist())
    lstm_threshold = float(np.percentile(errors, 95)) if errors else 0.05

    joblib.dump(scaler, city_models_dir / "lstm_scaler.joblib")
    metadata = {
        "city": city,
        "n_features": n_feat,
        "feature_names": feat_cols,
        "sequence_length": SEQUENCE_LENGTH,
        "threshold": lstm_threshold,
        "best_val_loss": best_val_loss,
        "hidden_dim": 32,
        "n_layers": 1,
    }
    with open(city_models_dir / "lstm_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"  [LSTM] Done. Threshold={lstm_threshold:.4f}  best_val={best_val_loss:.4f}")


# ── Main ─────────────────────────────────────────────────────────────────────

def train_city(city: str):
    print(f"\n{'='*60}")
    print(f"  Training models for: {city.upper()}")
    print(f"{'='*60}")

    city_models_dir = MODELS_DIR / city
    city_models_dir.mkdir(parents=True, exist_ok=True)

    try:
        df = load_city_data(city)
        print(f"  Loaded {len(df):,} records from {city}_historical.csv")

        train_isolation_forest(city, df, city_models_dir)
        train_lstm_autoencoder(city, df, city_models_dir)

        # Copy Abohar's root cause model (shared across all cities)
        abohar_dir = MODELS_DIR / "abohar"
        for fname in ["root_cause_xgb.joblib", "root_cause_metadata.json", "label_encoder.joblib"]:
            src = abohar_dir / fname
            dst = city_models_dir / fname
            if src.exists() and not dst.exists():
                import shutil
                shutil.copy2(src, dst)

        print(f"\n  ✓ {city.upper()} models saved to: {city_models_dir}\n")
        return True

    except FileNotFoundError as e:
        print(f"\n  ✗ SKIP: {e}\n")
        return False
    except Exception as e:
        print(f"\n  ✗ ERROR training {city}: {e}\n")
        import traceback
        traceback.print_exc()
        return False


def main():
    parser = argparse.ArgumentParser(description="SkyGuard AI - Train city-specific ML models")
    parser.add_argument("--city", type=str, default=None,
                        help="Train only a specific city. Default: all cities.")
    args = parser.parse_args()

    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"  SkyGuard AI — Multi-City Model Training")
    print(f"  Models dir: {MODELS_DIR}")
    print(f"{'='*60}")

    cities = [args.city.lower()] if args.city else CITIES

    results = {}
    for city in cities:
        results[city] = train_city(city)

    print(f"\n{'='*60}")
    print("  Final Summary:")
    for city, ok in results.items():
        icon = "✓" if ok else "✗"
        print(f"  {icon} {city.upper()}")
    print(f"{'='*60}\n")
    print("Next step: Restart the backend server to pick up new city models.")


if __name__ == "__main__":
    main()
