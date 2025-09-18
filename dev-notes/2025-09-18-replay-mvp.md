# Replay MVP: Event Log–Driven Re-simulation

## Introduction
- Phase: early prototype; no production data yet. We can break backward compatibility freely to improve design and velocity.
- Goal: enable reliable, deterministic replays primarily for debugging, UX iteration, and sharing short matches; not optimizing storage/throughput yet.
- Authority model: server-authoritative with discrete ticks; clients submit commands; server validates and applies at tick time.
- Determinism: replays must reproduce results from a stored GameConfig snapshot (map, players, timing, generation seed).
- Storage: use existing `games` JSON config and `move_history` fields; schema can evolve (JSONB) without migrations beyond code changes.
- Timing: engine tick rate currently from `game-timing-config` (~2 TPS now; up to 8 TPS later). We snapshot timing per game in config to avoid drift.
- Out of scope (v1): mid-game durable checkpoints, frame snapshots, compression, analytics, and engine/mechanics versioning (leave TODOs only).

## Overview
A minimal, deterministic replay system built on an append-only event log of applied player moves. Replays re-simulate from the starting config using the core engine, keeping storage small and runtime changes low. This doc reflects updated decisions to centralize game-specific logic in core, decouple move processing from queuing, and standardize tick semantics.

## Goals
- Capture minimal move history for deterministic replays.
- Re-simulate on FE/BE from starting config for review or share.
- Avoid schema churn and heavy runtime overhead.

## Scope (MVP)
- Record applied moves on server (after validation) with tick index.
- Persist move history at game end into `games.move_history`; additionally buffer and flush every ~1s.
- Provide a small replayer helper for FE usage (in core).
- Defer snapshots, compression, mid-game persistence beyond 1s buffered flush.

## Approach
- Event log only: record inputs that actually changed state.
- Re-simulate by applying events at the same point in the tick pipeline as the server, then run the engine tick.

## Data Model
- MoveEvent (core): `{ tick: number; playerIndex: number; sourceCoord: Coord; direction: Direction }`
- MoveHistoryV1 (core): `{ version: 1; events: MoveEvent[] }`
- Identity: playerIndex only (DB stores playerIndex → user mapping).
- Optional metadata co-located in `game_state` for future-proofing: `{ tickRate?, engineVersion?, seed? }`

File layout (new):
- `core/src/replay/types.ts` — exports `MoveEvent`, `MoveHistoryV1`.
- `core/src/replay/replayer.ts` — replay iterator using shared tick processor.

### GameConfig (Snapshot)
- Problem: current `GameConfig` lacks explicit timing snapshot and generation seed; future code changes could drift replay semantics.
- Decision: replace `GameConfig` with a cleaner, explicit snapshot type. No backward-compat needed (prototype).

Shape:
- `size: Size2d`
- `startingGrid: GameGrid`
- `players: { count: number; colors: PlayerColor[] }`
- `generation: { minGeneralDistance: number; mountainDensity?: number; seed: number }`
- `timing: { tickRateMs: number; generalProductionTicks: number; armyProductionTicks: number }`
- `// TODO(engine-versioning): engineVersion?: string`

Creation notes:
- In `create-game.ts`, set:
  - `generation.seed = Date.now()` (continue current behavior), and pass through `minGeneralDistance`, `mountainDensity` used for generation.
  - `timing` values by reading from `game-timing-config` at creation time.
  - `players.colors` as an array mapped by `playerIndex`.
  - Remove `playerIndexToColor` entirely.

Code changes required:
- Update `core/src/game-config.ts` to the new shape.
- Update all import sites (backend create/init, frontend consumers) to read `players.colors` instead of `playerIndexToColor`.

## Server Integration
- Hook in `backend/src/gameplay/game-server.ts`:
  - Use a decoupled tick processor (from core) that accepts per-tick events.
  - Log only moves that pass validation (ownership, units > 1, bounds, canMove).
  - Ensure canonical per-tick order (playerIndex ascending) before applying/logging.
  - Maintain an in-memory buffer of applied events; flush to DB every ~1s and on end-game.
- Persistence in `backend/src/game/actions/end-game.ts`:
  - Save `games.move_history = { version: 1, events }` alongside final `game_state`.
- Repository:
  - Add `updateMoveHistory(gameId, moveHistory)` to update only `move_history` (for periodic flushes).
  - Optionally add `updateStatusStateAndHistory(gameId, status, gameState, moveHistory)` for end-game.

Flush cadence rationale:
- Current engine tick rate is defined in `core/src/game-timing-config.ts` (not UI timing). Today ~2 TPS (future up to 8 TPS). Per-tick writes are feasible but chatty; buffered 1s flush (batching ~2–8 events) reduces DB load with negligible risk.
- Crash risk: buffering means last <1s of events could be lost; acceptable for MVP.

## Replay Algorithm (deterministic)
- Init: `board = deepClone(config.startingGrid)`, `size = config.size`, `t = 0`.
- For tick `T`:
  - Apply all events with `event.tick === T` in canonical order.
  - Run `engine.tick(board, T)`.
  - Yield post-tick frame (the state after executing step T).

Replay helper (core):
- `replayFrames(config, history)` yields `{ step, board, gameEnded, winner }`.
- Uses the same tick processor as live games to avoid drift.

