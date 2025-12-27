#!/bin/bash

# Initialize fnm for Claude Code sessions
# This hook runs at session start and persists fnm environment variables
# so that the correct Node version is used for all npm commands.

if [ -n "$CLAUDE_ENV_FILE" ]; then
  if command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env --use-on-cd)"

    # Switch to the project's node version
    cd "$(dirname "$0")/.." && fnm use --silent-if-unchanged

    echo "export PATH=\"$PATH\"" >> "$CLAUDE_ENV_FILE"
    echo "export FNM_DIR=\"$FNM_DIR\"" >> "$CLAUDE_ENV_FILE"
    echo "export FNM_MULTISHELL_PATH=\"$FNM_MULTISHELL_PATH\"" >> "$CLAUDE_ENV_FILE"
    echo "export FNM_VERSION_FILE_STRATEGY=\"$FNM_VERSION_FILE_STRATEGY\"" >> "$CLAUDE_ENV_FILE"
    echo "export FNM_LOGLEVEL=\"$FNM_LOGLEVEL\"" >> "$CLAUDE_ENV_FILE"
    echo "export FNM_NODE_DIST_MIRROR=\"$FNM_NODE_DIST_MIRROR\"" >> "$CLAUDE_ENV_FILE"
    echo "export FNM_COREPACK_ENABLED=\"$FNM_COREPACK_ENABLED\"" >> "$CLAUDE_ENV_FILE"
    echo "export FNM_RESOLVE_ENGINES=\"$FNM_RESOLVE_ENGINES\"" >> "$CLAUDE_ENV_FILE"
    echo "export FNM_ARCH=\"$FNM_ARCH\"" >> "$CLAUDE_ENV_FILE"
  fi
fi

exit 0
