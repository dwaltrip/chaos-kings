# Prototype Deploy Guide (DigitalOcean, Docker Compose)

This guide shows a developer how to deploy the Generals v2 prototype to a single DigitalOcean droplet using Docker Compose and Caddy. It prioritizes simplicity over robustness.

## ⚠️ Before You Start - Pre-Deployment Checklist

**Complete these steps BEFORE touching the droplet:**

✅ **Domain & DNS Ready**
   - DNS A record points to droplet IP: `dig yourdomain.com +short` should return the droplet IP
   - Wait 10-30 minutes after DNS change for propagation
   - Have your domain and email ready for `.env` file

✅ **Git Access Ready**
   - Know your actual repo URL (replace `git@github.com:your-username/generals-v2.git`)
   - SSH key added to GitHub/GitLab (or have personal access token ready)

✅ **Passwords Generated**
   - Strong POSTGRES_PASSWORD ready
   - SESSION_SECRET ready (run: `openssl rand -base64 32`)

✅ **Droplet Sizing Decision Made** (see guide below)

---

## Droplet Sizing Decision Tree

**Use 2GB droplet ($12/mo)** if:
- You want faster builds (5-10 min vs 15-20 min)
- You plan frequent updates
- Budget allows (recommended)

**Use 1GB droplet ($6/mo) + 2GB swap** if:
- Budget is tight
- Infrequent deployments only
- Don't mind slower builds

---

## TL;DR — First Deploy Checklist

**After completing pre-deployment checklist above:**

- Clone + env:
  - `git clone git@github.com:your-username/generals-v2.git generals-v2 && cd generals-v2`
  - `cp .env.example .env` and set all required variables
  - Validate env: `./scripts/validate-env.sh` (or manual check)
- Install Docker + firewall:
  - `sudo apt update && sudo apt -y upgrade`
  - `curl -fsSL https://get.docker.com | sh`
  - `sudo usermod -aG docker $USER` then **log out and back in**
- Optional swap (1 GB droplets only):
  - `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`
  - `echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab`
- Firewall: `sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw --force enable`
- Build + run:
  - `docker compose build`
  - `docker compose up -d`
- Wait for API readiness + migrate:
  - `./scripts/wait-for-api.sh` (or wait ~30 seconds)
  - `docker compose exec api npm run migrate:latest`
- Verify:
  - Visit `https://yourdomain.com`
  - Health: `curl https://yourdomain.com/api/health`

**Stack Overview:**
- React (Vite) SPA + Fastify API + PostgreSQL + Redis  
- Single domain: SPA at `/`, API at `/api/*`, WebSocket at `/ws`
- SSL: Automatic via Caddy + Let's Encrypt
- Build: On droplet, CI/CD: Manual `git pull`

---

## Prerequisites

- DigitalOcean account (or any VPS with Ubuntu 22.04)
- Domain you control with DNS access
- SSH access to droplet as user with sudo
- Git authentication setup (SSH key or personal access token)

---

## Git Authentication Setup

**For private repos, set up authentication FIRST:**

### SSH Key Method (Recommended)
```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your-email@example.com"

# Copy public key and add to GitHub/GitLab
cat ~/.ssh/id_ed25519.pub

# Test authentication (should show success message)
ssh -T git@github.com
```

### Personal Access Token Method
```bash
# Use HTTPS clone with token
git clone https://your-token@github.com/your-username/generals-v2.git generals-v2
```

---

## DNS Setup & Verification

**Do this BEFORE starting deployment:**

1. Create A record: `yourdomain.com -> droplet-ip`
2. Verify DNS propagation:
   ```bash
   dig yourdomain.com +short  # Should return your droplet IP
   ```
3. Wait 10-30 minutes if DNS not propagated yet

**⚠️ SSL certificates will FAIL if DNS doesn't resolve to your droplet**

---

## Droplet Provisioning

- **OS**: Ubuntu 22.04 LTS
- **Size**: See droplet sizing decision tree above
- **Access**: SSH access as user with sudo privileges

---

## Server Bootstrap

