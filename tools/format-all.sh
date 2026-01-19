#!/bin/bash

# Format script for Generals v2 - formats all code with Prettier
set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Get the project root (parent of tools directory)
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Formatting all code with Prettier..."
echo "Testing pre-commit hook again"
cd "$PROJECT_ROOT" && npm run format

echo "✅ All code formatted successfully!"