## Tick Semantics (cleanup target)
- Decision: standardize on “completed step” = the simulation index just executed.
- Logging: events use `tick = step index` (apply pre-tick, then engine executes that step).
- Broadcast: send `step` (or `tick`, but value equals completed step). Remove `+1` offset.
- Migration:
  - Backend: change broadcast payload key to `step` (keep `tick` alias temporarily), value = completed step.
  - Frontend: read `step` preferentially; fallback to `tick` if present.

## Assumptions
- Engine is deterministic per tick given same config + inputs.
- No runtime RNG after map generation; if added later, it is seeded and persisted.
- One move per player per tick (current server behavior and enforced by queueing).
- Per-tick processing order is deterministic (playerIndex ascending) and consistent in replay.
- The game record persists the exact `GameConfig` used for the match (DB `games.config`). This snapshot is the replay source of truth.

## Ambiguities / Decisions Needed
- Include `userId` in events? Proposed: no (use `playerIndex` only).
- Canonical order: confirm `playerIndex` ascending vs current Map iteration semantics (we will sort explicitly).
- Multiple inputs per player per step: live path enforces 0–1 per step; replayer ignores extra if present.
- Engine/game-mechanics versioning: leave TODOs in processor/replayer/persistence; do not implement in MVP.
- Mid-game persistence/crash resilience: out-of-scope beyond 1s buffered flush.

## Cleanup / Related Improvements
- Core-first consolidation:
  - Move replay types and replayer into core (`core/src/replay/...`).
  - Add `core/src/validation/moves.ts` and centralize all move validation.
  - Add `core/src/validation/types.ts` for a typed enum/union: `MoveValidationReason = 'OUT_OF_BOUNDS' | 'NO_OWNERSHIP' | 'INSUFFICIENT_UNITS' | 'BLOCKED' | 'INVALID_DEST' | 'UNKNOWN'` and a result type `{ ok: true } | { ok: false; reason: MoveValidationReason }`.
  - Add `core/src/sim/process-tick.ts` that consumes events for a step and runs the engine.
  - Add `core/src/sim/sort-moves-for-tick.ts` (sibling of `engine.ts`) exporting deterministic ordering (initially `playerIndex` ascending). This is the single source for move priority.
  - Leave TODOs in `process-tick`, `replayer`, and server persistence hooks for future engine/mechanics versioning; do not ship a version constant now.
- Naming consistency:
  - Align action file names (request vs action) and message payloads.
  - Include `gameId` in all gameplay messages; reduce reliance on `getUserGame`.
- Tick alignment:
  - Remove `tick+1` discrepancy by broadcasting completed step as `step`.
- Event logging robustness:
  - Log only applied moves; add a feature flag (e.g., `FEATURE_REPLAY_LOGGING=true`) to disable logging under load.
- Dev hygiene:
  - Ignore/remove `.DS_Store`; reduce noisy logs; use levels consistently.
- Testing:
  - Add a core test feeding a small `MoveHistoryV1` through the engine and asserting final board equality.
  - Add a backend integration test: run a tiny live game, save history, re-simulate, assert final board equals saved `finalBoardState`.

## Phased Plan
- P1 (core + BE):
  - Add `core/src/replay/types.ts`, `core/src/validation/types.ts`, `core/src/validation/moves.ts`, `core/src/sim/process-tick.ts`, `core/src/sim/sort-moves-for-tick.ts`.
  - Refactor `GameServer` to use `processTick` with a `LiveQueueSource` adapter.
  - Add in-memory move buffer + 1s periodic flush via `updateMoveHistory` and end-game flush.
  - Standardize broadcast to `step` (retain `tick` alias temporarily).
- P2 (core + FE):
  - Add `core/src/replay/replayer.ts` and FE viewer that uses it.
  - Add fog-of-war view in replay via `Board.getVisibleSquares` for a player perspective.
- P3 (optional):
  - Add snapshots for seek performance; consider Redis buffer for crash resilience.

## Risks / Mitigations
- Replay drift due to ordering mismatches → enforce/sort by `playerIndex`.
- Engine changes break old replays → store `engineVersion` and consider compatibility shims.
- Large event arrays → acceptable for MVP; revisit compression/chunking later.

## Open Questions
- Do we want per-match engine tick rate stored explicitly (vs implied by `game-timing-config`)? Useful if it becomes player-configurable.
- Per-event timestamps: out-of-scope for MVP. If added later, prefer submit-time (client/server receive time) over apply-time.

## Core APIs (proposed)
- `validateMove(board, playerIndex, sourceCoord, direction): { ok: boolean; reason?: string }`
- `processTick(board, step, events: MoveEvent[]): { gameEnded: boolean; winnerPlayerIndex?: number }`
- `replayFrames(config, history): Iterable<{ step: number; board: BoardState; gameEnded: boolean; winner?: number }>`

## GameServer Adapters (proposed)
- LiveQueueSource (server):
  - For current step, pop at most one queued move per player; convert to `MoveEvent[]`.
  - Pass events to `processTick`; capture `appliedEvents` for logging.
- ReplaySource (viewer/server tooling):
  - Provide events per step from `MoveHistoryV1` for re-sim or analysis.

## Next Steps
- Implement P1 and verify a sample match can be re-simulated to the saved final state.
