#!/bin/bash

# Test script for Generals v2 - runs tests for both backend and core
set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Get the project root (parent of tools directory)
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Running backend tests..."
cd "$PROJECT_ROOT/apps/backend" && npm test

echo "Running core tests..."
cd "$PROJECT_ROOT/packages/core" && npm test

echo "✅ All tests completed successfully!"
