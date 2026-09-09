"""
SkyGuard AI - Unified Real-Time Anomaly Detection Engine
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS

Integrates:
- Physical Rule Engine (deterministic meteorological bounds & rates)
- Isolation Forest (40-feature unsupervised density outlier detection)
- PyTorch LSTM Autoencoder (temporal reconstruction error)
- Weighted Ensemble Score = 0.35 * Rule + 0.35 * IF + 0.30 * LSTM
- XGBoost Multi-Class Root Cause Classifier
- Kalman Filter Imputation & Correction
- Severity Level Assessment & Operational IMD Response
- Transparent Anomaly Explainer
"""

import sys
import json
import time
from pathlib import Path
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
import joblib
import torch

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.append(str(PROJECT_ROOT))

from ml.feature_engineering.features import FEATURE_NAMES, compute_features_for_buffer
from ml.training.train_lstm_autoencoder import LSTMAutoencoder, CORE_FEATURES, SEQUENCE_LENGTH
from backend.app.services.rule_engine import rule_engine
from backend.app.services.corrector import sensor_corrector
from backend.app.services.severity import severity_engine
from backend.app.services.explanation import anomaly_explainer
from backend.app.services.health_score import sensor_health_tracker

# Restrict PyTorch thread count to save memory on low-RAM containers (Render 512MB)
try:
    torch.set_num_threads(1)
except Exception:
    pass

MODELS_DIR = PROJECT_ROOT / "ml" / "saved_models"
DEFAULT_CITY = "abohar"


