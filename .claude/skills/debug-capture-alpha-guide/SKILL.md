---
name: debug-capture-alpha-guide
description: Use when debugging frontend/UI issues like broken rendering, state bugs, or unexpected behavior. Explains how to capture Zustand store state, console logs, and component behavior via the debug capture system.
---

# Debug Capture System (Alpha)

**Status:** Alpha/prototype. This approach works but has rough edges - output can be noisy with lots of logs, and manual instrumentation adds friction. May work well for certain debugging scenarios, especially with future improvements.

## Overview

Captures frontend state, Zustand store changes, and console logs as JSON for offline analysis. Useful when you need to inspect state transitions or track down bugs that are hard to reproduce.

## Workflow

### 1. Add instrumentation (you do this)

Add a `useEffect` to the target component. Use `isDebugCaptureSession()` to only run when opened via the capture script:

```typescript
import { useEffect } from 'react';
import { isDebugCaptureSession } from '@/debug-capture';

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

### 2. Spawn the runner agent

Use the `debug-capture-runner` agent to run the capture:

```
Spawn debug-capture-runner with: "Run capture for 3 seconds on /puzzles/play"
```

The runner will:
- Ensure dev server is running
- Open browser with `?debug_capture=SESSION_ID`
- Wait for capture to complete
- Return the output filepath

### 3. Analyze the output (you do this)

Read the captured data:
```
apps/frontend/.debug/YYYY-MM-DD-{sessionId}.json
```

Or if a save name was provided:
```
apps/frontend/.debug/YYYY-MM-DD-{sessionId}-{saveName}.json
```

### 4. Clean up (you do this)

Remove the debug `useEffect` when done debugging.

## Output Format

```json
{
  "sessionId": "debug-1234567890-abc123",
  "startedAt": 123,
  "endedAt": 3456,
  "entries": [
    { "timestamp": 0, "type": "snapshot", "label": "debug-start", "data": {...} },
    { "timestamp": 50, "type": "store-change", "label": "puzzle", "data": {...} },
    { "timestamp": 100, "type": "console", "label": "log message", "data": [...] }
  ]
}
```

Entry types:
- `snapshot` - Manual snapshots with custom data
- `store-change` - Zustand store state changes (full state + previous)
- `console` - Captured console.log/warn/error calls

## Available Stores

Auto-registered for `debug.watch(name)` or `debug.watchAll()`:
- `puzzle`, `gameplay`, `matchmaking`, `user`, `chat`

## Alternative: Manual Console Capture

If you don't need the automated script, you can run commands directly in browser console:

```javascript
debug.watchAll()
debug.startConsoleCapture()
// ... interact with UI ...
debug.save()
```

## Files

| File | Purpose |
|------|---------|
| `apps/frontend/.debug/YYYY-MM-DD-{sessionId}.json` | Captured output (gitignored) |
| `tools/debug-capture-alpha.sh` | Automation script |
| `apps/frontend/src/debug-capture/` | Debug module source |
