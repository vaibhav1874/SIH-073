#!/bin/sh
PORT="${PORT:-8000}"

# Optional: Launch background telemetry simulator inside the same container
if [ "${RUN_SIMULATOR:-1}" = "1" ]; then
    echo "[SkyGuard AI] Launching background AWS telemetry simulator on port ${PORT}..."
    (sleep 5 && python -u simulator/aws_simulator.py --api-url "http://127.0.0.1:${PORT}") &
fi

echo "[SkyGuard AI] Starting FastAPI on 0.0.0.0:${PORT}..."
exec uvicorn backend.app.main:app --host 0.0.0.0 --port "${PORT}"
