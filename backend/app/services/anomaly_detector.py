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

MODELS_DIR = PROJECT_ROOT / "ml" / "saved_models"


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

        self._load_models()

    def _load_models(self):
        # 1. Isolation Forest
        if_path = MODELS_DIR / "isolation_forest.joblib"
        if_scaler_path = MODELS_DIR / "if_scaler.joblib"
        if_meta_path = MODELS_DIR / "if_metadata.json"
        if if_path.exists() and if_scaler_path.exists():
            self.if_model = joblib.load(if_path)
            self.if_scaler = joblib.load(if_scaler_path)
            if if_meta_path.exists():
                with open(if_meta_path, "r") as f:
                    meta = json.load(f)
                self.if_threshold = meta.get("threshold", 0.50)
                self.if_score_min = meta.get("score_min", 0.0)
                self.if_score_max = meta.get("score_max", 1.0)
            print("[AnomalyDetector] Loaded Isolation Forest model & scaler.")

        # 2. LSTM Autoencoder
        lstm_path = MODELS_DIR / "lstm_autoencoder.pt"
        lstm_scaler_path = MODELS_DIR / "lstm_scaler.joblib"
        lstm_meta_path = MODELS_DIR / "lstm_metadata.json"
        if lstm_path.exists() and lstm_scaler_path.exists():
            self.lstm_scaler = joblib.load(lstm_scaler_path)
            self.lstm_model = LSTMAutoencoder(n_features=len(CORE_FEATURES), hidden_dim=32)
            self.lstm_model.load_state_dict(torch.load(lstm_path, map_location=self.device))
            self.lstm_model.eval()
            if lstm_meta_path.exists():
                with open(lstm_meta_path, "r") as f:
                    meta = json.load(f)
                self.lstm_threshold = meta.get("threshold", 0.50)
            print("[AnomalyDetector] Loaded PyTorch LSTM Autoencoder.")

        # 3. XGBoost Root Cause Classifier
        xgb_path = MODELS_DIR / "root_cause_xgb.joblib"
        enc_path = MODELS_DIR / "label_encoder.joblib"
        if xgb_path.exists() and enc_path.exists():
            self.xgb_model = joblib.load(xgb_path)
            self.label_encoder = joblib.load(enc_path)
            print("[AnomalyDetector] Loaded XGBoost root cause classifier.")

    def process_reading(self, telemetry: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes full real-time anomaly detection pipeline on an incoming AWS telemetry packet.
        """
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

        # Vector of 40 features
        feature_vector = np.array([[features_dict[f] for f in FEATURE_NAMES]], dtype=np.float32)

        # 3. Isolation Forest Evaluation
        if_score = 0.0
        if_flag = False
        if self.if_model is not None and self.if_scaler is not None:
            X_scaled = self.if_scaler.transform(feature_vector)
            raw_score = -float(self.if_model.score_samples(X_scaled)[0])
            # Normalize to [0, 1]
            denom = max(1e-6, self.if_score_max - self.if_score_min)
            if_score = float(np.clip((raw_score - self.if_score_min) / denom, 0.0, 1.0))
            if_flag = raw_score >= self.if_threshold

        # 4. LSTM Autoencoder Evaluation
        lstm_score = 0.0
        lstm_flag = False
        if self.lstm_model is not None and self.lstm_scaler is not None and len(buffer) >= SEQUENCE_LENGTH:
            # Prepare sequence of length SEQUENCE_LENGTH
            sub_buf = pd.DataFrame(buffer[-SEQUENCE_LENGTH:])
            sub_buf["timestamp"] = pd.to_datetime(sub_buf["timestamp"])
            from ml.feature_engineering.features import compute_features
            sub_feat = compute_features(sub_buf)
            raw_core = sub_feat[CORE_FEATURES].to_numpy(dtype=np.float32)
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

        # 6. XGBoost Root Cause Classification
        root_cause = "normal"
        root_cause_probs = {}
        if is_anomaly and self.xgb_model is not None and self.label_encoder is not None:
            probs = self.xgb_model.predict_proba(feature_vector)[0]
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
        if not affected_sensors and is_anomaly:
            # Infer from root cause or largest Z-scores
            if "temp" in root_cause:
                affected_sensors.append("temperature")
            elif "humidity" in root_cause:
                affected_sensors.append("humidity")
            elif "pressure" in root_cause:
                affected_sensors.append("pressure")
            else:
                z_map = {
                    "temperature": abs(features_dict.get("temp_zscore_24h", 0.0)),
                    "humidity": abs(features_dict.get("humidity_zscore_24h", 0.0)),
                    "pressure": abs(features_dict.get("pressure_zscore_24h", 0.0)),
                }
                max_s = max(z_map, key=z_map.get)
                affected_sensors.append(max_s)

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
