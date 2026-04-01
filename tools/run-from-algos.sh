#!/bin/bash

# Run a TypeScript file in packages/algos using tsx with correct tsconfig.
# Designed to be used from the project root
# Usage: tools/run-from-algos.sh packages/algos/src/path/to/file.ts

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

ALGOS_TSCONFIG="$PROJECT_ROOT/packages/algos/tsconfig.json"

if [ -z "$1" ]; then
  echo "Usage: tools/run-from-algos.sh <path relative to project root>"
  exit 1
fi

if command -v fnm >/dev/null 2>&1; then
  FNM_LOGLEVEL=error eval "$(fnm env --use-on-cd --log-level error)"
fi

fnm use >/dev/null 2>&1
npx tsx --tsconfig "$ALGOS_TSCONFIG" "$@"
