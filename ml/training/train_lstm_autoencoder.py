"""
SkyGuard AI - LSTM Autoencoder Training Pipeline (PyTorch)
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS

Trains temporal deep learning reconstruction model:
- Learns normal temporal dynamics from clean sensor sequence windows
- Anomalies exhibit high reconstruction error (MSE)
- Calibrates optimal MSE threshold on validation split

Saves:
- ml/saved_models/lstm_autoencoder.pt
- ml/saved_models/lstm_scaler.joblib
- ml/saved_models/lstm_metadata.json
"""

import sys
import json
from pathlib import Path
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import f1_score, precision_score, recall_score, roc_auc_score
import joblib

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SPLITS_DIR = PROJECT_ROOT / "data" / "splits"
MODELS_DIR = PROJECT_ROOT / "ml" / "saved_models"
MODEL_FILE = MODELS_DIR / "lstm_autoencoder.pt"
SCALER_FILE = MODELS_DIR / "lstm_scaler.joblib"
METADATA_FILE = MODELS_DIR / "lstm_metadata.json"

SEQUENCE_LENGTH = 12  # 12-hour sliding context window
CORE_FEATURES = [
    "temperature", "humidity", "pressure",
    "temp_diff_1", "humidity_diff_1", "pressure_diff_1",
]


class WeatherSequenceDataset(Dataset):
    def __init__(self, data: np.ndarray, seq_len: int = SEQUENCE_LENGTH):
        self.data = torch.tensor(data, dtype=torch.float32)
        self.seq_len = seq_len

    def __len__(self):
        return len(self.data) - self.seq_len + 1

    def __getitem__(self, idx):
        return self.data[idx : idx + self.seq_len]


class LSTMAutoencoder(nn.Module):
    def __init__(self, n_features: int, hidden_dim: int = 32, num_layers: int = 1):
        super().__init__()
        self.n_features = n_features
        self.hidden_dim = hidden_dim

        # Encoder
        self.encoder = nn.LSTM(
            input_size=n_features,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
        )

        # Decoder
        self.decoder = nn.LSTM(
            input_size=hidden_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
        )

        # Output projection back to feature dimension
        self.fc = nn.Linear(hidden_dim, n_features)

    def forward(self, x):
        # x shape: (batch, seq_len, n_features)
        batch_size, seq_len, _ = x.shape

        # Encode: get final hidden state
        _, (h_n, _) = self.encoder(x)
        # h_n shape: (num_layers, batch, hidden_dim)
        bottleneck = h_n[-1]  # (batch, hidden_dim)

        # Repeat bottleneck vector across sequence length for decoder
        rep = bottleneck.unsqueeze(1).repeat(1, seq_len, 1)  # (batch, seq_len, hidden_dim)

        # Decode
        dec_out, _ = self.decoder(rep)
        reconstruction = self.fc(dec_out)  # (batch, seq_len, n_features)
        return reconstruction


def create_sequences(arr: np.ndarray, seq_len: int = SEQUENCE_LENGTH) -> np.ndarray:
    n_samples = len(arr) - seq_len + 1
    shape = (n_samples, seq_len, arr.shape[1])
    strides = (arr.strides[0], arr.strides[0], arr.strides[1])
    return np.lib.stride_tricks.as_strided(arr, shape=shape, strides=strides)


