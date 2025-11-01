#!/bin/bash

# Build script for Generals v2 - builds both frontend and backend
set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Get the project root (parent of tools directory)
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Below, if we want the fnm calls to fail silently,
# we can switch to `fnm use 2>/dev/null` || true`.

echo "Building backend..."
cd "$PROJECT_ROOT/apps/backend"
if command -v fnm >/dev/null 2>&1; then
	fnm use
else
	echo "fnm not found; aborting build. Install fnm or ensure Node is available." >&2
	exit 1
fi
npm run build

echo "Building frontend..."
cd "$PROJECT_ROOT/apps/frontend"
if command -v fnm >/dev/null 2>&1; then
	fnm use
else
	echo "fnm not found; aborting build. Install fnm or ensure Node is available." >&2
	exit 1
fi
npm run build

echo "✅ All builds completed successfully!"
