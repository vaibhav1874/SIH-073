# SkyGuard AI - Production Deployment Guide
**SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS (IMD / MoES)**

This guide covers 3 standard methods to deploy SkyGuard AI:
1. **Method 1: Docker Compose (Recommended - Easiest & Most Reliable)**
2. **Method 2: Linux Cloud VPS (AWS EC2, DigitalOcean, Azure, Ubuntu 22.04/24.04)**
3. **Method 3: Free Cloud PaaS (Render / Railway + Vercel)**

---

## Architecture Overview

```
                          Internet / Users
                                 │
                          ┌──────▼──────┐
                          │ Nginx Proxy │ (Port 80 / 443 SSL)
                          └──────┬──────┘
                   ┌─────────────┴─────────────┐
                   │                           │
          ┌────────▼────────┐         ┌────────▼────────┐
          │ React Frontend  │         │ FastAPI Backend │ (Port 8000)
          │  (Vite bundle)  │         │  (Uvicorn ASGI) │
          └─────────────────┘         └────────┬────────┘
                                               │
                                 ┌─────────────┼─────────────┐
                                 │             │             │
                          ┌──────▼──────┐ ┌────▼────┐ ┌──────▼──────┐
                          │ SQLite / PG │ │ ML Core │ │ AWS Stream  │
                          │   Database  │ │ PyTorch │ │  Simulator  │
                          └─────────────┘ └─────────┘ └─────────────┘
```

---

## Method 1: Docker Compose (One-Command Deployment)

Prerequisites: Docker Engine and Docker Compose installed.

### Step 1: Clone and Enter Directory
```bash
git clone https://github.com/vaibhav1874/SIH-073.git skyguard-ai
cd skyguard-ai
```

### Step 2: Configure Environment
```bash
cp .env.example .env
```

### Step 3: Build & Launch Containers
```bash
docker compose up -d --build
```

### Step 4: Verify Deployment
- **Frontend Dashboard:** `http://<your-server-ip>:3000`
- **Backend API & Swagger Docs:** `http://<your-server-ip>:8000/docs`
- **Check Running Containers:**
  ```bash
  docker compose ps
  docker compose logs -f
  ```

---

## Method 2: Ubuntu Linux VPS (AWS EC2 / DigitalOcean)

Ideal for live jury demos, presentation servers, and dedicated production instances.

### Step 1: Install System Dependencies
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-pip python3-venv nodejs npm git nginx curl
```

### Step 2: Setup Codebase & Virtualenv
```bash
git clone https://github.com/vaibhav1874/SIH-073.git /var/www/skyguard-ai
cd /var/www/skyguard-ai

# Python Virtual Environment
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
```

### Step 3: Build Frontend Production Bundle
```bash
cd /var/www/skyguard-ai/frontend
npm install
npm run build
# The optimized build is created in /var/www/skyguard-ai/frontend/dist
```

### Step 4: Configure Systemd Background Services

#### 1. Backend Service (`/etc/systemd/system/skyguard-backend.service`):
```ini
[Unit]
Description=SkyGuard AI FastAPI Backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/var/www/skyguard-ai
Environment="PYTHONPATH=/var/www/skyguard-ai"
Environment="PYTHONUNBUFFERED=1"
ExecStart=/var/www/skyguard-ai/venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

#### 2. Simulator Service (`/etc/systemd/system/skyguard-simulator.service`):
```ini
[Unit]
Description=SkyGuard AI Telemetry Streaming Simulator
After=skyguard-backend.service

[Service]
User=ubuntu
WorkingDirectory=/var/www/skyguard-ai
Environment="PYTHONPATH=/var/www/skyguard-ai"
Environment="PYTHONUNBUFFERED=1"
ExecStart=/var/www/skyguard-ai/venv/bin/python -u simulator/aws_simulator.py --api-url http://127.0.0.1:8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

#### 3. Enable & Start Services:
```bash
sudo systemctl daemon-reload
sudo systemctl enable skyguard-backend skyguard-simulator
sudo systemctl start skyguard-backend skyguard-simulator
```

### Step 5: Configure Nginx as Reverse Proxy

Create `/etc/nginx/sites-available/skyguard`:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com; # Or server IP

    root /var/www/skyguard-ai/frontend/dist;
    index index.html;

    # SPA Client Routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket Real-Time Telemetry Stream
    location /ws/ {
        proxy_pass http://127.0.0.1:8000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
```

Enable site & test:
```bash
sudo ln -s /etc/nginx/sites-available/skyguard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 6: Enable Free SSL with Certbot (Optional Domain)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Method 3: Cloud PaaS (Render / Railway / Vercel)

### Backend (Render or Railway)
1. Link your GitHub repo to [Render](https://render.com) or [Railway](https://railway.app).
2. **Build Command:** `pip install -r backend/requirements.txt`
3. **Start Command:** `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
4. **Environment Variables:**
   - `PYTHONPATH=.`
   - `PYTHONUNBUFFERED=1`

### Frontend (Vercel)
1. Import `frontend/` folder into [Vercel](https://vercel.com).
2. **Framework Preset:** Vite
3. **Build Command:** `npm run build`
4. **Output Directory:** `dist`
5. In `frontend/vite.config.ts`, set the backend URL to your live Render backend URL.

---

## Useful Operations & Monitoring Commands

| Task | Command |
|---|---|
| Check backend health | `curl http://localhost:8000/api/health` |
| View backend live logs | `sudo journalctl -u skyguard-backend -f` |
| View simulator live logs | `sudo journalctl -u skyguard-simulator -f` |
| Restart all services | `sudo systemctl restart skyguard-backend skyguard-simulator nginx` |
| View running Docker services | `docker compose ps` |
| View Docker live logs | `docker compose logs -f --tail=100` |
