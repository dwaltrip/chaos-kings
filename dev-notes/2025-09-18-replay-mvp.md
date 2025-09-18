# Replay MVP: Event Log–Driven Re-simulation

## Introduction
- Phase: early prototype; no production data. We will break backward compatibility to optimize design and velocity.
- Goal: reliable, deterministic replays for debugging, UX iteration, and sharing short matches; storage/throughput optimizations can come later.
- Authority model: server-authoritative with discrete steps; clients submit commands; server validates and applies at step time.
- Determinism: replays must reproduce results from a stored GameConfig snapshot (map, players, timing, generation seed/params) using the same processing pipeline.
- Storage: use existing `games.config` (JSON) and `games.move_history` (JSON) fields; evolve shape (JSONB) without heavy migrations.
- Timing: timing is per-game and parameterized; engine uses timing from the game snapshot (globals only seed new games).
- Out of scope (MVP): mid-game durable checkpoints, frame snapshots, compression, analytics, and engine/mechanics versioning (TODOs only).

## Overview
A minimal, deterministic replay system built on an append-only event log of applied player moves. Replays re-simulate from the starting config using the same core tick processor as live games, keeping storage small and runtime changes low. We centralize move validation and step processing in core, parameterize timing, standardize step/frame semantics, and include gameId on messages.

## Goals
- Capture minimal move history for deterministic replays.
- Re-simulate on FE/BE from starting config for review/share.
- Avoid schema churn and heavy runtime overhead.

## Scope (MVP)
- Record applied moves on server (after validation) with 1-based step index.
- Persist move history at game end into `games.move_history`; buffer and flush every ~1s.
- Provide a small replayer helper (in core) that uses the same step processor as live games.
- Defer snapshots, compression, mid-game persistence beyond 1s buffered flush.

## Approach
- Event log only: record inputs that actually changed state (applied moves).
- Re-simulate by applying events pre-step (same as live), then run the engine step with parametric timing.

## Data Model
- MoveEvent (core): `{ step: number; playerIndex: number; sourceCoord: Coord; direction: Direction }` (1-based step)
- MoveHistoryV1 (core): `{ version: 1; events: MoveEvent[] }`
- Identity: `playerIndex` only (DB stores playerIndex → user mapping).
- Optional metadata: `game_state.engineVersion?`; timing and generation seed/params live in the game config snapshot.

File layout (new):
- `core/src/replay/types.ts` — MoveEvent, MoveHistoryV1, Timing types.
- `core/src/replay/replayer.ts` — replay iterator using shared step processor.

### GameConfig (Snapshot)
- Problem: current `GameConfig` lacks explicit timing snapshot and generation seed/params; changes could drift replay.
- Decision: replace `GameConfig` with an explicit snapshot type (no backward compatibility needed).

Shape:
- `size: Size2d`
- `startingGrid: GameGrid` (source of truth for replays)
- `players: { count: number; colors: PlayerColor[] }`
- `generation: { seed: number; minGeneralDistance: number; mountainDensity?: number; algoVersion?: string }`
- `timing: { tickRateMs: number; generalProductionTicks: number; armyProductionTicks: number }`
- `// TODO(engine-versioning): engineVersion?: string`

Creation notes:
- In `create-game.ts`, set:
  - `generation.seed = Date.now()`; pass through `minGeneralDistance`, `mountainDensity` used for generation.
  - `timing` by reading module defaults and computing `*ProductionTicks` from `tickRateMs`.
  - `players.colors` as an array mapped by `playerIndex` (remove `playerIndexToColor`).

Code changes required:
- Update `core/src/game-config.ts` to the new shape.
- Update import sites (backend create/init, frontend color helpers) to use `players.colors`.
- Note: we store generation seed/params now, but replays re-simulate from `startingGrid` (no regeneration).

## Server Integration
- In `backend/src/gameplay/game-server.ts`:
  - Use a decoupled `processTick` (from core) that accepts per-step events and a `timing` object.
  - Gather at most one queued move per player for the upcoming step; build `events: MoveEvent[]` with `step`.
  - Sort events deterministically (playerIndex ascending) via core helper.
  - Validate at step-time using core (`validateMove`) and apply via `processTick` (which filters to applied events internally).
  - Log only applied moves and push them to an in-memory buffer.
  - Maintain an in-memory buffer of applied events; flush to DB every ~1s and on end-game/cleanup (part of regular flow; no feature flags).
  - Track player status (`active` | `defeated`); clear a defeated player’s queue immediately and ignore future submissions for them.
- Persistence:
  - Save `games.move_history = { version: 1, events }` alongside final `game_state` on end-game.
  - Add `updateMoveHistory(gameId, moveHistory)` for periodic flushes.

Flush cadence rationale:
- At typical step rates (2–8 TPS), per-step writes are feasible but chatty; a 1s buffered flush reduces DB load with negligible risk.
- Crash risk: last <1s of events may be lost; acceptable for MVP.

