"""
SkyGuard AI - Interactive Live Fault Injection API Endpoints
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS
"""

from fastapi import APIRouter
from backend.app.schemas.schemas import FaultInjectionRequest
from ml.anomaly_injection.live_injector import live_injector

router = APIRouter(tags=["Fault Injection"])


@router.post("/api/fault/inject")
@router.post("/api/faults/inject")
async def trigger_live_fault(payload: FaultInjectionRequest):
    """Triggers an interactive fault injection on the streaming simulator."""
    res = live_injector.trigger_fault(
        fault_type=payload.fault_type,
        target_sensor=payload.target_sensor,
        duration_steps=payload.duration_steps,
        magnitude=payload.magnitude,
    )
    return res


@router.post("/api/fault/clear")
@router.post("/api/faults/clear")
async def clear_live_fault():
    """Clears any active live fault."""
    return live_injector.clear_fault()


@router.get("/api/fault/status")
@router.get("/api/faults/status")
async def get_fault_status():
    """Returns current active fault details and steps remaining."""
    return {
        "is_active": live_injector.active_fault is not None,
        "active_fault": live_injector.active_fault,
        "steps_remaining": live_injector.steps_remaining,
    }
