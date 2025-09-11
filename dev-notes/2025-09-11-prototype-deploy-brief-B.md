# Prototype Deployment Plan (DigitalOcean)

Goal: a single-droplet, low-cost, minimal-ops deployment of a React (Vite) + Fastify + PostgreSQL + Redis prototype.

---

## Key Decisions

| Area | Decision |
|------|---------|
| **Droplet Size** | **1 GB RAM** + 1–2 GB swap (cheapest). Accept slow builds as long as app handles a few dozen users. |
| **Build Strategy** | Build images **on the droplet** via `docker compose build` (simplest, reproducible). |
| **Persistence** | Postgres + Redis stored in **named Docker volumes** (data survives container restarts). |
| **Routes** | SPA served at `/`; API at `/api`; WebSocket at `/ws`. |
| **Migrations** | **Automatic on API start** (idempotent). |
| **TLS / Domain** | **TBD** – domain name and ACME email to be decided later. |
| **Backups** | **None for prototype** (OK to lose data). |
| **Monitoring** | Minimal: `docker compose logs` + optional external uptime check. |
| **CI/CD** | **None**. Manual `git pull && docker compose up -d`. |

---

## Stack Overview

- **Frontend**: React + Vite SPA, built inside Docker, served by **Caddy**.
- **Backend**: Fastify (Node 20) with WebSocket support, listens on `0.0.0.0:3000`.
- **Database**: PostgreSQL 16 (alpine).
- **Cache**: Redis 7 (alpine).
- **Reverse Proxy**: **Caddy** for static files + automatic Let’s Encrypt HTTPS + reverse proxy for `/api` and `/ws`.

---

## Directory Layout

```
your-app/
  docker-compose.yml
  .env.example      # copy to .env on server
  backend/
    Dockerfile
    dist/           # built JS from TypeScript
  frontend/
    Dockerfile
    Caddyfile
    src/
```

---

## docker-compose.yml

```yaml
version: "3.9"

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-appdb}
      POSTGRES_USER: ${POSTGRES_USER:-appuser}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "yes", "--save", ""]
    volumes:
      - redisdata:/data
    restart: unless-stopped

  api:
    build: ./backend
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgres://${POSTGRES_USER:-appuser}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB:-appdb}
      REDIS_URL: redis://redis:6379/0
      SESSION_SECRET: ${SESSION_SECRET}
    depends_on:
      - db
      - redis
    expose:
      - "3000"
    restart: unless-stopped

  web:
    build: ./frontend
    environment:
      DOMAIN: ${DOMAIN}
      ACME_EMAIL: ${ACME_EMAIL}
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - api
    volumes:
      - caddy_data:/data
      - caddy_config:/config
    restart: unless-stopped

volumes:
  pgdata:
  redisdata:
  caddy_data:
  caddy_config:
```

---

## Frontend

**frontend/Dockerfile**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM caddy:2.8-alpine
WORKDIR /srv
COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
```

**frontend/Caddyfile**

```caddy
{
  email {$ACME_EMAIL}
}

{$DOMAIN} {
  encode zstd gzip

  @api path /api* /ws*
  reverse_proxy @api api:3000

  root * /srv
  try_files {path} /index.html
  file_server
}
```

---

## Backend

**backend/Dockerfile**

```dockerfile
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

Backend must:
- listen on `0.0.0.0:3000`
- expose `GET /healthz`
- run migrations automatically on startup (idempotent)

---

## .env.example

```bash
# Domain/email: fill once decided
DOMAIN=
ACME_EMAIL=

POSTGRES_DB=appdb
POSTGRES_USER=appuser
POSTGRES_PASSWORD=change_me
SESSION_SECRET=change_me
```

---

## Deployment Steps (from fresh Ubuntu droplet)

1. **Install Docker & Compose**
   ```bash
   sudo apt update
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER   # log out/in after
   sudo ufw allow OpenSSH
   sudo ufw allow 80,443/tcp
   sudo ufw enable
   ```

2. **Clone repo & configure**
   ```bash
   git clone https://github.com/you/your-app.git
   cd your-app
   cp .env.example .env    # fill in secrets & domain later
   ```

3. **Build & run**
   ```bash
   docker compose build
   docker compose up -d
   ```

4. **Update**
   ```bash
   git pull
   docker compose build --pull
   docker compose up -d --remove-orphans
   ```

---

## Notes & To-Dos

- **Domain/ACME Email** – must be set in `.env` before first HTTPS run.  
- **Swap** – add ~1–2 GB swap on a 1 GB droplet to avoid OOM during builds.  
- **Backups** – not configured (prototype only).  
- **Monitoring** – optional external uptime check hitting `https://DOMAIN/healthz`.  

---

*This setup favors simplicity over scalability. When ready for production, revisit backups, monitoring, CI/CD, and possibly move Postgres to a managed service.*
