"""
SkyGuard AI - Database Session & Initialization
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS
"""

import os
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from backend.app.db_models.models import Base, Station

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DB_PATH = PROJECT_ROOT / "data" / "skyguard.db"

# Default to SQLite aiosqlite for zero-config local run; switchable to PostgreSQL via env var
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{DB_PATH}")

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    future=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# Default IMD Automatic Weather Stations in Punjab network
INITIAL_STATIONS = [
    {
        "id": "ABOHAR",
        "name": "Abohar Agro-Met AWS",
        "state": "Punjab",
        "latitude": 30.1453,
        "longitude": 74.1993,
        "elevation_m": 185.0,
        "status": "Healthy",
    },
    {
        "id": "BATHINDA",
        "name": "Bathinda Regional AWS",
        "state": "Punjab",
        "latitude": 30.2110,
        "longitude": 74.9455,
        "elevation_m": 201.0,
        "status": "Healthy",
    },
    {
        "id": "LUDHIANA",
        "name": "PAU Ludhiana Meteorological Centre",
        "state": "Punjab",
        "latitude": 30.9010,
        "longitude": 75.8573,
        "elevation_m": 244.0,
        "status": "Healthy",
    },
    {
        "id": "AMRITSAR",
        "name": "Amritsar Airport AWS",
        "state": "Punjab",
        "latitude": 31.6340,
        "longitude": 74.8723,
        "elevation_m": 234.0,
        "status": "Healthy",
    },
    {
        "id": "PATIALA",
        "name": "Patiala Observatory AWS",
        "state": "Punjab",
        "latitude": 30.3398,
        "longitude": 76.3869,
        "elevation_m": 250.0,
        "status": "Healthy",
    },
]


async def init_db():
    """Creates database tables and seeds initial IMD stations if missing."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        for st_data in INITIAL_STATIONS:
            existing = await session.get(Station, st_data["id"])
            if not existing:
                station = Station(**st_data)
                session.add(station)
        await session.commit()
    print("[Database] Schema synchronized and AWS stations verified.")
