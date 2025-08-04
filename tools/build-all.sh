#!/bin/bash

# Build script for Generals v2 - builds both frontend and backend
set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Get the project root (parent of tools directory)
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Building backend..."
cd "$PROJECT_ROOT/backend" && npm run build

echo "Building frontend..."
cd "$PROJECT_ROOT/frontend" && npm run build

echo "✅ All builds completed successfully!"
