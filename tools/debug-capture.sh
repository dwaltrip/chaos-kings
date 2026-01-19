#!/bin/bash
# Ensures dev server is running, opens browser with debug session param, waits for capture
# Usage: ./tools/debug-capture.sh [duration_seconds] [--skip-open] [route]
# Example: ./tools/debug-capture.sh 5 /puzzles/play
# Example: ./tools/debug-capture.sh 3 --skip-open

set -e

DURATION=3
SKIP_OPEN=false
ROUTE="/"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-open)
      SKIP_OPEN=true
      shift
      ;;
    /*)
      ROUTE="$1"
      shift
      ;;
    *)
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        DURATION="$1"
      fi
      shift
      ;;
  esac
done

# Generate unique session ID
SESSION_ID="debug-$(date +%s)-$RANDOM"

# Ensure .debug directory exists
mkdir -p apps/frontend/.debug

# Check if both frontend and backend are running
FRONTEND_UP=false
BACKEND_UP=false

if curl -s -o /dev/null http://localhost:5173 2>/dev/null; then
  FRONTEND_UP=true
fi
if curl -s -o /dev/null http://localhost:3131/api/health 2>/dev/null; then
  BACKEND_UP=true
fi

if [ "$FRONTEND_UP" = "false" ] || [ "$BACKEND_UP" = "false" ]; then
  echo "Starting dev servers (frontend: $FRONTEND_UP, backend: $BACKEND_UP)..."
  bash tools/dev-all.sh > apps/frontend/.debug/dev-server.log 2>&1 &
  DEV_PID=$!
  echo "Dev server PID: $DEV_PID (log: apps/frontend/.debug/dev-server.log)"

  # Wait for both servers to be ready
  for i in {1..30}; do
    FRONTEND_UP=false
    BACKEND_UP=false
    if curl -s -o /dev/null http://localhost:5173 2>/dev/null; then
      FRONTEND_UP=true
    fi
    if curl -s -o /dev/null http://localhost:3131/api/health 2>/dev/null; then
      BACKEND_UP=true
    fi
    if [ "$FRONTEND_UP" = "true" ] && [ "$BACKEND_UP" = "true" ]; then
      echo "Dev servers ready"
      break
    fi
    sleep 1
  done

  if [ "$FRONTEND_UP" = "false" ] || [ "$BACKEND_UP" = "false" ]; then
    echo "ERROR: Dev servers failed to start (frontend: $FRONTEND_UP, backend: $BACKEND_UP)"
    echo "Check apps/frontend/.debug/dev-server.log"
    exit 1
  fi
else
  echo "Dev servers already running"
fi

# Open browser with debug session param (unless skipped)
URL="http://localhost:5173${ROUTE}?debug_capture=${SESSION_ID}"
if [ "$SKIP_OPEN" = "false" ]; then
  echo "Opening: $URL"
  open "$URL"
else
  echo "Skipping browser open. Navigate to: $URL"
fi

echo "Waiting ${DURATION}s for capture..."
sleep "$((DURATION + 2))"

# Output result
OUTPUT_FILE="apps/frontend/.debug/latest.json"
if [ -f "$OUTPUT_FILE" ]; then
  echo ""
  echo "Capture complete: $OUTPUT_FILE"
  echo "Session: $SESSION_ID"
else
  echo ""
  echo "WARNING: Output file not found. Debug instrumentation may not have run."
  echo "Expected: $OUTPUT_FILE"
fi
