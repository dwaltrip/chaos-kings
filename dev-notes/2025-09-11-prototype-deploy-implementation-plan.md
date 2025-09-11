# Prototype Deploy — Consolidated Implementation Plan

Goal: simple single-droplet deploy for playtesting. Prefer clarity and minimal ops over robustness. This plan merges Brief A and Brief B, adjusted to match this repo.

## Final Decisions

- Platform: DigitalOcean droplet, Ubuntu 22.04
- Size: 1–2 GB RAM (ok to start with 1 GB + swap; 2 GB builds faster)
- Orchestration: Docker Compose
- Reverse proxy: Caddy (HTTPS via Let’s Encrypt)
- Routing: SPA at `/`; API at `/api/*`; WebSocket at `/ws`
- Build strategy: Build images on droplet via `docker compose build`
- Persistence: Docker named volumes for Postgres/Redis/Caddy
- Backups/Monitoring: none for prototype; use `docker compose logs` and optional external uptime ping
- CI/CD: none; manual `git pull && docker compose up -d`

Notes:
- Repo is a monorepo with `frontend`, `backend`, `common`, `core`. Docker builds must include `common` and `core` for alias imports.

---

## Where Briefs Don’t Match Repo (and Resolutions)

- Backend port/host: code listens on `localhost:3131`. Resolution: make `PORT` and host configurable; default to `3131` but bind `0.0.0.0` in prod.
- API prefix: backend already prefixes routes with `/api` — good.
- Health endpoint: `/api/health` (not `/healthz`). We’ll keep `/api/health`.
- DB config: hardcoded to local Postgres. Resolution: add `DATABASE_URL` support (and/or env vars) in `src/services/db.ts`.
- Redis config: uses default localhost. Resolution: add `REDIS_URL` support in `src/services/redis.ts`.
- CORS: hardcoded dev origins. Resolution: relax to `origin: true` or env-driven in prod.
- Frontend API base: hardcoded `http://localhost:3131`. Resolution: use relative base (same-origin) with optional `VITE_API_BASE_URL` override for local dev.
- Frontend WS URL: hardcoded `ws://localhost:3131/ws`. Resolution: compute from `window.location` with optional `VITE_WS_URL` override.
- Docker build context: briefs assume per-package contexts; our FE/BE import `../common` and `../core`. Resolution: set build context to repo root and Dockerfiles copy `frontend`, `backend`, `common`, `core` as needed.
- Migrations: Brief B suggests auto-run on start. For simplicity, use manual one-off `migrate:latest` during deploy.
- Redis auth: Brief A suggests password; Brief B omits. For prototype, skip password (Redis not exposed externally).

---

## Body of Work 1 — Codebase Changes (Prep for Deploy)

Minimal, deployment-focused changes only:

1) Backend — server binding and env
- `backend/src/server.ts`:
  - Read `PORT` from env; default `3131`.
  - Bind `host: '0.0.0.0'` (not `localhost`).
  - CORS: change to `origin: true` (or read `CORS_ORIGIN` if set) and keep `credentials: true`.

2) Backend — database config
- `backend/src/services/db.ts`:
  - Support `process.env.DATABASE_URL` (preferred) by passing `connectionString` to `pg.Pool`.
  - Fallbacks for local dev: `database: 'generals_v2'`, `host: 'localhost'`, `user: 'postgres'`, etc.

3) Backend — Redis config
- `backend/src/services/redis.ts`:
  - Support `process.env.REDIS_URL` (e.g., `redis://redis:6379/0`).
  - Default to `redis://localhost:6379/0` for local dev.

4) Frontend — API base URL
- `frontend/src/services/api-service.ts`:
  - Use `const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''`.
  - All calls remain `fetch(baseUrl + path)` where `path` already includes `/api/...`.

5) Frontend — WebSocket URL
- `frontend/src/services/websocket-service.ts`:
  - Compute default: `const scheme = location.protocol === 'https:' ? 'wss' : 'ws'; const url = \
    import.meta.env.VITE_WS_URL ?? 
    `${scheme}://${location.host}/ws`;`

6) Add `.env.example` (root)
- Include: `DOMAIN`, `ACME_EMAIL`, `POSTGRES_*`, `SESSION_SECRET`, `DATABASE_URL` (optional), `REDIS_URL` (optional), `CORS_ORIGIN` (optional).

7) Add containerization files
- `docker-compose.yml` (root): services `db`, `redis`, `api`, `web`; volumes for pg/redis/caddy.
- `backend/Dockerfile`: multi-stage build (build TS + prod runtime).
- `frontend/Dockerfile`: multi-stage build to static; base image `caddy:alpine`.
- `frontend/Caddyfile`: serve SPA + reverse proxy `/api` and `/ws` to `api` service.

