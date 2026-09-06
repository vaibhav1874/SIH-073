"""
SkyGuard AI - FastAPI Master Application Entry Point
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from backend.app.database.session import init_db
from backend.app.api.stations import router as stations_router
from backend.app.api.telemetry import router as telemetry_router
from backend.app.api.alerts import router as alerts_router
from backend.app.api.benchmark import router as benchmark_router
from backend.app.api.faults import router as faults_router
from backend.app.api.websocket import ws_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database tables and seed AWS stations
    print("[SkyGuard AI] Initializing database and pre-warming models...")
    await init_db()
    yield
    # Shutdown
    print("[SkyGuard AI] Shutting down application...")


app = FastAPI(
    title="SkyGuard AI - IMD AWS Anomaly Detection System",
    description="Real-time multi-sensor anomaly detection, root cause classification, and sensor health tracking for Automatic Weather Stations.",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for frontend dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(stations_router)
app.include_router(telemetry_router)
app.include_router(alerts_router)
app.include_router(benchmark_router)
app.include_router(faults_router)


@app.get("/")
async def root():
    return {
        "system": "SkyGuard AI",
        "purpose": "IMD Automatic Weather Station Real-Time Anomaly Detection",
        "status": "operational",
        "version": "1.0.0",
        "docs_url": "/docs",
    }


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "SkyGuard AI Backend"}


@app.websocket("/ws/telemetry")
async def websocket_telemetry_stream(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive; clients can send ping/commands
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)
