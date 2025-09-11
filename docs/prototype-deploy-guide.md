# Prototype Deploy Guide (DigitalOcean, Docker Compose)

This guide shows a developer how to deploy the Generals v2 prototype to a single DigitalOcean droplet using Docker Compose and Caddy. It prioritizes simplicity over robustness.

## TL;DR — First Deploy Checklist

- DNS: Create an A record for your domain to the droplet IP (e.g., `play.example.com -> <IP>`).
- Droplet: Ubuntu 22.04; 1 GB RAM is fine (add 2 GB swap if needed) or use 2 GB.
- Install Docker + firewall:
  - `sudo apt update && sudo apt -y upgrade`
  - `curl -fsSL https://get.docker.com | sh`
  - `sudo usermod -aG docker $USER` (log out/in after)
  - `sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw --force enable`
- Optional swap (1 GB droplets):
  - `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`
  - `echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab`
- Clone + env:
  - `git clone <YOUR_REPO_URL> generals-v2 && cd generals-v2`
  - `cp .env.example .env` and set: `DOMAIN`, `ACME_EMAIL`, `POSTGRES_PASSWORD`, `SESSION_SECRET`
- Build + run:
  - `docker compose build`
  - `docker compose up -d`
- Migrate DB (one-off and on schema changes):
  - `docker compose exec api npm run migrate:latest`
- Verify:
  - Visit `https://<DOMAIN>`; health: `curl -k https://<DOMAIN>/api/health`; WS shows `wss://<DOMAIN>/ws`
- Updates:
  - `git pull && docker compose build --pull && docker compose up -d --remove-orphans`
  - If schema changed: `docker compose exec api npm run migrate:latest`

Tip: You can also run `scripts/first-deploy.sh` on the server to bootstrap quickly.

- Stack: React (Vite) SPA + Fastify API + PostgreSQL + Redis
- Single domain: SPA at `/`, API at `/api/*`, WebSocket at `/ws`
- SSL: Automatic via Caddy + Let’s Encrypt
- Build: On the droplet (`docker compose build`)
- CI/CD: None (manual `git pull && docker compose up -d`)

Links:
- Implementation plan: `dev-notes/2025-09-11-prototype-deploy-implementation-plan.md`
- Example env file: `.env.example`

---

## Prerequisites

- DigitalOcean account (or any VPS with Ubuntu 22.04)
- A domain you control (e.g., `play.example.com`)
- SSH access to the droplet as a user with sudo

---

## One-Time Domain Setup

1) Create an A record pointing your domain to the droplet’s public IP.
   - Example: `play.example.com -> 203.0.113.42`
2) Keep the domain name and an email address handy for Let’s Encrypt.
   - You will put these in the `.env` file as `DOMAIN` and `ACME_EMAIL`.

Note: SSL issuance requires the domain to resolve to your droplet before starting Caddy.

---

## Droplet Provisioning

- Size: 1 GB RAM droplet is OK for the prototype. If builds are slow/run out of memory, add 2 GB swap (see below) or use a 2 GB droplet.
- OS: Ubuntu 22.04 LTS

### Optional (Recommended on 1 GB): Add 2 GB Swap
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## Server Bootstrap

1) Update packages and install Docker
```bash
sudo apt update && sudo apt -y upgrade
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out/in or new SSH session after this
```

