---
name: debug-ui-guide
description: Guide for capturing UI debug data to diagnose frontend issues.
---

# UI Debug Capture System

A system for capturing frontend state, store changes, and console logs for debugging UI issues.

## Quick Reference

**Manual capture (browser console):**
```javascript
debug.watchAll()              // Watch all registered stores
debug.startConsoleCapture()   // Capture console logs
// ... interact with the UI ...
debug.save()                  // Save to .debug/latest.json
```

**Automated capture (add instrumentation + run script):**
```bash
./tools/debug-capture.sh [duration] [--skip-open] [route]
```

## Workflow for Debugging UI Issues

### 1. Add debug instrumentation

Add a `useEffect` to the target component. Use `isDebugCaptureSession()` to only run when opened via the capture script:

```typescript
import { useEffect } from 'react';
import { isDebugCaptureSession } from '@/debug';

// Inside component:
useEffect(() => {
  if (!isDebugCaptureSession() || !window.debug) return;

  window.debug.snapshot('debug-start', { component: 'ComponentName' });
  window.debug.watchAll();
  window.debug.startConsoleCapture();

  // Optional: trigger specific actions programmatically
  // someAction();

  const timer = setTimeout(() => {
    window.debug.snapshot('debug-end');
    window.debug.save();
  }, 3000); // Match script duration

  return () => clearTimeout(timer);
}, []);
```

### 2. Run the capture script

```bash
./tools/debug-capture.sh 3 /puzzles/play
```

Arguments:
- `duration` - Seconds to wait (default: 3)
- `--skip-open` - Don't open browser (if you already have a tab)
- `route` - URL path (default: `/`)

The script:
- Ensures dev server is running (starts if needed, logs to `.debug/dev-server.log`)
- Opens browser with `?debug_capture=SESSION_ID` query param
- Waits for capture to complete
- Reports output filepath

### 3. Read and analyze the output

```bash
cat apps/frontend/.debug/latest.json
```

Or use the Read tool to analyze the captured data.

### 4. Iterate or clean up

- If more data needed: adjust instrumentation, re-run script
- When done: remove the debug `useEffect`

## Output Format

```json
{
  "sessionId": "debug-1234567890-abc123",
  "traceName": null,
  "startedAt": 123,
  "endedAt": 3456,
  "entries": [
    {
      "timestamp": 0,
      "type": "snapshot",
      "label": "debug-start",
      "data": { "component": "PuzzlePage" }
    },
    {
      "timestamp": 50,
      "type": "store-change",
      "label": "puzzle",
      "data": { /* full store state */ },
      "meta": { "prevValue": { /* previous state */ } }
    },
    {
      "timestamp": 100,
      "type": "console",
      "label": "some log message",
      "data": ["arg1", "arg2"],
      "meta": { "level": "log" }
    }
  ]
}
```

Entry types:
- `snapshot` - Manual snapshots with custom data
- `store-change` - Zustand store state changes (full state + previous)
- `console` - Captured console.log/warn/error calls

## Registered Stores

Auto-registered and watchable via `debug.watch(name)` or `debug.watchAll()`:
- `puzzle` - Puzzle game state
- `gameplay` - Main gameplay state
- `matchmaking` - Matchmaking/lobby state
- `user` - User session state
- `chat` - Chat messages state

## Helper Functions

Available from `@/debug`:
- `isDebugCaptureSession()` - Returns true if page opened with `?debug_capture=` param
- `getDebugSessionId()` - Returns the session ID from query param, or null

## Files

- `apps/frontend/.debug/latest.json` - Debug output (gitignored)
- `apps/frontend/.debug/dev-server.log` - Dev server output if started by script
- `tools/debug-capture.sh` - Capture script
- `apps/frontend/src/debug/` - Debug module source
