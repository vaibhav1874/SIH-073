"""
SkyGuard AI - Telemetry Ingestion API Endpoint
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.database.session import get_db
from backend.app.db_models.models import TelemetryReading, AnomalyAlert
from backend.app.schemas.schemas import TelemetryInput
from backend.app.services.anomaly_detector import anomaly_detector
from backend.app.api.websocket import ws_manager

router = APIRouter(prefix="/api/telemetry", tags=["Telemetry"])


@router.post("")
async def ingest_telemetry(
    packet: TelemetryInput,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Ingests single AWS telemetry observation packet, executes real-time AI anomaly
    detection pipeline, persists to database, and streams via WebSocket.
    """
    timestamp = packet.timestamp or datetime.utcnow()

    telemetry_dict = {
        "station_id": packet.station_id.upper(),
        "timestamp": timestamp,
        "temperature": packet.temperature,
        "humidity": packet.humidity,
        "pressure": packet.pressure,
    }

    # Run complete ML anomaly detection engine
    result = anomaly_detector.process_reading(telemetry_dict)

    is_anomaly = result["is_anomaly"]
    corrected = result["corrected_readings"]

    # Save to database
    reading_record = TelemetryReading(
        station_id=packet.station_id.upper(),
        timestamp=timestamp,
        temperature=packet.temperature,
        humidity=packet.humidity,
        pressure=packet.pressure,
        is_anomaly=is_anomaly,
        ensemble_score=result["ensemble_score"],
        root_cause=result["root_cause"],
        severity=result["severity"],
        affected_sensors=",".join(result["affected_sensors"]),
        corrected_temperature=corrected.get("temperature"),
        corrected_humidity=corrected.get("humidity"),
        corrected_pressure=corrected.get("pressure"),
    )
    db.add(reading_record)

    alert_id = None
    if is_anomaly:
        alert_record = AnomalyAlert(
            station_id=packet.station_id.upper(),
            timestamp=timestamp,
            root_cause=result["root_cause"],
            severity=result["severity"],
            affected_sensors=",".join(result["affected_sensors"]),
            ensemble_score=result["ensemble_score"],
            explanation=result["explanation"]["summary"],
            recommended_action=result["protocol"]["action"],
            sla_hours=result["protocol"]["sla_hours"],
            is_acknowledged=False,
        )
        db.add(alert_record)
        await db.commit()
        await db.refresh(alert_record)
        alert_id = alert_record.id
    else:
        await db.commit()

    # WebSocket broadcast payload
    ws_payload = {
        "type": "TELEMETRY_UPDATE",
        "station_id": packet.station_id.upper(),
        "timestamp": timestamp.isoformat(),
        "data": {
            "temperature": packet.temperature,
            "humidity": packet.humidity,
            "pressure": packet.pressure,
            "is_anomaly": is_anomaly,
            "ensemble_score": result["ensemble_score"],
            "root_cause": result["root_cause"],
            "severity": result["severity"],
            "affected_sensors": result["affected_sensors"],
            "corrected": corrected,
            "model_breakdown": result["model_breakdown"],
            "explanation": result["explanation"],
            "health": result["health"],
            "alert_id": alert_id,
            "protocol": result["protocol"],
            "latency_ms": result["latency_ms"],
        },
    }

    # Asynchronous broadcast without blocking response
    background_tasks.add_task(ws_manager.broadcast, ws_payload)

    return {
        "status": "processed",
        "station_id": packet.station_id.upper(),
        "is_anomaly": is_anomaly,
        "result": result,
        "alert_id": alert_id,
    }
