"""
SkyGuard AI - Stations API Endpoints
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from backend.app.database.session import get_db
from backend.app.db_models.models import Station, TelemetryReading
from backend.app.schemas.schemas import StationResponse
from backend.app.services.health_score import sensor_health_tracker

router = APIRouter(prefix="/api/stations", tags=["Stations"])


@router.get("", response_model=List[StationResponse])
async def list_stations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Station))
    stations = result.scalars().all()
    out = []
    for s in stations:
        h = sensor_health_tracker.get_health(s.id)
        s.status = "Critical" if h["overall_score"] < 50 else ("Warning" if h["overall_score"] < 80 else "Healthy")
        out.append(s)
    return out


@router.get("/{station_id}")
async def get_station(station_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Station).where(Station.id == station_id.upper()))
    station = result.scalars().first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    health = sensor_health_tracker.get_health(station.id)
    return {
        "station": {
            "id": station.id,
            "name": station.name,
            "state": station.state,
            "latitude": station.latitude,
            "longitude": station.longitude,
            "elevation_m": station.elevation_m,
            "status": station.status,
        },
        "health": health,
    }


@router.get("/{station_id}/readings")
async def get_recent_readings(
    station_id: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Returns recent telemetry readings chronologically for charting."""
    stmt = (
        select(TelemetryReading)
        .where(TelemetryReading.station_id == station_id.upper())
        .order_by(desc(TelemetryReading.id))
        .limit(limit)
    )
    result = await db.execute(stmt)
    readings = result.scalars().all()
    readings_chronological = list(reversed(readings))

    return [
        {
            "id": r.id,
            "timestamp": r.timestamp.isoformat(),
            "temperature": r.temperature,
            "humidity": r.humidity,
            "pressure": r.pressure,
            "is_anomaly": r.is_anomaly,
            "ensemble_score": r.ensemble_score,
            "root_cause": r.root_cause,
            "severity": r.severity,
            "corrected_temperature": r.corrected_temperature,
            "corrected_humidity": r.corrected_humidity,
            "corrected_pressure": r.corrected_pressure,
        }
        for r in readings_chronological
    ]


@router.get("/{station_id}/health")
async def get_station_health(station_id: str):
    return sensor_health_tracker.get_health(station_id.upper())
