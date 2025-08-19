#!/bin/bash

# Clear dev db script for Generals v2
set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Get the project root (parent of tools directory)
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Clearing dev db..."
cd "$PROJECT_ROOT/backend" && npm run clear:dev-db

echo "✅ All builds completed successfully!"
