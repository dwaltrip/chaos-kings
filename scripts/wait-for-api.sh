#!/usr/bin/env bash
set -euo pipefail

# Wait for API Service Readiness Script
# Waits for the API container to be ready before proceeding

TIMEOUT="${1:-60}"  # Default 60 seconds timeout

echo "⏳ Waiting for API service to be ready (timeout: ${TIMEOUT}s)..."

# Wait for container to be running first
echo "Checking if API container is running..."
timeout 30 bash -c 'until docker compose ps api | grep -q "Up"; do sleep 1; done' || {
  echo "❌ API container failed to start within 30 seconds"
  echo "Check logs: docker compose logs api"
  exit 1
}

# Wait for server to be listening
echo "Waiting for API server to start listening..."
timeout "$TIMEOUT" bash -c '
  until docker compose logs api 2>/dev/null | grep -q "Server listening\|server.*listening\|listening.*on"; do 
    echo "Still waiting for API server..."
    sleep 2
  done
' || {
  echo "❌ API server failed to start within ${TIMEOUT} seconds"
  echo ""
  echo "Check API logs:"
  docker compose logs api
  exit 1
}

echo "✅ API service is ready!"
echo "You can now run: docker compose exec api npm run migrate:latest"