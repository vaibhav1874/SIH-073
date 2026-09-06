# SkyGuard AI 🌤️

**SIH26073 — AI/ML-Based Intelligent Anomaly Detection for Automatic Weather Stations**

> Ministry of Earth Sciences (MoES) / India Meteorological Department (IMD)
> Smart India Hackathon 2026 | Theme: Disaster Management

---

## Overview

SkyGuard AI is a full-stack, real-time anomaly detection and sensor health monitoring system for Automatic Weather Stations (AWS). It detects sensor faults in **temperature**, **atmospheric pressure**, and **relative humidity** readings using a hybrid AI/ML pipeline.

> **Note:** This system uses real historical weather observations (Abohar, 2010–2024) as the base dataset and controlled synthetic sensor faults to create labelled anomaly scenarios. The pipeline is designed to accept AWS-compatible streaming observations and can be connected to authorized operational AWS data in the future.

---

## Features

- **Real-time anomaly detection** — spikes, frozen sensors, drift, missing data, multivariate inconsistencies
- **Hybrid ML ensemble** — Rule Engine + Isolation Forest + LSTM Autoencoder
- **Root cause classification** — XGBoost multi-class classifier
- **SHAP explainability** — human-readable evidence for every alert
- **Kalman filter correction** — scientifically sound expected-value estimation
- **Sensor health scoring** — per-sensor, per-station, 0–100 scale
- **Degradation detection** — trend-based early warning
- **Live dashboard** — React + Vite + TailwindCSS + Recharts + Leaflet
- **Fault injection UI** — inject any fault type from the browser
- **Model comparison** — Rule vs IF vs LSTM vs Hybrid
- **Docker Compose** — one-command startup

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11, FastAPI, SQLAlchemy async |
| ML | scikit-learn (IF), PyTorch (LSTM-AE), XGBoost, SHAP, FilterPy |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Frontend | React 18, Vite, TypeScript, TailwindCSS v3, Recharts, Framer Motion, Leaflet |
| Containers | Docker Compose |

---

## Project Structure

```
skyguard-ai/
├── backend/          # FastAPI backend + ML pipeline services
├── ml/               # Offline ML pipeline (preprocessing → training → evaluation)
├── data/             # Dataset directories (raw CSV not committed)
├── simulator/        # AWS streaming simulator + fault injector
├── frontend/         # React dashboard
├── models/           # Trained model artifacts
├── tests/            # Pytest test suite
└── notebooks/        # EDA notebooks
```

---

## Dataset

- **Source:** Abohar historical weather data (Open-Meteo ERA5, hourly)
- **Period:** 2010-01-01 → 2024-02-20
- **Rows:** 123,936 hourly observations
- **Variables used:** `temperature_2m`, `relative_humidity_2m`, `pressure_msl`

Place `Abohar.csv` in `data/raw/` before running the pipeline.

---

## Quick Start

### 1. Prerequisites
```bash
Python 3.11+
Node.js 18+
Docker Desktop (optional)
```

### 2. Setup Backend
```bash
cd backend
pip install -r requirements.txt
cp ../.env.example .env
uvicorn app.main:app --reload
```

### 3. Run ML Pipeline (first time)
```bash
# Preprocess
py ml/preprocessing/preprocess.py

# Feature engineering + injection
py ml/anomaly_injection/injector.py

# Train models
py ml/training/train_isolation_forest.py
py ml/training/train_lstm_autoencoder.py
py ml/training/train_root_cause.py
```

### 4. Setup Frontend
```bash
cd frontend
npm install
npm run dev
```

### 5. Start Simulator
```bash
py simulator/aws_simulator.py
```

### 6. Docker (all-in-one)
```bash
docker-compose up --build
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | System health check |
| GET | `/stations` | List all stations |
| GET | `/stations/{id}` | Station details |
| GET | `/anomalies` | Recent anomalies |
| GET | `/anomalies/{id}` | Full anomaly detail |
| GET | `/sensor-health/{id}` | Health scores |
| GET | `/metrics` | Model evaluation metrics |
| POST | `/simulate/anomaly` | Inject fault |
| WS | `/ws/live` | Live data stream |

Full Swagger UI available at `http://localhost:8000/docs`

---

## ML Architecture

```
Incoming Observation
        │
   Preprocessor
        │
 Feature Engineer  (40 features)
        │
   ┌────┴────────────────────┐
   │    3-Arm Detection      │
   │  Rules  IF  LSTM-AE     │
   │  35%   35%   30%        │
   └────┬────────────────────┘
        │ Weighted Ensemble Score (0-100)
   Root Cause (XGBoost)
        │
   Severity + Confidence
        │
   SHAP Explainability
        │
   Kalman Corrector
        │
   Health Score Update
        │
   DB + WebSocket Broadcast
```

---

## Anomaly Types Detected

| Type | Description |
|---|---|
| `temperature_spike` | Sudden extreme temperature change |
| `humidity_spike` | Sudden extreme humidity change |
| `pressure_spike` | Sudden extreme pressure change |
| `frozen_sensor` | Sensor stuck at constant value |
| `sensor_drift` | Gradual systematic deviation |
| `communication_failure` | Missing/NaN data sequence |
| `multivariate_inconsistency` | One sensor anomalous, others stable |

---

## Team

Smart India Hackathon 2026 — SIH26073

---

## License

For educational and hackathon purposes only.
