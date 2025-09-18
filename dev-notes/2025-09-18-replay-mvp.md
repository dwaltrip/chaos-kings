# Replay MVP: Event Log–Driven Re-simulation

## Overview
A minimal, deterministic replay system built on an append-only event log of applied player moves. Replays re-simulate from the starting config using the core engine, keeping storage small and runtime changes low.

## Goals
- Capture minimal move history for deterministic replays.
- Re-simulate on FE/BE from starting config for review or share.
- Avoid schema churn and heavy runtime overhead.

## Scope (MVP)
- Record applied moves on server (after validation) with tick index.
- Persist move history at game end into `games.move_history`.
- Provide a small replayer helper for FE usage.
- Defer snapshots, compression, mid-game persistence.

## Approach
- Event log only: record inputs that actually changed state.
- Re-simulate by applying events at the same point in the tick pipeline as the server, then run the engine tick.

## Data Model
- MoveEvent: `{ tick: number; playerIndex: number; sourceCoord: Coord; direction: Direction }`
- MoveHistoryV1: `{ version: 1; events: MoveEvent[] }`
- Optional metadata co-located in `game_state` for future-proofing: `{ tickRate?, engineVersion?, seed? }`

## Server Integration
- Hook in `backend/src/gameplay/game-server.ts`:
  - Log only moves that pass ownership, units > 1, bounds/canMove checks.
  - Ensure canonical per-tick order (playerIndex ascending) before applying/logging.
- Persist in `backend/src/game/actions/end-game.ts`:
  - Save `games.move_history = { version: 1, events }` alongside final `game_state`.
- Repository:
  - Add `updateStatusStateAndHistory(gameId, status, gameState, moveHistory)` to `game-repository.ts` (or extend existing method temporarily).

## Replay Algorithm (deterministic)
- Init: `board = deepClone(config.startingGrid)`, `size = config.size`, `t = 0`.
- For tick `T`:
  - Apply all events with `event.tick === T` in canonical order.
  - Run `engine.tick(board, T)`.
  - Yield post-tick frame (the state after executing step T).

## Tick Semantics (cleanup target)
- Standardize on “completed tick” (aka simulation step) = the index just executed.
- Log events with `tick = step index` (applied pre-tick, then engine tick executes that index).
- Broadcast the same index as `tick` (no `+1` offset). Alternatively rename to `step` to avoid ambiguity.
- Migration: update FE consumers to treat incoming `tick` as completed step.

## Assumptions
- Engine is deterministic per tick given same config + inputs.
- No runtime RNG after map generation; if added later, it is seeded and persisted.
- One move per player per tick (current server behavior).
- Per-tick processing order is deterministic (playerIndex ascending) and consistent in replay.

## Ambiguities / Decisions Needed
- Include `userId` in events? Proposed: no (use `playerIndex` only).
- Canonical order: confirm `playerIndex` ascending vs current Map iteration semantics.
- Engine versioning: string/semver source of truth (package.json or manual constant).
- Mid-game persistence/crash resilience: out-of-scope for MVP?

## Cleanup / Related Improvements
- Type unification:
  - Move `CompletedGameState` and `Game` shapes to a single source (prefer `common`).
  - Add `common/types/replay.ts` exporting `MoveEvent` and `MoveHistoryV1`.
- Naming consistency:
  - Align action file names (e.g., request vs action) and message payloads.
  - Include `gameId` in all gameplay messages; reduce `getUserGame` reliance.
- Tick alignment:
  - Remove `tick+1` discrepancy by broadcasting the completed step or renaming field to `step`.
- Event logging robustness:
  - Log only applied moves; optional feature flag to disable in load tests.
- Dev hygiene:
  - Ignore/remove `.DS_Store`; reduce noisy logs; use levels.
- Testing:
  - Add a core test feeding a small MoveHistory through the engine and asserting the final board.

## Phased Plan
- P1: Types in `common`; hook logging in server; save on end-game; align tick naming.
- P2: Replayer helper (core/common) and minimal FE viewer integration.
- P3: Optional snapshots for seek; optional mid-game writes for resilience.

## Risks / Mitigations
- Replay drift due to ordering mismatches → enforce/sort by `playerIndex`.
- Engine changes break old replays → store `engineVersion` and consider compatibility shims.
- Large event arrays → acceptable for MVP; revisit compression/chunking later.

## Open Questions
- Do we want per-match `tickRate` stored explicitly (vs implied by UI timing config)?
- Is a per-event timestamp useful for analytics beyond replay?

## Next Steps
- Implement P1 and verify a sample match can be re-simulated to the saved final state.

