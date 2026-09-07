#!/bin/sh
PORT="${PORT:-8000}"

# In 512MB RAM environments (like Render Free), RUN_SIMULATOR defaults to 0 to prevent OOM
if [ "${RUN_SIMULATOR:-0}" = "1" ]; then
    echo "[SkyGuard AI] Launching background AWS telemetry simulator on port ${PORT}..."
    (sleep 8 && python -u simulator/aws_simulator.py --api-url "http://127.0.0.1:${PORT}") &
fi

echo "[SkyGuard AI] Starting FastAPI on 0.0.0.0:${PORT}..."
exec uvicorn backend.app.main:app --host 0.0.0.0 --port "${PORT}"
