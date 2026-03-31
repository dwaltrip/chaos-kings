#!/bin/bash

# Run a TypeScript file from packages/algos using tsx with correct tsconfig.
# Usage: tools/run-from-algos.sh src/path/to/file.ts

set -e

if [ -z "$1" ]; then
  echo "Usage: tools/run-from-algos.sh <path relative to packages/algos>"
  exit 1
fi

if command -v fnm >/dev/null 2>&1; then
  FNM_LOGLEVEL=error eval "$(fnm env --use-on-cd --log-level error)"
fi

cd packages/algos
fnm use >/dev/null 2>&1
npx tsx --tsconfig tsconfig.json "$@"
