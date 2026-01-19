# Next Session: UI Debug Tools (Continued)

## Context

Continuing UI debug tools exploration from 2026-01-19.

Read `docs/dev-notes/2026-01-19-ui-debug-tools-exploration.md` for full context.

### Quick summary

- Built a JSON-based debug capture system (state snapshots, store watching, console logs)
- Discovered `claude --chrome` flag - native browser integration with zero token overhead
- JSON capture works but is clunky with lots of logs - prototype quality
- `--chrome` is too slow for real-time game interaction but great for inspection

---

## Goals for this session

### 1. Cleanup/rename the JSON debug tool (first)

- Rename `ui-debugger` agent to something clearer (e.g., `debug-json-capture`, `state-snapshot-debugger`)
- Update skill description to indicate prototype/rough edges status
- Files: `.claude/agents/ui-debugger.md`, `.claude/skills/debug-ui-guide.md`

### 2. Explore `--chrome` workflows for UI debugging

The challenge: `--chrome` is a session-level flag, so sub-agents in a normal session can't use it directly.

**Options to explore:**

- **Separate Claude process**: Sub-agent spawns `claude --chrome -p "task"` and manages it
- **Wrapper script**: `tools/chrome-debug.sh` that invokes Claude with --chrome for specific tasks
- **Hybrid**: Normal session for coding, separate --chrome session for browser work (manual switching)

**Questions to answer:**

- Can a sub-agent effectively manage a separate `claude --chrome` process?
- What's the cleanest way to pass context/tasks to the --chrome session?
- How do we get results back (files? stdout?)

### 3. If time: Game debug modes

- Slow tick rate via query param
- Step-by-step mode for precise debugging with --chrome
- Freeze mode

---

## Relevant files

| File | Purpose |
|------|---------|
| `docs/dev-notes/2026-01-19-ui-debug-tools-exploration.md` | Full session notes |
| `.claude/agents/ui-debugger.md` | Agent to rename |
| `.claude/skills/debug-ui-guide.md` | Skill to update |
| `apps/frontend/src/debug-capture/` | JSON capture module |
| `tools/debug-capture.sh` | Capture automation script |