class AnomalyDetector:
    def __init__(self):
        self.device = torch.device("cpu")
        self.if_model = None
        self.if_scaler = None
        self.if_threshold = 0.50
        self.if_score_min = 0.0
        self.if_score_max = 1.0

        self.lstm_model = None
        self.lstm_scaler = None
        self.lstm_threshold = 0.50

        self.xgb_model = None
        self.label_encoder = None

        # In-memory circular buffer of readings per station for rolling feature calculation
        # station_id -> list of telemetry dicts
        self.buffers: Dict[str, List[Dict[str, Any]]] = {}

        # Track which city's models are currently loaded
        self._active_city: str = DEFAULT_CITY
        self._models_loaded: bool = False

    def ensure_models_loaded(self):
        """Lazy loader: loads models only when first telemetry request is processed."""
        if not self._models_loaded:
            self.load_models_for_city(self._active_city)

    def _load_models_for_city(self, city: str):
        """Load city-specific ML models from ml/saved_models/<city>/.
        Falls back to Abohar models if city-specific models don't exist yet."""
        city = city.strip().lower()

        # Prefer city-specific subfolder; fall back to legacy flat layout (abohar)
        city_dir = MODELS_DIR / city
        fallback_dir = MODELS_DIR / DEFAULT_CITY

        def resolve(filename: str) -> Path:
            """Return city-specific path if it exists, else fallback to abohar or flat legacy."""
            city_path = city_dir / filename
            if city_path.exists():
                return city_path
            fallback_path = fallback_dir / filename
            if fallback_path.exists():
                return fallback_path
            # Legacy flat layout (original placement before multi-city)
            return MODELS_DIR / filename

        print(f"[AnomalyDetector] Loading models for city: {city.upper()}...")

        # Explicitly release previous city model tensors from memory
        self.if_model = None
        self.if_scaler = None
        self.lstm_model = None
        self.lstm_scaler = None
        import gc
        gc.collect()

        self.if_feature_names = FEATURE_NAMES
        self.lstm_feature_names = CORE_FEATURES

        # 1. Isolation Forest
        if_path        = resolve("isolation_forest.joblib")
        if_scaler_path = resolve("if_scaler.joblib")
        if_meta_path   = resolve("if_metadata.json")
        if if_path.exists() and if_scaler_path.exists():
            self.if_model = joblib.load(if_path)
            self.if_scaler = joblib.load(if_scaler_path)
            if if_meta_path.exists():
                with open(if_meta_path, "r") as f:
                    meta = json.load(f)
                self.if_threshold  = meta.get("threshold", 0.50)
                self.if_score_min  = meta.get("score_min", 0.0)
                self.if_score_max  = meta.get("score_max", 1.0)
                self.if_feature_names = meta.get("feature_names", FEATURE_NAMES)
            print(f"[AnomalyDetector] Loaded IF model from: {if_path.parent.name}/ ({len(self.if_feature_names)} features)")

        # 2. LSTM Autoencoder
        lstm_path        = resolve("lstm_autoencoder.pt")
        lstm_scaler_path = resolve("lstm_scaler.joblib")
        lstm_meta_path   = resolve("lstm_metadata.json")
        if lstm_path.exists() and lstm_scaler_path.exists():
            self.lstm_scaler = joblib.load(lstm_scaler_path)
            # Read architecture params from metadata to ensure correct model reconstruction
            n_feat = len(CORE_FEATURES)
            hidden_dim = 32
            n_layers = 1
            if lstm_meta_path.exists():
                with open(lstm_meta_path, "r") as f:
                    meta = json.load(f)
                n_feat = meta.get("n_features", n_feat)
                hidden_dim = meta.get("hidden_dim", hidden_dim)
                n_layers = meta.get("n_layers", n_layers)
                self.lstm_threshold = meta.get("threshold", 0.50)
                self.lstm_feature_names = meta.get("feature_names", CORE_FEATURES)
            self.lstm_model = LSTMAutoencoder(n_features=n_feat, hidden_dim=hidden_dim, num_layers=n_layers)
            self.lstm_model.load_state_dict(torch.load(lstm_path, map_location=self.device))
            self.lstm_model.eval()
            print(f"[AnomalyDetector] Loaded LSTM model from: {lstm_path.parent.name}/")

        # 3. XGBoost Root Cause Classifier (always use abohar's shared model)
        xgb_path = resolve("root_cause_xgb.joblib")
        enc_path = resolve("label_encoder.joblib")
        if xgb_path.exists() and enc_path.exists():
            self.xgb_model = joblib.load(xgb_path)
            self.label_encoder = joblib.load(enc_path)
            print(f"[AnomalyDetector] Loaded XGBoost root cause classifier.")

        self._active_city = city
        print(f"[AnomalyDetector] [OK] Active city: {city.upper()}")

    def load_models_for_city(self, city: str):
        """Public method — called by simulator API on city/mode switch.
        No-op if the same city is already loaded."""
        city = city.strip().lower()
        if city == self._active_city and self._models_loaded:
            return
        self._load_models_for_city(city)
        self._models_loaded = True

    def process_reading(self, telemetry: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes full real-time anomaly detection pipeline on an incoming AWS telemetry packet.
        """
        self.ensure_models_loaded()
        start_time = time.perf_counter()
        station_id = telemetry.get("station_id", "ABOHAR")

        if station_id not in self.buffers:
            self.buffers[station_id] = []

        buffer = self.buffers[station_id]



        buffer.append(telemetry)
        # Retain last 30 samples for rolling statistics
        if len(buffer) > 30:
            buffer.pop(0)

        prev_reading = buffer[-2] if len(buffer) >= 2 else None

        # 1. Rule Engine Evaluation
        rule_res = rule_engine.evaluate(
            current=telemetry,
            previous=prev_reading,
            history_window=buffer,
        )

        # 2. Feature Extraction
        # If buffer is too small (<5), use basic defaults
        if len(buffer) >= 2:
            buf_df = pd.DataFrame(buffer)
            # Ensure timestamp is datetime
            buf_df["timestamp"] = pd.to_datetime(buf_df["timestamp"])
            features_dict = compute_features_for_buffer(buf_df)
        else:
            # Fallback simple features
            features_dict = {f: float(telemetry.get(f, 0.0)) if f in telemetry else 0.0 for f in FEATURE_NAMES}

        # Vector of 40 features (used for XGBoost & explanation)
        xgb_feature_vector = np.array([[features_dict.get(f, 0.0) for f in FEATURE_NAMES]], dtype=np.float32)

        # 3. Isolation Forest Evaluation (uses city-specific features)
        if_cols = getattr(self, "if_feature_names", FEATURE_NAMES)
        if_feature_vector = np.array([[features_dict.get(f, 0.0) for f in if_cols]], dtype=np.float32)

        if_score = 0.0
        if_flag = False
        if self.if_model is not None and self.if_scaler is not None:
            X_scaled = self.if_scaler.transform(if_feature_vector)
            raw_score = -float(self.if_model.score_samples(X_scaled)[0])
            # Normalize to [0, 1]
            denom = max(1e-6, self.if_score_max - self.if_score_min)
            if_score = float(np.clip((raw_score - self.if_score_min) / denom, 0.0, 1.0))
            if_flag = raw_score >= self.if_threshold

        # 4. LSTM Autoencoder Evaluation
        lstm_score = 0.0
        lstm_flag = False
        lstm_cols = getattr(self, "lstm_feature_names", CORE_FEATURES)
        if self.lstm_model is not None and self.lstm_scaler is not None and len(buffer) >= SEQUENCE_LENGTH:
            # Prepare sequence of length SEQUENCE_LENGTH
            sub_buf = pd.DataFrame(buffer[-SEQUENCE_LENGTH:])
            sub_buf["timestamp"] = pd.to_datetime(sub_buf["timestamp"])
            from ml.feature_engineering.features import compute_features
            sub_feat = compute_features(sub_buf)
            raw_core = sub_feat[lstm_cols].to_numpy(dtype=np.float32)
            scaled_core = self.lstm_scaler.transform(raw_core)
            seq_tensor = torch.tensor(scaled_core[np.newaxis, :, :], dtype=torch.float32).to(self.device)

            with torch.no_grad():
                recon = self.lstm_model(seq_tensor)
                step_mse = float(torch.mean((recon[:, -1, :] - seq_tensor[:, -1, :]) ** 2).item())
                lstm_score = min(1.0, step_mse / max(1e-6, self.lstm_threshold * 2.0))
                lstm_flag = step_mse >= self.lstm_threshold

        # 5. SkyGuard Weighted Ensemble
        rule_score = rule_res["rule_score"]
        # Formula: 35% Rules + 35% IF + 30% LSTM
        ensemble_score = float(np.clip(
            0.35 * rule_score + 0.35 * if_score + 0.30 * lstm_score,
            0.0, 1.0
        ))

        # Overall anomaly decision:
        # Triggered if rule violated OR ensemble exceeds threshold (0.55) OR both ML models flag it
        is_anomaly = bool(rule_res["is_violation"] or ensemble_score >= 0.55 or (if_flag and lstm_flag))

        # Baseline stabilization safeguard: after regime switch or cold start (<= 2 readings),
        # require baseline to stabilize to prevent false rate-of-change flags
        if len(buffer) <= 2:
            is_anomaly = False
            ensemble_score = min(ensemble_score, 0.08)
            rule_score = 0.0

        # 6. XGBoost Root Cause Classification
        root_cause = "normal"
        root_cause_probs = {}
        if is_anomaly and self.xgb_model is not None and self.label_encoder is not None:
            probs = self.xgb_model.predict_proba(xgb_feature_vector)[0]
            classes = self.label_encoder.classes_
            root_cause_probs = {c: round(float(p), 4) for c, p in zip(classes, probs)}

            # Pick highest non-normal class if overall is_anomaly
            sorted_classes = sorted(root_cause_probs.items(), key=lambda x: x[1], reverse=True)
            for c_name, c_prob in sorted_classes:
                if c_name != "normal":
                    root_cause = c_name
                    break
        elif not is_anomaly:
            root_cause = "normal"

        # 7. Identify Affected Sensors
        affected_sensors = list(set(rule_res["affected_sensors"]))

        # Hard physical boundary checks (guarantee anomalous sensor is flagged even if classifier labels general fault)
        if telemetry.get("temperature") is not None and (telemetry["temperature"] > 50.0 or telemetry["temperature"] < -10.0):
            affected_sensors.append("temperature")
        if telemetry.get("humidity") is not None and (telemetry["humidity"] > 100.0 or telemetry["humidity"] < 0.0):
            affected_sensors.append("humidity")
        if telemetry.get("pressure") is not None and (telemetry["pressure"] > 1080.0 or telemetry["pressure"] < 900.0):
            affected_sensors.append("pressure")

        if is_anomaly:
            if root_cause == "communication_failure":
                affected_sensors.extend(["temperature", "humidity", "pressure"])
            elif root_cause == "multivariate_inconsistency":
                affected_sensors.extend(["temperature", "humidity"])
            elif "temp" in root_cause or root_cause in ["sensor_drift", "frozen_sensor"]:
                affected_sensors.append("temperature")
            elif "humidity" in root_cause:
                affected_sensors.append("humidity")
            elif "pressure" in root_cause:
                affected_sensors.append("pressure")
            elif not affected_sensors:
                z_map = {
                    "temperature": abs(features_dict.get("temp_zscore_24h", 0.0)),
                    "humidity": abs(features_dict.get("humidity_zscore_24h", 0.0)),
                    "pressure": abs(features_dict.get("pressure_zscore_24h", 0.0)),
                }
                max_s = max(z_map, key=z_map.get)
                affected_sensors.append(max_s)

        affected_sensors = list(set(affected_sensors))

        # 8. Severity Assessment
        severity_info = severity_engine.assess_severity(
            ensemble_score=ensemble_score,
            root_cause=root_cause,
            affected_sensors=affected_sensors,
            rule_severity=rule_res.get("rule_severity", "none"),
        )

        # 9. Explainability
        explanation = anomaly_explainer.explain(
            telemetry=telemetry,
            features=features_dict,
            rule_result=rule_res,
            root_cause=root_cause,
            ensemble_score=ensemble_score,
            affected_sensors=affected_sensors,
        )

        # 10. Kalman Filter Imputation & Correction
        corrected_values = sensor_corrector.correct_telemetry(
            station_id=station_id,
            telemetry=telemetry,
            is_anomaly=is_anomaly,
            affected_sensors=affected_sensors,
        )

        # 11. Sensor & Station Health Index Update
        health_info = sensor_health_tracker.update(
            station_id=station_id,
            is_anomaly=is_anomaly,
            root_cause=root_cause,
            affected_sensors=affected_sensors,
            severity=severity_info["severity"],
        )

        latency_ms = round((time.perf_counter() - start_time) * 1000.0, 2)

        return {
            "station_id": station_id,
            "timestamp": telemetry.get("timestamp"),
            "is_anomaly": is_anomaly,
            "ensemble_score": round(ensemble_score, 3),
            "root_cause": root_cause,
            "affected_sensors": affected_sensors,
            "severity": severity_info["severity"],
            "protocol": severity_info,
            "raw_readings": {
                "temperature": telemetry.get("temperature"),
                "humidity": telemetry.get("humidity"),
                "pressure": telemetry.get("pressure"),
            },
            "corrected_readings": corrected_values,
            "model_breakdown": {
                "rule_engine": {
                    "violation": rule_res["is_violation"],
                    "score": rule_score,
                    "rules": rule_res["violated_rules"],
                },
                "isolation_forest": {
                    "flag": if_flag,
                    "score": round(if_score, 3),
                },
                "lstm_autoencoder": {
                    "flag": lstm_flag,
                    "score": round(lstm_score, 3),
                },
                "ensemble_weights": {"rules": 0.35, "isolation_forest": 0.35, "lstm": 0.30},
            },
            "root_cause_probabilities": root_cause_probs,
            "explanation": explanation,
            "health": health_info,
            "latency_ms": latency_ms,
        }


# Global singleton instance
anomaly_detector = AnomalyDetector()
