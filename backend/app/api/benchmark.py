"""
SkyGuard AI - Model Benchmark API Endpoints
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS
"""

import json
from pathlib import Path
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/benchmark", tags=["Benchmark"])

PROJECT_ROOT = Path(__file__).resolve().parents[3]
BENCHMARK_FILE = PROJECT_ROOT / "data" / "metadata" / "benchmark_comparison.json"
ROOT_CAUSE_FILE = PROJECT_ROOT / "ml" / "saved_models" / "root_cause_metadata.json"


@router.get("")
async def get_benchmark_comparison():
    """Returns comparative offline benchmark performance for all models."""
    if not BENCHMARK_FILE.exists():
        raise HTTPException(status_code=404, detail="Benchmark metrics file not generated yet")

    with open(BENCHMARK_FILE, "r") as f:
        benchmark_data = json.load(f)

    root_cause_info = {}
    if ROOT_CAUSE_FILE.exists():
        with open(ROOT_CAUSE_FILE, "r") as f:
            root_cause_info = json.load(f)

    return {
        "models": benchmark_data,
        "root_cause_model": root_cause_info,
    }
