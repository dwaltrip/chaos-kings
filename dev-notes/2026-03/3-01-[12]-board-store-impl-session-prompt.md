# Session: BoardStore Implementation (Part 1 — Core + Tests)

## Goal

Implement the `BoardStore` — a framework-agnostic game state layer that replaces Zustand for board state management. This session covers only the core store and its tests. Integration with pages (sandbox, gameplay, puzzles) happens in follow-up sessions.

## Key Context

**Design doc (the source of truth for this session):**
- `dev-notes/2026-03/3-01-[9]-board-store-design-doc.md`

**Supporting context (read if you need to understand current code or history):**
- `dev-notes/2026-03/3-01-[7]-current-game-state-code-survey.md` — survey of current frontend game state code
- `dev-notes/2026-03/3-01-[11]-board-store-design-review.md` — critical review + findings incorporated into design doc
- `apps/frontend/src/domains/games/stores/board-session-store.ts` — existing Zustand store this replaces
- `apps/frontend/src/domains/gameplay/ui/tile-renderer.tsx` — TileRendererProps interface (render format target)

**Existing game logic to use (don't reinvent):**
- `packages/core/src/board/` — `Board.getVisibleSquares()`, `Board.forEachCoord()`, `Board.getSquare()`, etc.
- `packages/core/src/types.ts` — `BoardState`, `Square`, `Coord`, `Direction`, `Movement`, `SquareType`, etc.

## Output Location

```
apps/frontend/src/domains/games/board-store/
├── board-store.ts
├── types.ts
├── tile-data.ts
├── frame-computation.ts
└── react-bridge.ts
```

Tests alongside or in a `__tests__/` directory — follow existing frontend test conventions.

## Process

Use sub-agents. Main agent orchestrates and updates plans between steps.

**Sub-agent guidelines:**
- Sonnet for implementation when there is a detailed plan.
- Opus for planning, reviews, and design work.
- Haiku for fixing simple bugs, TS errors, and failing tests.
- **Stop criteria for ALL sub-agents:** If you've attempted 3 approaches to fix the same issue and it's still failing, STOP and report what you've tried and what's blocking you. Do not spin.

### Phase 0: Implementation Plan

Main agent reads the design doc and creates a detailed implementation plan as a dev-note. The plan should break the work into small, concrete steps with clear inputs/outputs for each file. Commit the plan.

Then use an opus sub-agent to review the plan for gaps, ordering issues, or things that will be tricky. Main agent updates the plan based on feedback.

### Phase 1: Tests

1. **Testing plan** (opus sub-agent): Design integration-focused tests for the BoardStore. Focus on the public API and the compute → diff → notify pipeline. Each test should carry its weight — no boilerplate. Think about:
   - `applyTick` produces correct `FrameDiff` (which tiles changed?)
   - `setSelectedTile` only changes selection-related tiles
   - `tilesEqual` correctness
   - `computeDerivedState` with different visibility scenarios (normal, ended, spectator)
   - Subscriber notifications (only changed tiles get notified)
   - `init` / `reset` lifecycle
   - Edge cases: null board, first frame (all tiles changed), no-op update (nothing changed)

2. **Review testing plan** (opus sub-agent): Check for completeness and redundancy. Cut tests that don't add value. Suggest helpers to keep tests clean.

3. **Write tests** (sonnet sub-agent): Implement the tests. They will all fail initially — that's expected (TDD). Use smart test helpers to avoid repetition. Commit.

4. **Code review tests** (opus sub-agent): Review for verbosity, repetition, clarity. Tests should be tight and readable.

5. **Address review** (haiku sub-agent): Apply the code review fixes. Commit.

### Phase 2: Implementation

6. **Implement types.ts** (sonnet): All type definitions — `BoardSourceState`, `UIState`, `DerivedState`, `FrameInputs`, `TileData`, `TileChange`, `FrameDiff`. Commit.

7. **Implement tile-data.ts** (sonnet): `tilesEqual`, `toTileRendererProps`, any TileData helpers. Get relevant tests passing. Commit.

8. **Implement frame-computation.ts** (sonnet): `computeDerivedState`, `computeTileData`, `computeFrameAndDiff`. Get relevant tests passing. Commit.

9. **Implement board-store.ts** (sonnet): The `BoardStore` class — state management, public API, subscription system, `applyUpdate` flow. Get all tests passing. Commit.

10. **Implement react-bridge.ts** (sonnet): `useTileData`, `useBoardSourceState`, `BoardTile`, `toTileRendererProps`. No tests needed for this file in this session — it's thin React glue. Commit.

11. **Code review full implementation** (opus sub-agent): Review all files for correctness, style, adherence to design doc and project conventions (AGENTS.md). Check that exports are at the end of files, imports are ordered correctly, comments are minimal.

12. **Address review** (sonnet or haiku): Fix issues. Commit.

### Phase 3: Verify + Wrap Up

13. Run `bash tools/build-all.sh` — fix any TS errors.
14. Run `bash tools/test-all.sh` — all tests pass.
15. Final commit with clean state.

## Style Reminders

- Follow AGENTS.md conventions (import order, exports at end, kebab-case files, minimal comments)
- Use existing `@core` utilities — don't reimplement board traversal, visibility, etc.
- Keep it simple. This is v1 — optimize later.

## What This Session Does NOT Do

- No integration with any page (gameplay, sandbox, puzzles)
- No removal of old Zustand stores
- No changes to existing components or actions
- No backend changes
