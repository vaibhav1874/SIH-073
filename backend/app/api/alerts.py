"""
SkyGuard AI - Anomaly Alerts API Endpoints
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS
"""

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from backend.app.database.session import get_db
from backend.app.db_models.models import AnomalyAlert
from backend.app.schemas.schemas import AlertResponse, AcknowledgeAlertRequest

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])


@router.get("", response_model=List[AlertResponse])
async def list_alerts(
    station_id: Optional[str] = None,
    severity: Optional[str] = None,
    is_acknowledged: Optional[bool] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    query = select(AnomalyAlert).order_by(desc(AnomalyAlert.timestamp))

    if station_id:
        query = query.where(AnomalyAlert.station_id == station_id.upper())
    if severity:
        query = query.where(AnomalyAlert.severity == severity.lower())
    if is_acknowledged is not None:
        query = query.where(AnomalyAlert.is_acknowledged == is_acknowledged)

    query = query.limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: int,
    payload: AcknowledgeAlertRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AnomalyAlert).where(AnomalyAlert.id == alert_id))
    alert = result.scalars().first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.is_acknowledged = True
    alert.acknowledged_at = datetime.utcnow()
    alert.acknowledged_by = payload.acknowledged_by

    await db.commit()
    await db.refresh(alert)
    return {"status": "acknowledged", "alert_id": alert.id, "acknowledged_by": alert.acknowledged_by}


@router.get("/summary/stats")
async def get_alert_stats(db: AsyncSession = Depends(get_db)):
    """Summary counts of unacknowledged alerts grouped by severity."""
    stmt = (
        select(AnomalyAlert.severity, func.count(AnomalyAlert.id))
        .where(AnomalyAlert.is_acknowledged == False)
        .group_by(AnomalyAlert.severity)
    )
    result = await db.execute(stmt)
    rows = result.all()
    counts = {r[0]: r[1] for r in rows}

    return {
        "critical": counts.get("critical", 0),
        "high": counts.get("high", 0),
        "medium": counts.get("medium", 0),
        "low": counts.get("low", 0),
        "total_active": sum(counts.values()),
    }