## Replay Algorithm (deterministic)
- Init: `board = cloneBoard(config.startingGrid)`, `size = config.size`, `frame = 0`.
- For step `S = 1..N`:
  - Take all events with `event.step === S` in canonical order.
  - Run `processTick(board, S, events, config.timing)`.
  - Yield post-step frame `{ step: S, board, gameEnded?, winner? }`.

Replay helper (core):
- `replayFrames(config, history)` yields `{ step, board, gameEnded, winner? }`.
- Uses the same `processTick` as live games to avoid drift.

## Step/Frame Semantics (cleanup)
- Definitions:
  - Step: 1-based simulation step; events apply pre-step; engine resolves in that step.
  - Frame: post-step static state; Frame 0 is the initial board before any processing.
  - TickMs: scheduler cadence (ms) that triggers steps; independent of step numbering.
- Behavior:
  - No production or movement at “step 0”. First state change occurs at step 1.
  - Engine production triggers when `step % generalProductionTicks === 0` (with step ≥ 1).
- Broadcast:
  - Send `payload.step` for completed step (no +1 offset). Keep `tick` as a temporary alias during migration.

## Assumptions
- Engine is deterministic per step given same config + inputs.
- No runtime RNG after map generation; if added later, it is seeded and persisted.
- One move per player per step (enforced by queueing).
- Per-step processing order is deterministic (playerIndex ascending) and consistent in replay.
- The game record persists the exact `GameConfig` used for the match (DB `games.config`). This snapshot is the replay source of truth.

## Ambiguities / Decisions Needed
- Include `userId` in events? No (use `playerIndex` only).
- Canonical order: strictly `playerIndex` ascending (sort explicitly).
- Multiple inputs per player per step: live path enforces 0–1; `processTick` ignores extras if present.
- Engine/game-mechanics versioning: leave TODOs in processor/replayer/persistence; not in MVP.
- Mid-game persistence/crash resilience: out-of-scope beyond 1s buffered flush.

## Cleanup / Related Improvements
- Core-first consolidation:
  - Move replay types and replayer into core (`core/src/replay/...`).
  - Add `core/src/validation/moves.ts` and centralize move validation.
  - Add `core/src/validation/types.ts` with `MoveValidationReason` and result type.
  - Add `core/src/sim/process-tick.ts` for per-step processing with parametric timing.
  - Add `core/src/sim/sort-moves-for-tick.ts` exporting deterministic ordering.
  - Add `core/src/utils/clone-board.ts` to avoid ad-hoc deep clones in replayer.
  - Prefer placing game-specific types in `@core` (migrate from `@common` where feasible during implementation).
- Naming and message consistency:
  - Include `gameId` in all gameplay messages (game-starting, game-started, game-state-update, game-ended).
  - Plan to remove `userGameMapping` by passing `gameId` from clients and validating server-side membership (optional refactor during this work).
- Step alignment:
  - Broadcast completed step as `step` (no +1 offset).
- Event logging:
  - Log only applied moves; part of the regular flow (no feature flags).
- Dev hygiene:
  - Ignore/remove `.DS_Store`; reduce noisy logs; use levels consistently.
- Testing:
  - Core: feed a small `MoveHistoryV1` through the engine and assert final board equality.
  - Backend: run a small live game, save history, re-simulate, assert final board equals saved `finalBoardState`.

## Phased Plan

Phase 1: Core Foundations
- Types in core: Add `Timing`, `MoveEvent/MoveHistoryV1`, `PlayerStatus = 'active' | 'defeated'`.
- Parametric engine: `engine.tick(board, step, timing)` honors 1-based steps; no production at step 0.
- Validation: `validateMove(board, playerIndex, source, direction)` with small reason enum.
- Step processor: `processTick(board, step, events, timing)` returns `{ appliedEvents, defeatedPlayers?, gameEnded, winnerPlayerIndex? }`.
- Deterministic order: `sortMovesForStep(events)` (playerIndex ascending).
- Utilities: `cloneBoard(board)`.
- Touchpoints: core `engine.ts`, `replay/types.ts`, `validation/{types.ts,moves.ts}`, `sim/{process-tick.ts,sort-moves-for-tick.ts}`, `utils/clone-board.ts`.

Phase 2: GameConfig Snapshot Upgrade
- Snapshot: `players.colors[]`, `generation{ seed, minGeneralDistance, mountainDensity, algoVersion? }`, `timing{ tickRateMs, generalProductionTicks, armyProductionTicks }`.
- Creation: compute ticks from rate at game creation; set `seed=Date.now()`; remove `playerIndexToColor`.
- Touchpoints: `core/src/game-config.ts`, `backend/src/game/actions/create-game.ts`, FE color helper if reading from config.

