#!/usr/bin/env bash
set -euo pipefail

# Update Deployment Script
# Handles git pull, rebuild, restart, and migrations for existing deployments

echo "🚀 Starting deployment update..."

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
  echo "❌ Error: docker-compose.yml not found"
  echo "Make sure you're in the generals-v2 project directory"
  exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
  echo "❌ Error: .env file not found"
  echo "Deployment may not be properly configured"
  exit 1
fi

echo "📥 Pulling latest code..."
git pull || {
  echo "❌ Git pull failed"
  echo "Check git authentication and network connection"
  exit 1
}

echo "🔨 Building updated images..."
docker compose build --pull || {
  echo "❌ Docker build failed"
  echo "Check logs above for build errors"
  exit 1
}

echo "🔄 Restarting services..."
docker compose up -d --remove-orphans || {
  echo "❌ Failed to start services"
  echo "Check: docker compose logs"
  exit 1
}

echo "⏳ Waiting for API readiness..."
timeout 60 bash -c '
  until docker compose logs api 2>/dev/null | grep -q "Server listening\|server.*listening\|listening.*on"; do 
    echo "Still waiting for API server..."
    sleep 2
  done
' || {
  echo "⚠️  API may not be ready yet, but continuing with migration attempt..."
}

echo "🗃️  Running database migrations..."
docker compose exec api npm run migrate:latest || {
  echo "⚠️  Migration failed - this might be expected if no new migrations"
  echo "Check: docker compose exec api npm run migrate:latest"
}

echo ""
echo "✅ Deployment update complete!"

# Get domain from .env for final check
DOMAIN=$(grep "^DOMAIN=" .env | cut -d'=' -f2- | tr -d '"')
if [ -n "$DOMAIN" ]; then
  echo "🌐 Check your deployment: https://$DOMAIN"
  echo "🏥 Health check: curl https://$DOMAIN/api/health"
else
  echo "🏥 Check your deployment and run health check"
fi

echo ""
echo "Useful commands:"
echo "  docker compose ps          # Check service status"
echo "  docker compose logs -f     # Follow all logs"
echo "  docker compose logs api    # Check API logs"