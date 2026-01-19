# UI Debug Tools Exploration

**Date:** 2026-01-19

## Summary

Explored approaches for AI-assisted UI debugging - specifically how Claude can inspect browser state, console logs, and game state to help debug frontend issues like the puzzle movement bug.

---

## What We Explored

### 1. Playwright MCP Research

- How MCPs work: JSON-RPC protocol, tool definitions loaded at session start
- Token overhead: MCP definitions add ~2000-5000 tokens every turn
- Headless browser by default, configurable for headed mode

### 2. MCP Token Overhead Problem - Deep Dive

- No per-agent MCP config exists (MCP is scope-based: project/user)
- Tool Search feature defers loading but requires Sonnet+ (Haiku doesn't support)
- `ENABLE_TOOL_SEARCH=auto` kicks in at 10% context usage
- Separate Claude process approach is clunky (loses conversation context)

### 3. Skills-Based Alternative to MCP (Key Insight)

Instead of always-on MCP, use skills to load capabilities on-demand:

- Break Playwright into focused skills: `/browser-screenshot`, `/browser-console`, `/browser-test-flow`
- Each skill loads only ~50-200 tokens (vs 2000-5000 for full MCP)
- Skills invoke lightweight Playwright scripts via Bash
- "Poor man's MCP" but much more token-efficient
- Trade-off: less ad-hoc flexibility, more upfront script work

### 4. Built JSON-Based Debug Capture System

**What it does:**
- Captures state snapshots, Zustand store changes, and console logs
- Saves to `.debug/` directory as JSON files
- Claude can read and analyze the captured data

**Components built:**
- `apps/frontend/src/debug-capture/` - Core module (snapshots, store watching, console capture)
- `apps/frontend/vite-plugins/debug-save-plugin.ts` - Saves output via dev server
- `tools/debug-capture.sh` - Automation script (checks/starts servers, opens browser)
- `.claude/agents/ui-debugger.md` - Agent definition
- `.claude/skills/debug-ui-guide.md` - Usage guide

**Key design decisions:**
- Query param guard (`?debug_capture=SESSION_ID`) prevents multi-tab conflicts
- `isDebugCaptureSession()` helper for instrumentation code
- Separation of concerns: agent runs capture script, parent agent analyzes results
- Workflow: Claude adds instrumentation → script opens browser → capture saves → Claude analyzes

**Limitations discovered:**
- Clunky when there are lots of logs - output gets noisy/hard to parse
- Probably needs filtering, summarization, or structured output improvements
- Manual instrumentation step is friction

### 5. Discovered `--chrome` Flag (Game Changer)

Claude Code has native browser integration via `--chrome` flag:

```bash
claude --chrome
```

**Characteristics:**
- Native integration, NOT MCP
- Zero upfront token cost (only loads when flag used)
- Can access console logs, navigate, click, screenshot, DOM inspect
- Works with authenticated sessions (your real browser)
- Requires visible browser window (not headless)

**Testing results:**
- Works well for inspection and debugging
- Too slow for real-time game interaction (expected)
- Good for: console inspection, state checks, screenshots, slow navigation flows

### 6. Future Ideas Discussed

To make `--chrome` useful for game debugging despite speed limitations:

- **Slow tick rate mode**: `?tick_rate=5000` for 5-second ticks
- **Step-by-step mode**: Game waits for `window.debug.step()` call
- **Freeze mode**: `window.debug.freeze()` / `unfreeze()`

Combining `--chrome` with these modes would enable precise debugging - step through each game tick, inspect state, then continue.

---

## What Was Built/Committed

| File | Purpose |
|------|---------|
| `apps/frontend/src/debug-capture/types.ts` | TypeScript types for debug output |
| `apps/frontend/src/debug-capture/capture.ts` | Core capture API |
| `apps/frontend/src/debug-capture/console-interceptor.ts` | Console log capture |
| `apps/frontend/src/debug-capture/store-watcher.ts` | Zustand store subscription |
| `apps/frontend/src/debug-capture/index.ts` | Public API + window attachment |
| `apps/frontend/src/debug-capture/register-stores.ts` | Auto-registers common stores |
| `apps/frontend/vite-plugins/debug-save-plugin.ts` | Vite middleware for saving |
| `tools/debug-capture.sh` | Automation script (executable) |
| `.claude/agents/ui-debugger.md` | Agent definition |
| `.claude/skills/debug-ui-guide.md` | Skill/usage guide |

---

## Possible Next Steps

### Naming cleanup
- [ ] Rename `ui-debugger` agent - current name is confusing since it's specifically the JSON capture approach. Options: `debug-json-capture`, `state-capture`, `store-debugger`, `debug-snapshot`
- [ ] Rename `debug-ui-guide.md` skill to match

### Game debug modes for `--chrome` workflow
- [ ] Slow tick rate via query param (e.g., `?tick_rate=5000`)
- [ ] Step-by-step mode - game waits for explicit step command
- [ ] Freeze mode - pause/resume game ticks

### Documentation
- [ ] Create `--chrome` usage guide - when to use Chrome integration vs JSON capture
- [ ] Document the two approaches and their trade-offs

### JSON capture improvements
- [ ] Filter/summarize noisy logs
- [ ] Structured output for easier parsing
- [ ] Reduce instrumentation friction

### Skills-based Playwright (if `--chrome` isn't enough)
- [ ] `tools/browser/screenshot.ts` - lightweight script
- [ ] `tools/browser/console.ts` - capture console logs
- [ ] Matching skills for each script

### Testing
- [ ] Use new tools to debug the actual puzzle movement issue

---

## Key Takeaways

1. **MCP has significant token overhead** - tool definitions load every turn, even when unused

2. **`--chrome` is the cleanest solution for ad-hoc debugging** - zero overhead, only loads when needed

3. **Skills-based approach is best for repeated/automated tasks** - scripts + skills = token-efficient

4. **Game needs debug modes** - `--chrome` is too slow for real-time, so slow/step/freeze modes would make it useful

5. **JSON capture works but is clunky** - good for automated state capture, but noisy output needs work