Phase 3: Server Integration (Steps + Applied-Move Logging)
- Track 1-based `step`; broadcast Frame 0 on game-started; first processed step is 1.
- For each step: pop ≤1 from each player queue → build `MoveEvent[]` with `step`.
- Sort via core; call `processTick(board, step, events, timing)`.
- Append `appliedEvents` to in-memory buffer; flush every ~1s and on end/cleanup.
- Maintain `playerStatus`; on defeat, mark defeated, clear queues, ignore future submissions.
- Persistence: add `updateMoveHistory(gameId, moveHistory)`; end-game persists final `game_state` + move_history.
- Touchpoints: `backend/src/gameplay/game-server.ts`, `backend/src/game/game-repository.ts`, `backend/src/game/actions/end-game.ts`.

Phase 4: Message Schema + FE Consumption
- Include `gameId` in `game-state-update` and `game-ended`. Use `step` (keep `tick` alias short-term).
- FE reads `step` first, fallback to `tick` if present.
- Touchpoints: `common/types/gameplay.ts`, `backend/src/gameplay/game-server.ts`, `frontend/src/game-ui/store/gameplay-ws-handler.ts`, `frontend/src/game-ui/actions/update-gameplay-state.ts`.

Phase 5: Replay Helper (Core)
- `replayFrames(config, history)` using same `processTick`.
- Optional minimal FE viewer (later).
- Touchpoints: `core/src/replay/replayer.ts` + core tests.

Phase 6: Optional — Remove userGameMapping
- Add `gameId` to `move-request`, `cancel-moves-request`, `undo-move-request`.
- Route via `requireGame(gameId)`; validate membership via DB; remove mapping.
- Touchpoints: `common/types/gameplay.ts`, `backend/src/gameplay/actions/*.ts`, remove `user-game-mapping.ts`, FE senders.

Phase 7: Tests
- Core: step semantics (no production at step 0), determinism with MoveHistory → final board stable.
- Backend: integration — short match, persist history, replay with core → equals saved `finalBoardState`.
- Touchpoints: core Jest specs, backend integration tests.

Phase 8: Type Ownership Cleanup
- Move game-specific domain types to `@core` where feasible; keep DB table types in backend; keep `@common` transport-only.
- Touchpoints: `common/types/games.ts` (import from core), `backend/src/game/types.ts` vs `common/types/games.ts` (dedupe `GameStatus`).

Phase 9: Polish
- Verify defeated queue clearing; reduce noisy logs; confirm `.DS_Store` ignored.
- Update UI step counters for 1-based steps and Frame 0 semantics.
- P1 (core + BE):
  - Add `core/src/replay/types.ts`, `core/src/validation/types.ts`, `core/src/validation/moves.ts`, `core/src/sim/process-tick.ts`, `core/src/sim/sort-moves-for-tick.ts`, `core/src/utils/clone-board.ts`.
  - Parameterize timing; ensure engine/tick paths accept `timing` instead of reading module globals.
  - Refactor `GameServer` to build per-step events array → sort → `processTick` (returns appliedEvents, game end), track player statuses, clear defeated queues.
  - Add in-memory move buffer + 1s periodic flush via `updateMoveHistory` and end-game/cleanup flush.
  - Standardize broadcast to `step` and include `gameId` (retain `tick` alias temporarily).
- P2 (core + FE):
  - Add `core/src/replay/replayer.ts` and a simple FE viewer that uses it.
  - Add fog-of-war view in replay via `Board.getVisibleSquares` for a player perspective.
- P3 (optional):
  - Snapshots for seek performance; consider Redis buffer for crash resilience.

## Risks / Mitigations
- Replay drift due to ordering mismatches → enforce/sort by `playerIndex`.
- Engine timing changes → parametric timing from game config; consider storing `engineVersion`.
- Large event arrays → acceptable for MVP; revisit compression/chunking later.

## Open Questions
- Do we want `algoVersion` for terrain gen persisted now? (Should help debugging terrain changes.)
- Per-event timestamps: out-of-scope for MVP. If added, prefer submit-time (server receive time) over apply-time.

## Core APIs (proposed)
- `validateMove(board, playerIndex, sourceCoord, direction): { ok: boolean; reason?: MoveValidationReason }`
- `processTick(board, step, events: MoveEvent[], timing: Timing): { appliedEvents: MoveEvent[]; gameEnded: boolean; winnerPlayerIndex?: number; defeatedPlayers?: number[] }`
- `replayFrames(config, history): Iterable<{ step: number; board: BoardState; gameEnded: boolean; winner?: number }>`

## GameServer Adapters (proposed)
- LiveQueueSource (server):
  - `nextEventsForStep(step): MoveEvent[]` — returns ≤1 event per player by popping from their queues and tagging with `step` and `playerIndex`.
  - Ignores players with status `defeated`.
  - Server passes events to `processTick` and receives `appliedEvents`; only these are buffered/persisted.
- ReplaySource (viewer/server tooling):
  - Provide events per step from `MoveHistoryV1` for re-sim or analysis.

## Next Steps
- Implement P1 and verify a sample match can be re-simulated to the saved final state.