8) Docs
- Add this plan (done) and a short `dev-notes/deploy-checklist.md` pointer to steps below.

---

## Body of Work 2 — Deploy Process (Initial + Updates)

One-time prerequisites
- Domain + DNS: point `A` record to droplet public IP.
- Choose droplet size: 1 GB (with swap) or 2 GB. For faster builds, use 2 GB.
- Secrets: pick `POSTGRES_PASSWORD` and `SESSION_SECRET`.

Server bootstrap (fresh droplet)
1) Install Docker & Compose and basic firewall
```bash
sudo apt update && sudo apt -y upgrade
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out/in after
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw --force enable
```

2) (Optional on 1 GB) Add swap
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

3) Clone repo and prepare env
```bash
git clone <your repo> generals-v2
cd generals-v2
cp .env.example .env
# edit .env: DOMAIN, ACME_EMAIL, POSTGRES_PASSWORD, SESSION_SECRET (and others if desired)
```

4) Build and start
```bash
docker compose build
docker compose up -d
```

5) Run DB migrations (one-off or on each update if schema changed)
```bash
docker compose exec api npm run migrate:latest
```

6) Smoke checks
- App: open `https://<DOMAIN>` — SPA should load.
- API: `curl -k https://<DOMAIN>/api/health` ⇒ `{ status: "ok", ... }`.
- WS: browser devtools should show successful `wss://<DOMAIN>/ws` connection.

Update deploys
```bash
git pull
docker compose build --pull
docker compose up -d --remove-orphans
# If migrations added:
docker compose exec api npm run migrate:latest
```

Rollbacks (simple)
- Keep previous commit hash; `git checkout <hash> && docker compose build && docker compose up -d`.

---

## Files to Add (summaries)

1) docker-compose.yml (root)
- Services
  - `db`: `postgres:16-alpine`; env `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`; volume `pgdata`.
  - `redis`: `redis:7-alpine`; AOF; volume `redisdata`.
  - `api`: build from repo root with `backend/Dockerfile`; env includes `NODE_ENV=production`, `PORT=3131`, `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`; depends on db/redis; expose 3131.
  - `web`: build from repo root with `frontend/Dockerfile`; env `DOMAIN`, `ACME_EMAIL`; publish `80:80`, `443:443`; depends on `api`; volumes `caddy_data`, `caddy_config`.

2) backend/Dockerfile
- Multi-stage: build TS (installs dev deps), then runtime (installs prod deps), `CMD node dist/server.js`.

3) frontend/Dockerfile
- Multi-stage: build Vite app, then serve with `caddy` copying `dist` and `Caddyfile`.

4) frontend/Caddyfile
- Uses `${DOMAIN}` and `${ACME_EMAIL}` envs; reverse proxy `/api*` and `/ws*` to `api:3131`.
- SPA fallback with `try_files {path} /index.html`.

5) .env.example (root)
```
# Domain/email for HTTPS
DOMAIN=
ACME_EMAIL=

# Database
POSTGRES_DB=appdb
POSTGRES_USER=appuser
POSTGRES_PASSWORD=change_me
# For backend (optional if using individual vars):
DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}

# Redis
REDIS_URL=redis://redis:6379/0

# App
SESSION_SECRET=change_me
CORS_ORIGIN=

# Frontend dev overrides (not used in prod)
VITE_API_BASE_URL=
VITE_WS_URL=
```

---

## Open Decisions (need quick input)

- Droplet size: OK to use $12/mo (2 GB) for faster builds? If not, we’ll add swap to 1 GB.
- Domain/TLS: What domain and ACME email should we configure? (e.g., `play.example.com`, `admin@example.com`)

If you answer those, we can proceed without further prompts.

---

## Validation Checklist

- Containers start: `docker compose up -d` with no errors
- SPA loads at `https://<DOMAIN>`
- API responds at `GET https://<DOMAIN>/api/health`
- WebSocket connects at `wss://<DOMAIN>/ws`
- Postgres/Redis data persist across restarts
- TLS certificates issued by Let’s Encrypt
- Migrations apply successfully

---

## Rationale Highlights

- Picked manual deploy (Brief B) over GitHub Actions (Brief A) to reduce moving parts for prototype.
- Kept Caddy + single-domain `/api` and `/ws` (common across both briefs).
- Adjusted Docker builds for monorepo to include `common` and `core`.
- Avoided Redis auth for now since service is internal-only; can add later with minimal changes.

