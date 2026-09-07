"""
SkyGuard AI - Dynamic Simulator Mode Controller API
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import delete

from backend.app.services.anomaly_detector import anomaly_detector
from backend.app.services.corrector import sensor_corrector
from backend.app.database.session import AsyncSessionLocal
from backend.app.db_models.models import TelemetryReading, AnomalyAlert
from backend.app.api.websocket import ws_manager

router = APIRouter(tags=["Simulator Controller"])

class SimulatorModeRequest(BaseModel):
    mode: str  # "replay" or "live"
    city: Optional[str] = "abohar"

# Global runtime state for the simulator
simulator_state = {
    "mode": "live",
    "city": "abohar"
}

@router.get("/api/simulator/mode")
async def get_simulator_mode():
    """Returns current active simulator mode and target location."""
    return simulator_state

@router.post("/api/simulator/mode")
async def set_simulator_mode(payload: SimulatorModeRequest):
    """Dynamically switches simulator mode between historical replay and real-time live weather."""
    mode = payload.mode.lower()
    mode_changed = mode in ["replay", "live"] and mode != simulator_state["mode"]
    city_changed = payload.city is not None and payload.city.strip().lower() != simulator_state["city"]

    if mode in ["replay", "live"]:
        simulator_state["mode"] = mode
    if payload.city:
        simulator_state["city"] = payload.city.strip().lower()
    
    # If mode or city changed, clear historical pipeline state to prevent spurious rate-of-change spikes
    if mode_changed or city_changed:
        print(f"[Simulator Control] Regime switch detected: {simulator_state['mode'].upper()} ({simulator_state['city'].upper()}). Resetting pipeline filters...")
        
        # 1. Reset in-memory rolling buffers and Kalman filters
        anomaly_detector.buffers.clear()
        sensor_corrector.filters.clear()

        # 2. Clear previous transient readings and unacknowledged alerts from DB
        try:
            async with AsyncSessionLocal() as session:
                await session.execute(delete(TelemetryReading))
                await session.execute(delete(AnomalyAlert).where(AnomalyAlert.is_acknowledged == False))
                await session.commit()
        except Exception as e:
            print(f"[Simulator Control] Notice clearing DB readings: {e}")

        # 3. Broadcast WebSocket event to frontend to refresh and clear chart histories
        try:
            await ws_manager.broadcast({
                "type": "RESET_HISTORY",
                "mode": simulator_state["mode"],
                "city": simulator_state["city"],
            })
        except Exception as e:
            print(f"[Simulator Control] Notice broadcasting reset: {e}")

    return {"success": True, "state": simulator_state}
