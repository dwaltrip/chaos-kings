#!/bin/bash

# Run a TypeScript file in packages/algos using tsx with correct tsconfig.
# Designed to be used from the project root.
#
# Usage:
#   tools/run-from-algos.sh <script> [args...]
#
# <script> can be:
#   - A full path:            packages/algos/src/some/dir/foo.ts
#   - A filename:             foo.ts          (searches packages/algos/src/)
#   - A parent-folder/name:   dir/foo.ts      (searches packages/algos/src/)
#
# If the search finds multiple matches, it exits with an error listing them.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

ALGOS_DIR="$PROJECT_ROOT/packages/algos"
ALGOS_TSCONFIG="$ALGOS_DIR/tsconfig.json"

if [ -z "$1" ]; then
  echo "Usage: tools/run-from-algos.sh <script> [args...]"
  exit 1
fi

INPUT="$1"
shift

# Resolve the script path
if [ -f "$INPUT" ]; then
  RESOLVED="$INPUT"
elif [ -f "$PROJECT_ROOT/$INPUT" ]; then
  RESOLVED="$PROJECT_ROOT/$INPUT"
else
  # Search packages/algos/src/ for a match
  if [[ "$INPUT" == */* ]]; then
    # parent-folder/filename match
    MATCHES=$(find "$ALGOS_DIR" -path "*/$INPUT" -type f)
  else
    # filename-only match
    MATCHES=$(find "$ALGOS_DIR" -name "$INPUT" -type f)
  fi

  COUNT=$(echo "$MATCHES" | grep -c . || true)

  if [ "$COUNT" -eq 0 ]; then
    echo "Error: no matching file found for '$INPUT' in packages/algos/src/"
    exit 1
  elif [ "$COUNT" -gt 1 ]; then
    echo "Error: ambiguous, multiple matches for '$INPUT':"
    echo "$MATCHES" | sed "s|$PROJECT_ROOT/||"
    exit 1
  fi

  RESOLVED="$MATCHES"
fi

if command -v fnm >/dev/null 2>&1; then
  FNM_LOGLEVEL=error eval "$(fnm env --use-on-cd --log-level error)"
fi

fnm use >/dev/null 2>&1
npx tsx --tsconfig "$ALGOS_TSCONFIG" "$RESOLVED" "$@"
