"""
SkyGuard AI - Database Models (SQLAlchemy Async ORM)
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Index
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Station(Base):
    __tablename__ = "stations"

    id = Column(String(32), primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    state = Column(String(64), nullable=False, default="Punjab")
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    elevation_m = Column(Float, nullable=False, default=185.0)
    status = Column(String(32), nullable=False, default="Healthy")
    created_at = Column(DateTime, default=datetime.utcnow)

    readings = relationship("TelemetryReading", back_populates="station", cascade="all, delete-orphan")
    alerts = relationship("AnomalyAlert", back_populates="station", cascade="all, delete-orphan")


class TelemetryReading(Base):
    __tablename__ = "telemetry_readings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    station_id = Column(String(32), ForeignKey("stations.id"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)

    # Raw telemetry
    temperature = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    pressure = Column(Float, nullable=True)

    # Anomaly inference tags
    is_anomaly = Column(Boolean, default=False, index=True)
    ensemble_score = Column(Float, default=0.0)
    root_cause = Column(String(64), default="normal")
    severity = Column(String(32), default="none")
    affected_sensors = Column(String(128), default="none")

    # Kalman corrected / imputed values
    corrected_temperature = Column(Float, nullable=True)
    corrected_humidity = Column(Float, nullable=True)
    corrected_pressure = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    station = relationship("Station", back_populates="readings")

    __table_args__ = (
        Index("idx_station_time", "station_id", "timestamp"),
    )


class AnomalyAlert(Base):
    __tablename__ = "anomaly_alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    station_id = Column(String(32), ForeignKey("stations.id"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    root_cause = Column(String(64), nullable=False)
    severity = Column(String(32), nullable=False, index=True)
    affected_sensors = Column(String(128), nullable=False)
    ensemble_score = Column(Float, nullable=False)
    explanation = Column(Text, nullable=False)
    recommended_action = Column(Text, nullable=False)
    sla_hours = Column(Integer, default=24)

    is_acknowledged = Column(Boolean, default=False, index=True)
    acknowledged_at = Column(DateTime, nullable=True)
    acknowledged_by = Column(String(128), nullable=True)

    station = relationship("Station", back_populates="alerts")


class StationHealthLog(Base):
    __tablename__ = "station_health_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    station_id = Column(String(32), ForeignKey("stations.id"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    overall_score = Column(Float, nullable=False)
    temp_score = Column(Float, nullable=False)
    hum_score = Column(Float, nullable=False)
    pres_score = Column(Float, nullable=False)
    comms_score = Column(Float, nullable=False)
    station_status = Column(String(32), nullable=False)