2) Enable basic firewall rules
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw --force enable
```

---

## Clone Repo and Prepare Environment

1) Clone the repository
```bash
git clone <YOUR_REPO_URL> generals-v2
cd generals-v2
```

2) Create `.env` from example and fill values
```bash
cp .env.example .env
```

Set these required variables in `.env`:
- `DOMAIN`: your domain (e.g., `play.example.com`)
- `ACME_EMAIL`: your email for Let’s Encrypt notices
- `POSTGRES_PASSWORD`: any strong password
- `SESSION_SECRET`: any strong random string (e.g., `openssl rand -base64 32`)

Optional (defaults are fine for prototype):
- `POSTGRES_DB`, `POSTGRES_USER`
- `DATABASE_URL`, `REDIS_URL` (compose sets sensible defaults)
- `CORS_ORIGIN` (normally not needed in prod because we use same-origin)

For local development only (not used in prod build):
- `VITE_API_BASE_URL`, `VITE_WS_URL`

---

## Build and Start the Stack

From the repo root:
```bash
docker compose build
```
This builds four services: `db` (Postgres), `redis`, `api` (Fastify), `web` (Caddy + SPA).

Start in detached mode:
```bash
docker compose up -d
```

Check status:
```bash
docker compose ps
```

---

## Run Database Migrations (one-off)

Run after the first start and any time schema changes are introduced:
```bash
docker compose exec api npm run migrate:latest
```

---

## Verify the Deployment

- Open the site: `https://<DOMAIN>`
- API health: `curl -k https://<DOMAIN>/api/health`
  - Expected: `{ "status": "ok", ... }`
- WebSocket: In browser devtools, network tab should show a `wss://<DOMAIN>/ws` connection `101 Switching Protocols`.

Logs (if needed):
```bash
docker compose logs -f web
# or
docker compose logs -f api
```

---

## Updating the Deployment

From the repo folder on the droplet:
```bash
git pull
docker compose build --pull
docker compose up -d --remove-orphans
# If migrations added:
docker compose exec api npm run migrate:latest
```

---

## Rollback (Simple)

- Identify the previous commit hash: `git log --oneline`
- Checkout and rebuild:
```bash
git checkout <HASH>
docker compose build
docker compose up -d
```
- Return to main line when ready: `git checkout <BRANCH> && git pull`

---

## Common Troubleshooting

- DNS not propagated:
  - `dig <DOMAIN> +short` should show the droplet IP. Wait up to an hour or reduce TTL before switching.

- TLS/cert issues (Caddy):
  - Ensure `DOMAIN` and `ACME_EMAIL` are set in `.env`.
  - Ensure ports 80/443 are open and no other service binds them.
  - Check logs: `docker compose logs -f web`.

- 502/Bad Gateway from Caddy:
  - API container may not be healthy or listening. Check `docker compose logs -f api`.
  - Verify API bound to `0.0.0.0:3131` (this repo is configured to do so in production).

- Build fails on 1 GB droplet:
  - Add swap (see earlier section) or upgrade droplet to 2 GB.

- Postgres data reset unintentionally:
  - Compose uses a named volume `pgdata`. Ensure you didn’t remove it with `docker volume rm`.

- Can’t run migrations:
  - Ensure `api` is up: `docker compose ps`.
  - Run: `docker compose exec api npm run migrate:latest`.

---

## Reference: Files and Configuration

- `docker-compose.yml` (root): services [`db`, `redis`, `api`, `web`], named volumes [`pgdata`, `redisdata`, `caddy_data`, `caddy_config`].
- `backend/Dockerfile`: builds TypeScript and runs `node dist/server.js`.
- `frontend/Dockerfile`: builds SPA and serves via `caddy`.
- `frontend/Caddyfile`:
  - Proxies `/api*` and `/ws*` to `api:3131`.
  - Serves SPA from `/srv` with fallback to `index.html`.
  - Uses `{$DOMAIN}` and `{$ACME_EMAIL}` envs.
- `.env.example`: template for required/optional variables.

---

## Quick Domain Change

- Edit `.env` → update `DOMAIN` (and `ACME_EMAIL` if needed), then:
```bash
docker compose up -d
```
Caddy will reload with the new domain and re-issue certificates automatically.

---

## Security Notes (Prototype Scope)

- Redis and Postgres are internal-only (Docker network) and not exposed publicly.
- No backups or monitoring in this prototype. Accept data loss.
- For public exposure, rotate `SESSION_SECRET` periodically and avoid reusing credentials elsewhere.

---

## That’s It

This deployment is intentionally minimal. For production-hardening (later): off-box Postgres, backups, metrics, alerting, CI/CD, zero-downtime deploys, and auto-migrations.
