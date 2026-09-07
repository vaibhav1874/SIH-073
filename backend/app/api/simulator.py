"""
SkyGuard AI - Dynamic Simulator Mode Controller API
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

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
    if mode in ["replay", "live"]:
        simulator_state["mode"] = mode
    if payload.city:
        simulator_state["city"] = payload.city.strip().lower()
    
    print(f"[Simulator Control] Switched to mode: {simulator_state['mode'].upper()} (City: {simulator_state['city'].upper()})")
    return {"success": True, "state": simulator_state}
