# Replay MVP — Review, Analysis, and Proposals

Date: 2025-09-18

## Context & Scope
- Commits reviewed starting at: `5b54397` ("core: add replay types and step processor; add replayer helper; refactor GameConfig…")
- Subsequent related commits: `4523bbf`, `c8df7bc`, `385be79`.
- Key files:
  - Core: `core/src/replay/types.ts`, `core/src/step-processor.ts`, `core/src/replay/replayer.ts`, `core/src/game-config.ts`
  - Backend: `backend/src/game/actions/create-game.ts` (+ test), `backend/src/gameplay/game-server.ts`, `backend/src/game/game-repository.ts`, `backend/src/game/actions/end-game.ts`
  - Docs: `dev-notes/2025-09-18-replay-mvp.md`, `dev-notes/2025-09-18-replay-follow-ups.md`

## Summary
The replay MVP design—append-only event log of applied moves, deterministic re-simulation from a snapshot GameConfig, and minimal DB overhead—is solid. Implementation mostly aligns with the planning docs. A few cleanups will improve consistency, maintainability, and determinism: unify "step" terminology, relocate `validateMove`, dedupe `TimingConfig`, fix a seed mismatch, and extract move-history flushing. Add tests for determinism and validation.

## Core Findings
1) Step vs Tick Terminology
- New code introduces “step”-based semantics but core processor uses `processTick` and `…ProductionTicks` fields.
- Proposal: adopt “step” for new APIs and plan a follow-up rename for older identifiers. E.g., `processStep`, `stepWithTiming`, `generalProductionSteps`, `armyProductionSteps`.

2) `validateMove` Placement
- Currently inside `core/src/step-processor.ts`. This muddies concerns.
- Proposal: move to `core/src/moves/validate-move.ts` and import from the processor.

3) `TimingConfig` Duplication
- Defined in `core/src/replay/types.ts` and also inline as `GameConfig['timing']`.
- Proposal: define `TimingConfig` once (e.g., `core/src/timing/types.ts`), re-export where needed, and reference in `GameConfig` and replay types.

4) Replayer Iteration & Cloning Safety
- `replayFrames` runs until game end; with partial history or stalemates it can loop indefinitely. `deepCloneBoard` shallow-copies squares and their `coord` only.
- Proposals:
  - Add `maxSteps?: number` and/or `stopAfterLastEvent?: boolean` to bound iteration.
  - Use or add a robust board cloning utility to avoid shared references (future-proofing if squares gain nested objects).

5) GameConfig Snapshot & Engine Versioning
- Snapshot shape is good (players, generation, timing). Versioning (`engineVersion`) is noted but not implemented.
- Proposal: add optional `engineVersion` soon to pin replay determinism across engine changes.

## Backend Findings
1) `create-game.ts`
- Seed mismatch risk: `generateGameMapV2(..., Date.now())` and `generation.seed: Date.now()` can differ.
  - Proposal: `const seed = Date.now();` use it for both map gen and config.
- Defaults built ad hoc; prefer centralized creators.
  - Proposal: add `createDefaultTimingConfig()` and `createDefaultGenerationConfig({ seed, overrides? })` in core; import and use here.
- Type-only import: use `import type { GameConfig }` for type extraction.
- Unused `generals` from `generateGameMapV2`—drop if not needed.

2) `game-server.ts`
- Good: one applied move per player per step; sorting in core; buffer applied events; periodic flush (1s); final flush on end/cleanup; include `gameId` in payloads.
- `timing = (this.gameState.config as any)?.timing`—avoid `any` proliferation.
  - Proposal: narrow once: `const { timing } = this.gameState.config as GameConfig;`
- Defeated players handling not implemented (queues not cleared; future moves ignored).
  - Proposal: implement per follow-ups: compute defeated players per step (either via core return or server diff of generals).
- Unused params (e.g., `generationConfig` in initializer). Remove or use.
- Move-history flush coupling.
  - Proposal: extract `MoveHistoryBuffer` (+ simple flusher) to decouple server logic and ease future durability (e.g., Redis) and testing.
