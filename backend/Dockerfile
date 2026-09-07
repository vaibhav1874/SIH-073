# SkyGuard AI - Backend Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install build essentials for C-extensions (XGBoost, scikit-learn, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy backend dependencies
COPY backend/requirements.txt /app/backend/requirements.txt

# Install python dependencies
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy required codebase directories
COPY backend/ /app/backend/
COPY ml/ /app/ml/
COPY data/ /app/data/
COPY scripts/ /app/scripts/
COPY simulator/ /app/simulator/

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