def main():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    train_clean_file = SPLITS_DIR / "train_clean.csv"
    val_file = SPLITS_DIR / "val.csv"
    test_file = SPLITS_DIR / "test.csv"

    if not train_clean_file.exists() or not val_file.exists():
        print(f"Error: Required splits not found in {SPLITS_DIR}. Run ml/training/split.py first.")
        sys.exit(1)

    print(f"Loading clean training data from: {train_clean_file}")
    df_train = pd.read_csv(train_clean_file)
    X_train_raw = df_train[CORE_FEATURES].to_numpy(dtype=np.float32)

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train_raw)

    train_dataset = WeatherSequenceDataset(X_train_scaled, seq_len=SEQUENCE_LENGTH)
    train_loader = DataLoader(train_dataset, batch_size=256, shuffle=True, drop_last=True)

    n_features = len(CORE_FEATURES)
    model = LSTMAutoencoder(n_features=n_features, hidden_dim=32).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-5)
    criterion = nn.MSELoss()

    epochs = 5
    print(f"Training LSTM Autoencoder for {epochs} epochs on {len(train_dataset):,} sequences...")
    model.train()
    for epoch in range(1, epochs + 1):
        total_loss = 0.0
        count = 0
        for batch in train_loader:
            batch = batch.to(device)
            optimizer.zero_grad()
            recon = model(batch)
            loss = criterion(recon, batch)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * len(batch)
            count += len(batch)
        avg_loss = total_loss / count
        print(f"  Epoch {epoch}/{epochs} - Reconstruction Loss (MSE): {avg_loss:.6f}")

    # Evaluate on validation set
    print("Evaluating reconstruction errors on validation set...")
    df_val = pd.read_csv(val_file)
    X_val_scaled = scaler.transform(df_val[CORE_FEATURES].to_numpy(dtype=np.float32))
    val_seqs = create_sequences(X_val_scaled, SEQUENCE_LENGTH)
    # Target label: anomaly at the current (last) step of sequence
    y_val = df_val["is_anomaly"].to_numpy(dtype=int)[SEQUENCE_LENGTH - 1 :]

    model.eval()
    val_errors = []
    with torch.no_grad():
        val_loader = DataLoader(val_seqs, batch_size=512, shuffle=False)
        for batch in val_loader:
            batch = batch.to(device)
            recon = model(batch)
            # MSE on the most recent step in sequence (batch[:, -1, :])
            step_mse = torch.mean((recon[:, -1, :] - batch[:, -1, :]) ** 2, dim=1)
            val_errors.extend(step_mse.cpu().numpy().tolist())

    val_errors = np.array(val_errors, dtype=np.float32)

    # Threshold calibration
    candidate_thresholds = np.percentile(val_errors, np.linspace(80, 99.5, 50))
    best_f1, best_thresh = -1.0, float(np.median(candidate_thresholds))
    for th in candidate_thresholds:
        preds = (val_errors >= th).astype(int)
        f1 = f1_score(y_val, preds, zero_division=0)
        if f1 > best_f1:
            best_f1 = f1
            best_thresh = float(th)

    val_preds = (val_errors >= best_thresh).astype(int)
    val_prec = precision_score(y_val, val_preds, zero_division=0)
    val_rec = recall_score(y_val, val_preds, zero_division=0)
    val_auc = roc_auc_score(y_val, val_errors)

    print(f"\nOptimal Reconstruction Threshold: {best_thresh:.6f}")
    print(f"Validation F1-Score:   {best_f1:.4f}")
    print(f"Validation Precision:  {val_prec:.4f}")
    print(f"Validation Recall:     {val_rec:.4f}")
    print(f"Validation ROC-AUC:    {val_auc:.4f}")

    # Evaluate on test set
    df_test = pd.read_csv(test_file)
    X_test_scaled = scaler.transform(df_test[CORE_FEATURES].to_numpy(dtype=np.float32))
    test_seqs = create_sequences(X_test_scaled, SEQUENCE_LENGTH)
    y_test = df_test["is_anomaly"].to_numpy(dtype=int)[SEQUENCE_LENGTH - 1 :]

    test_errors = []
    with torch.no_grad():
        test_loader = DataLoader(test_seqs, batch_size=512, shuffle=False)
        for batch in test_loader:
            batch = batch.to(device)
            recon = model(batch)
            step_mse = torch.mean((recon[:, -1, :] - batch[:, -1, :]) ** 2, dim=1)
            test_errors.extend(step_mse.cpu().numpy().tolist())

    test_errors = np.array(test_errors, dtype=np.float32)
    test_preds = (test_errors >= best_thresh).astype(int)
    test_f1 = f1_score(y_test, test_preds, zero_division=0)
    test_prec = precision_score(y_test, test_preds, zero_division=0)
    test_rec = recall_score(y_test, test_preds, zero_division=0)
    test_auc = roc_auc_score(y_test, test_errors)

    print(f"\nTest Benchmark Performance:")
    print(f"Test F1-Score:   {test_f1:.4f}")
    print(f"Test Precision:  {test_prec:.4f}")
    print(f"Test Recall:     {test_rec:.4f}")
    print(f"Test ROC-AUC:    {test_auc:.4f}")

    # Save PyTorch weights
    print(f"Saving model weights to {MODEL_FILE}...")
    torch.save(model.state_dict(), MODEL_FILE)
    print(f"Saving scaler to {SCALER_FILE}...")
    joblib.dump(scaler, SCALER_FILE)

    metadata = {
        "model_type": "LSTMAutoencoder",
        "sequence_length": SEQUENCE_LENGTH,
        "features": CORE_FEATURES,
        "n_features": n_features,
        "hidden_dim": 32,
        "threshold": float(best_thresh),
        "validation_metrics": {
            "f1": float(best_f1),
            "precision": float(val_prec),
            "recall": float(val_rec),
            "roc_auc": float(val_auc),
        },
        "test_metrics": {
            "f1": float(test_f1),
            "precision": float(test_prec),
            "recall": float(test_rec),
            "roc_auc": float(test_auc),
        },
    }

    with open(METADATA_FILE, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"Saved metadata to {METADATA_FILE}")
    print("LSTM Autoencoder training pipeline completed successfully!")


if __name__ == "__main__":
    main()
