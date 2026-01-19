#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

ZDOTDIR_PATH="$PROJECT_ROOT/.codex/zsh"
mkdir -p "$ZDOTDIR_PATH"

NODE_VERSION_FILE="$PROJECT_ROOT/.node-version"
NODE_VERSION=""
NODE_BIN=""
if [ -f "$NODE_VERSION_FILE" ]; then
  NODE_VERSION="$(cat "$NODE_VERSION_FILE")"
  NODE_BIN="$HOME/.fnm/node-versions/$NODE_VERSION/installation/bin"
  if [ -d "$NODE_BIN" ]; then
    export PATH="$NODE_BIN:$PATH"
  fi
fi

cat > "$ZDOTDIR_PATH/.zprofile" <<'EOF'
PROJECT_ROOT="$(cd "$(dirname "${(%):-%N}")/../.." && pwd)"
NODE_VERSION_FILE="$PROJECT_ROOT/.node-version"
if [ -f "$NODE_VERSION_FILE" ]; then
  NODE_VERSION="$(cat "$NODE_VERSION_FILE")"
  NODE_BIN="$HOME/.fnm/node-versions/$NODE_VERSION/installation/bin"
  if [ -d "$NODE_BIN" ]; then
    export PATH="$NODE_BIN:$PATH"
  fi
fi
EOF

cat > "$ZDOTDIR_PATH/.zshenv" <<'EOF'
PROJECT_ROOT="$(cd "$(dirname "${(%):-%N}")/../.." && pwd)"
NODE_VERSION_FILE="$PROJECT_ROOT/.node-version"
if [ -f "$NODE_VERSION_FILE" ]; then
  NODE_VERSION="$(cat "$NODE_VERSION_FILE")"
  NODE_BIN="$HOME/.fnm/node-versions/$NODE_VERSION/installation/bin"
  if [ -d "$NODE_BIN" ]; then
    export PATH="$NODE_BIN:$PATH"
  fi
fi
EOF

if command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env --use-on-cd)"
  fnm use --silent-if-unchanged
fi

CODEX_BIN="$(command -v codex || true)"
if [ -z "$CODEX_BIN" ]; then
  echo "codex not found on PATH" >&2
  exit 1
fi

ZDOTDIR="$ZDOTDIR_PATH" exec "$CODEX_BIN" "$@"