### 1) Update System & Install Docker
```bash
# Update system packages
sudo apt update && sudo apt -y upgrade

# Install Docker
curl -fsSL https://get.docker.com | sh

# Add user to docker group
sudo usermod -aG docker $USER

# ⚠️ IMPORTANT: Log out and back in (or start new SSH session) 
# before proceeding. Docker commands will fail otherwise.
```

**After logging back in, verify Docker works:**
```bash
docker --version  # Should show version without sudo
```

### 2) Setup Firewall
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw --force enable
```

### 3) Add Swap (1GB Droplets Only)
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify swap is active
free -h
```

---

## Clone Repository & Environment Setup

### 1) Clone Repository
```bash
# Replace with your actual repo URL
git clone git@github.com:your-username/generals-v2.git generals-v2
cd generals-v2
```

### 2) Create Environment File
```bash
cp .env.example .env
```

### 3) Configure Required Environment Variables

**Edit `.env` and set these REQUIRED variables:**
```bash
# Replace with your actual values
DOMAIN=yourdomain.com
ACME_EMAIL=your-email@example.com  
POSTGRES_PASSWORD=your-strong-password-here
SESSION_SECRET=your-session-secret-here
```

**Generate secure SESSION_SECRET:**
```bash
openssl rand -base64 32
```

**Optional variables (defaults work for prototype):**
- `POSTGRES_DB`, `POSTGRES_USER` (defaults: `appdb`, `appuser`)
- `DATABASE_URL`, `REDIS_URL` (auto-generated from other vars)
- `CORS_ORIGIN` (not needed for same-origin setup)

**Development-only variables (not used in production):**
- `VITE_API_BASE_URL`, `VITE_WS_URL`

### 4) Validate Environment Configuration

**Manual validation - ensure these are NOT default values:**
```bash
# These should show your actual values, not defaults
grep "DOMAIN=" .env          # Should be your domain
grep "ACME_EMAIL=" .env      # Should be your email  
grep "POSTGRES_PASSWORD=" .env  # Should NOT be "change_me"
grep "SESSION_SECRET=" .env     # Should NOT be "change_me"
```

---

## Build and Start Services

### 1) Build All Services
```bash
docker compose build
```
This builds: `db` (Postgres), `redis`, `api` (Fastify), `web` (Caddy + SPA)

**Expected build time:**
- 2GB droplet: 5-10 minutes
- 1GB droplet + swap: 15-20 minutes

### 2) Start Services
```bash
docker compose up -d
```

### 3) Check Service Status
```bash
docker compose ps
# All services should show "Up" status
```

**If any services show "Exited" status, check logs:**
```bash
docker compose logs service-name  # Replace with actual service name
```

---

## Database Migration

**⚠️ Wait for API service to be ready before running migrations:**

### 1) Wait for API Readiness
```bash
# Wait for API to show "Server listening" in logs
docker compose logs -f api | grep -m1 "Server listening"
# Or wait ~30 seconds after services start
```

### 2) Run Migrations
```bash
docker compose exec api npm run migrate:latest
```

**Expected output:** Migration success messages, no errors.

---

## Verify the Deployment

### 1) Test Web Application
```bash
# Open in browser
https://yourdomain.com
```
**Expected:** Game interface loads, no SSL warnings

### 2) Test API Health Endpoint
```bash
curl https://yourdomain.com/api/health
```
**Expected response:** `{"status":"ok",...}` (no SSL errors)

### 3) Test WebSocket Connection
1. Open browser developer tools (F12)
2. Go to Network tab, filter by "WS" (WebSocket)  
3. Refresh the page
4. Should see `wss://yourdomain.com/ws` with status `101 Switching Protocols`

### 4) Check Service Logs (if issues)
```bash
# Check all services
docker compose logs

# Check specific service
docker compose logs web    # Caddy/SSL issues
docker compose logs api    # Backend issues
docker compose logs db     # Database issues
```

---

## Updating the Deployment

### Standard Update Process
```bash
cd generals-v2
git pull
docker compose build --pull
docker compose up -d --remove-orphans

# Wait for API readiness 
docker compose logs -f api | grep -m1 "Server listening"

# Run migrations if schema changed
docker compose exec api npm run migrate:latest
```

