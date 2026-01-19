#!/bin/bash

# Test script for Generals v2 - runs tests for both backend and core
set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Get the project root (parent of tools directory)
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if command -v fnm >/dev/null 2>&1; then
	# This is needed for codex to pick up the correct Node version
	eval "$(fnm env --use-on-cd)"
else
	echo "fnm not found; aborting tests. Install fnm or ensure Node is available." >&2
	exit 1
fi

echo "Running backend tests..."
cd "$PROJECT_ROOT/apps/backend"
fnm use
npm test

echo ""
echo "Running core tests..."
cd "$PROJECT_ROOT/packages/core"
fnm use
npm test

echo ""
echo "Running frontend tests..."
cd "$PROJECT_ROOT/apps/frontend"
fnm use
npm test

echo ""
echo "✅ All tests completed successfully!"
