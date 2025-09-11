#!/usr/bin/env bash
set -euo pipefail

# First Deploy Script (Prototype)
# This script bootstraps a fresh Ubuntu 22.04 droplet with Docker and runs the app.
# Usage: ssh into the droplet and run: bash first-deploy.sh

echo "[1/6] System update + Docker install"
sudo apt update && sudo apt -y upgrade
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
sudo usermod -aG docker "$USER" || true

echo "[2/6] Firewall (ufw)"
sudo ufw allow OpenSSH || true
sudo ufw allow 80,443/tcp || true
yes | sudo ufw enable || true

echo "[3/6] Optional: add swap (uncomment to enable)"
echo "# sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile"
echo "# echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab"

echo "[4/6] Repo + env setup"
REPO_DIR="generals-v2"
if [ ! -d "$REPO_DIR" ]; then
  echo "Cloning repo ... (edit URL if needed)"
  git clone <YOUR_REPO_URL> "$REPO_DIR"
fi
cd "$REPO_DIR"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from example. Please edit .env to set DOMAIN, ACME_EMAIL, POSTGRES_PASSWORD, SESSION_SECRET."
  echo "After editing, rerun this script from step 5 (build + up)."
  exit 0
fi

echo "[5/6] Build + start containers"
docker compose build
docker compose up -d

echo "[6/6] Run DB migrations"
docker compose exec api npm run migrate:latest || true

echo "Done! Verify: https://<DOMAIN>  (set in .env)"
echo "API health: curl -k https://<DOMAIN>/api/health"
echo "Logs: docker compose logs -f web | api"