- Cleanup flow: `void this.flushMoveHistory(true)` can lose last flush if process exits immediately.
  - Proposal: make upstream cleanup awaitable and await final flush.

3) Repository & End Game
- Combined `updateStatusGameStateAndMoveHistory` helper is good.
- `EndGameParams.moveHistory?` is optional. If we always expect replays for completed games, consider making it required to prevent omissions; if not (aborted games), keep optional.

## Import Order Policy
- Standardize: third-party → `@common/...` → `@core/...` → local app (`@/...` for backend/fe).
- Proposal: add eslint import order rule and document in `AGENTS.md` to prevent drift.

## Docs vs Code Alignment
- Implemented: deterministic sort in core; replay from snapshot config/timing; buffered flush; include `gameId` in messages.
- Pending: defeated player tracking; deterministic replay test/CLI; FE updates that rely on `players.colors`/`players.count`.

## Testing Plan
- Core unit tests:
  - `validateMove` cases (ownership, bounds, insufficient units, blocked destination).
  - `processStep` ordering and conflict behavior.
- Determinism integration test:
  - Load `config` + `move_history`, run replayer to completion, assert final board equals saved `game_state.board`.
- Backend smoke test:
  - Simulate short game with applied moves; verify periodic `move_history` updates and final flush.

## Edge Cases & Risks
- Memory growth: `appliedEvents` grows for entire game. Acceptable for MVP; consider chunking + trimming post-confirmed flush for longer games.
- Replay termination: Bound iteration to avoid infinite loops on partial histories.
- Event ordering bias: deterministic sort by `playerIndex` implicitly favors lower indices on conflicts—document or adjust if needed.

## Proposed Action Items
1) Terminology
- [ ] Rename new APIs/identifiers to “step” (e.g., `processStep`, `…ProductionSteps`).
- [ ] Plan a follow-up rename of `GameState.tick` → `step` (defer if too invasive now).

2) Core structure
- [ ] Move `validateMove` to `core/src/moves/validate-move.ts` and import from processor.
- [ ] Centralize `TimingConfig` (e.g., `core/src/timing/types.ts`) and reference from replay + GameConfig.
- [ ] Add `maxSteps` and/or `stopAfterLastEvent` to `replayFrames`.
- [ ] Replace `deepCloneBoard` with a robust board clone utility.
- [ ] Add optional `engineVersion` into `GameConfig` snapshot.

3) Backend improvements
- [ ] Fix `create-game` seed mismatch (`const seed = Date.now()` for both places).
- [ ] Add and use `createDefaultTimingConfig()` and `createDefaultGenerationConfig()` from core.
- [ ] Switch to type-only import for `GameConfig` usage.
- [ ] Remove unused `generals` variable if truly unused.
- [ ] Narrow `timing` type in `game-server` via `GameConfig` rather than `any`.
- [ ] Implement defeated players handling; clear queues and ignore new submissions post-defeat.
- [ ] Remove or use unused initializer params; simplify init flow.
- [ ] Extract move-history buffer/flusher to its own helper; make cleanup await flush.
- [ ] Decide if `EndGameParams.moveHistory` should be required.

4) Tooling & docs
- [ ] Enforce import order via eslint and update `AGENTS.md`.
- [ ] Add tests listed above; add a small CLI or script to run a determinism replay check by `gameId`.
- [ ] Document 1-based step indexing clearly in shared types and API docs (already present; audit call sites).

## Open Questions
- Should we persist a terrain `algoVersion` in `generation` now to aid terrain debugging across versions?
- Do we need per-event submit timestamps for future analytics (out of scope for MVP, but cheap to add)?
- How much bias (if any) should `playerIndex` ordering introduce on conflicting moves? Is this a feature or a quirk to neutralize?

## Notes on Alignment with MVP Docs
- The current code largely matches the MVP plan. The follow-ups doc correctly highlights the immediate next steps—especially defeated player tracking and determinism checks. The proposals above extend that with structural cleanups and type consolidation to keep the codebase cohesive as replay features expand.

