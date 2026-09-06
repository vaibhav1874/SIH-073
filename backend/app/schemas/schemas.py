"""
SkyGuard AI - Pydantic Request & Response Schemas
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS
"""

from typing import Dict, List, Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field


class TelemetryInput(BaseModel):
    station_id: str = Field(..., example="ABOHAR")
    timestamp: Optional[datetime] = Field(default_factory=datetime.utcnow)
    temperature: float = Field(..., example=28.4, description="Ambient Temperature in °C")
    humidity: float = Field(..., example=62.5, description="Relative Humidity in %")
    pressure: float = Field(..., example=1008.2, description="Atmospheric Pressure in hPa")


class StationResponse(BaseModel):
    id: str
    name: str
    state: str
    latitude: float
    longitude: float
    elevation_m: float
    status: str

    class Config:
        from_attributes = True


class AlertResponse(BaseModel):
    id: int
    station_id: str
    timestamp: datetime
    root_cause: str
    severity: str
    affected_sensors: str
    ensemble_score: float
    explanation: str
    recommended_action: str
    sla_hours: int
    is_acknowledged: bool
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None

    class Config:
        from_attributes = True


class AcknowledgeAlertRequest(BaseModel):
    acknowledged_by: str = Field(..., example="IMD_Duty_Officer_01")


class FaultInjectionRequest(BaseModel):
    fault_type: str = Field(..., example="temperature_spike", description="One of the 7 fault types")
    target_sensor: str = Field(default="temperature", example="temperature")
    duration_steps: int = Field(default=10, example=10)
    magnitude: float = Field(default=15.0, example=15.0)


class HealthSummaryResponse(BaseModel):
    station_id: str
    overall_score: float
    station_status: str
    sensor_scores: Dict[str, Any]