### Quick Update Helper Script
Create `/scripts/update-deploy.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail

echo "Updating deployment..."
git pull
docker compose build --pull  
docker compose up -d --remove-orphans

echo "Waiting for API readiness..."
timeout 30 bash -c 'until docker compose logs api 2>/dev/null | grep -q "Server listening"; do sleep 1; done'

echo "Running migrations..."
docker compose exec api npm run migrate:latest

echo "Update complete! Check https://yourdomain.com"
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

## Troubleshooting Common Issues

### 🔴 Git Clone Fails
**Problem:** `fatal: repository not found` or permission denied
**Solutions:**
- Verify repo URL is correct (not placeholder)
- Check SSH key is added to GitHub/GitLab
- Test authentication: `ssh -T git@github.com`
- For HTTPS: use personal access token in URL

### 🔴 Docker Permission Denied  
**Problem:** `permission denied while trying to connect to Docker daemon`
**Solution:** 
- Log out and back in after `usermod -aG docker $USER`
- Or start new SSH session
- Verify with: `docker --version` (no sudo needed)

### 🔴 DNS/SSL Certificate Issues
**Problem:** SSL certificate issuance fails, site shows SSL errors
**Solutions:**
- Verify DNS: `dig yourdomain.com +short` should return droplet IP
- Wait 10-30 minutes for DNS propagation  
- Check `.env` has correct `DOMAIN` and `ACME_EMAIL`
- Check Caddy logs: `docker compose logs web`

### 🔴 Environment Variable Errors
**Problem:** Services fail to start, error about missing env vars
**Solution:** Verify `.env` file:
```bash
# Check required variables are set (not empty/default)
grep -E "DOMAIN=|ACME_EMAIL=|POSTGRES_PASSWORD=|SESSION_SECRET=" .env
```

### 🔴 502 Bad Gateway
**Problem:** Caddy shows 502, site won't load
**Solutions:**
- Check API service: `docker compose logs api`
- Ensure API is listening: `docker compose ps` (api should show "Up")
- Wait for API readiness before testing

### 🔴 Out of Memory During Build
**Problem:** Build fails, "killed" messages, or very slow builds
**Solutions:**
- Add swap: see "Add Swap" section above
- Or upgrade to 2GB droplet
- Check memory: `free -h`

### 🔴 Migration Fails
**Problem:** `docker compose exec api npm run migrate:latest` fails
**Solutions:**
- Ensure API container is running: `docker compose ps`
- Wait for API readiness first: `docker compose logs api | grep "Server listening"`
- Check database is accessible: `docker compose logs db`

### 🔴 Data Loss/Reset
**Problem:** Database data disappeared after restart
**Cause:** Docker volumes removed
**Prevention:** Never run `docker volume rm` or `docker compose down -v`
**Check volumes:** `docker volume ls | grep generals`

### 🔴 Port Already in Use  
**Problem:** Cannot start services, port binding errors
**Solutions:**
- Check what's using ports: `sudo netstat -tlnp | grep :80\|:443`
- Stop conflicting services (Apache, nginx, etc.)
- Ensure firewall allows 80/443: `sudo ufw status`

### 🔴 Git Authentication in Updates
**Problem:** `git pull` fails with permission denied
**Solution:** 
- Re-test SSH: `ssh -T git@github.com`
- Or switch to HTTPS with token

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

## Success! 🎉

Your Generals v2 prototype should now be live at `https://yourdomain.com`

### Post-Deployment Checklist
✅ Game loads without SSL warnings  
✅ API health check returns success  
✅ WebSocket connection established  
✅ You can create/join game rooms  
✅ Bookmark this guide for updates and troubleshooting  

### Next Steps
- **Monitor**: Watch `docker compose logs` occasionally  
- **Updates**: Use the update commands when deploying changes
- **Backups**: Consider occasional database exports for critical data
- **Performance**: Monitor with `htop` and `docker stats`

---

## Important Notes

This deployment is **intentionally minimal** for prototype/playtest phase. 

**For production-hardening later**, consider:
- Off-server Postgres with backups
- Monitoring & alerting (Grafana, etc.)
- CI/CD pipeline 
- Zero-downtime deployments
- Load balancing
- Automated migrations
