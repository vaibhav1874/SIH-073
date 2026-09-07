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

# Install PyTorch CPU-only first (saves ~1.5GB disk and ~150MB RAM on Render 512MB)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install python dependencies
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy required codebase directories
COPY backend/ /app/backend/
COPY ml/ /app/ml/
COPY data/ /app/data/
COPY scripts/ /app/scripts/
COPY simulator/ /app/simulator/

# Strict memory controls for low-RAM containers
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV OMP_NUM_THREADS=1
ENV MKL_NUM_THREADS=1
ENV OPENBLAS_NUM_THREADS=1
ENV NUMEXPR_NUM_THREADS=1
ENV VECLIB_MAXIMUM_THREADS=1

# Make entrypoint script executable
RUN chmod +x /app/backend/entrypoint.sh

EXPOSE 8000 10000

CMD ["/bin/sh", "/app/backend/entrypoint.sh"]
