# Debug Capture Module

**Status:** Alpha/prototype quality

## Overview

Captures frontend state snapshots, Zustand store changes, and console logs as JSON for offline analysis. Useful for debugging complex state transitions and hard-to-reproduce bugs.

## How It Works

1. **Browser-side capture:** The module exposes a `window.debug` API that collects:
   - Manual snapshots with custom data
   - Zustand store state changes (full state + previous state)
   - Console log/warn/error calls

2. **Save mechanism:** Captured data is saved via POST to `/__debug_save` endpoint, which is handled by the Vite plugin during development

3. **File output:** Data is written to `apps/frontend/.debug/YYYY-MM-DD-{sessionId}.json` (or with optional save name: `YYYY-MM-DD-{sessionId}-{saveName}.json`)

## Session ID Format

Session IDs follow the format: `debug-{timestamp}-{random}`

Where:
- `timestamp` - Unix timestamp in milliseconds
- `random` - 6-character random alphanumeric string

## Key Files

- **capture.ts** - Core capture logic, session management, and ring buffer
- **store-watcher.ts** - Zustand store change tracking
- **console-interceptor.ts** - Console method interception
- **types.ts** - TypeScript types for debug entries and output
- **index.ts** - Public API exposed via `window.debug`
- **register-stores.ts** - Pre-registers app stores for convenient watching

## Usage

See `.claude/skills/debug-capture-alpha-guide/SKILL.md` for detailed usage instructions.

## Notes

This is alpha/prototype quality. The approach works but has rough edges:
- Output can be noisy with lots of logs
- Manual instrumentation adds friction
- May work well for certain debugging scenarios with future improvements
