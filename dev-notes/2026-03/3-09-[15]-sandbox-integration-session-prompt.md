# Session Prompt: Sandbox Domain — Board-Store Integration

## Goal

Replace the sandbox domain's use of `boardSessionStore` (shared Zustand store) + per-tile stores via `tileOrchestrator` with the `board-store` module. This is the second board-store integration — puzzles is done and provides a useful reference point, but sandbox has additional complexity worth thinking through carefully.

## Context

Read these docs first (in order):
1. **Board-store README** — `apps/frontend/src/domains/games/board-store/README.md` (API, files, types)
2. **Integration survey** — `dev-notes/2026-03/3-09-[9]-board-store-integration-survey.md` (focus on "Sandbox Domain" section and "Shared Infrastructure Being Replaced")
3. **Puzzles integration sketch** — `dev-notes/2026-03/3-09-[11]-puzzles-integration-sketch.md` (reference for what puzzles did — starting point, not gospel)
4. **Post-integration notes** — `dev-notes/2026-03/3-09-[14]-board-store-post-integration-notes.md` (insights from puzzles, cross-domain synthesis notes)
5. **Integration questions** — `dev-notes/2026-03/3-09-[8]-board-store-integration-questions.md` (open questions)

Also read the completed puzzles integration code for reference — the actions, store, tile component, and page component show one way to do it. But take a fresh look for sandbox rather than assuming the same approach applies everywhere.

## Puzzles as Reference (not prescription)

The puzzles integration provides a starting point:
- `applyTick()` replaced the orchestrator dance
- Puzzle store slimmed to domain-specific fields only
- Tile component collapsed to `useTileData` + `toTileRendererProps`
- Page reads board/tick/selectedTile from `useBoardState(boardStore)`

These patterns may apply directly to the straightforward parts of sandbox (tile component, basic board reads, queueMove). But sandbox has timeline/playback concepts that puzzles doesn't — don't force those into the same mold without thinking them through.

## Phase 1: Research

Before designing anything, research the timeline engine and related prior art in the codebase. This stuff is relatively new and may not be fully integrated yet.

- **Search `packages/core/`** for timeline-related code — look for timeline engine, step processor, replay types, anything related to stepping through game state over time
- **Comb through `dev-notes/`** for timeline/replay/playback design discussions and decisions
- **Check git history** for recent timeline-related commits and their context
- **Read the sandbox actions** that deal with timeline concepts: `step-forward.ts`, `step-back.ts`, `play.ts`, `pause.ts`, `reset.ts`
- **Understand `moveHistoryCache`** and `lastExecutedMove` — how they're used, where they came from, what problem they solve

The goal is to understand: what timeline infrastructure already exists, what's sandbox-specific vs potentially shared, and how board-store should interact with timeline concepts.

Save research findings as a dev-note before moving to Phase 2.

## Phase 2: Collaborative Design Brainstorm

This is a conversation with the user, not a solo design exercise. Surface questions and trade-offs rather than prescribing answers. Key areas to explore:

### Timeline state — where does it live?

Sandbox currently has timeline-related state scattered across stores:
- `isPaused`, `maxTickReached` — in sandboxMetaStore
- `lastExecutedMove` — in boardSessionStore
- `moveHistoryCache` — module-level Map in board-session-store.ts
- `tick` — in boardSessionStore (moving to board-store)

Some of this may be sandbox-specific. Some may be shared timeline infrastructure useful for replay, replay-edit, or other future modes. Questions:
- Is there a "timeline" concept that should be its own module/store?
- Does board-store need to know about timelines, or does timeline logic sit on top of board-store?
- Where do `lastExecutedMove` and `moveHistoryCache` actually belong?

### `stepForward` optimistic computation

`stepForward` builds a `GameState`, runs `processStep` from core, then applies the result. This is the most complex sandbox action. Questions:
- Does board-store need to support this pattern explicitly, or does `applyTick()` with the computed result just work?
- How does this relate to the timeline engine in core?
- The TODO about "use real players array" — does board-store's `players` field help here?

### `applyBoardState` vs `applyTick`

The shared `board-session/actions/apply-state.ts` (`applyBoardState`) is essentially the same orchestrator dance that `applyTick` replaces. After sandbox migrates, does this file still have any consumers, or is it dead code waiting for gameplay to migrate?

### What's straightforward vs what needs thought

Some parts of sandbox migration are mechanical (same as puzzles):
- Tile component → `useTileData` pattern
- `queueMove` → `addQueuedMove` + `setSelectedTile`
- Page/control-bar board reads → `useBoardState(boardStore)`
- `boardStore.reset()` at lifecycle boundaries

Other parts have open questions (timeline state, stepForward, moveHistory). Separate the mechanical from the interesting.

## Phase 3: Implementation

After the brainstorm lands on an approach, implement it. The mechanical parts can follow the puzzles pattern. The timeline-related parts should follow whatever was decided in Phase 2.

Build + test after each meaningful chunk. Commit when working.

## Phase 4: Post-Integration Notes

Update `3-09-[14]-board-store-post-integration-notes.md` with new findings. After this session, both puzzles and sandbox will be done — good checkpoint to revisit cross-domain synthesis questions before gameplay.

## Reference: Current Sandbox Files

For the full file listing and current code, explore `apps/frontend/src/domains/sandbox/`. Key files:

**Actions:** `start-sandbox.ts`, `end-sandbox.ts`, `handle-session-started.ts`, `handle-state-update.ts`, `step-forward.ts`, `step-back.ts`, `play.ts`, `pause.ts`, `reset.ts`, `queue-move.ts`, `clear-moves.ts`, `undo-move.ts`, `handle-error.ts`

**Stores:** `sandbox-meta-store.ts` (sandbox-specific), `board-session-store.ts` (shared, in `games/`)

**UI:** `sandbox-tile.tsx`, `sandbox-board.tsx`, `sandbox-control-bar.tsx`

**Hooks:** `use-sandbox-playback-controls.ts`

**Page:** `sandbox-page.tsx`

**Shared infra being replaced:** `board-session-store.ts`, `tile-orchestrator.ts`, `tile-store-registry.ts`, `board-session/actions/apply-state.ts`
