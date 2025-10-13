# Replay MVP — Follow-ups and Implementation Notes

## Immediate Follow-ups (MVP polish)
- Defeated players: Track `active | defeated` in GameServer.
  - On each step, detect newly defeated players (general captured) and mark defeated.
  - Clear their queues immediately and ignore subsequent submissions.
  - Option A: extend core `processTick` to return `defeatedPlayers` for this step.
  - Option B: server computes by comparing generals before vs after step.
- Deterministic replay check: Add a backend/core test or script to re-simulate a finished game.
  - Load `config` + `move_history` from DB, run `replayFrames`, assert final board equals saved `game_state.board`.
  - Add a small CLI utility to run for a given `gameId`.
- Frontend config changes: Update any FE helpers expecting `numPlayers`/`playerIndexToColor`.
  - Use `config.players.count` and `config.players.colors[playerIndex]`.
  - Audit color usage in UI and any lobbies/displays that read config.

## Core/Engine Enhancements
- `processTick` return shape: optionally include `defeatedPlayers: number[]` when generals are captured (for FFA and analytics).
- Validation: current `validateMove` covers ownership, units > 1, bounds, and blocked destination (mountain).
  - Consider adjacency rule clarification if new movement rules arise.
- Engine versioning: add optional `engineVersion` to config snapshot to future-proof replay determinism.
- Replay adapter: optional utility to expose a `ReplaySource` that yields events per step; `replayFrames` already groups internally.

## Server Integration Improvements
- Queue policy: currently pops ≤1 move per player per step; confirm UX expectations for queued chains.
- Logging: add debug logging for applied events per step (behind a verbose flag) to aid debugging.
- Crash resilience: move-history flushes every ~1s; consider a Redis buffer for mid-game durability.
  - On restart, reconstruct in-memory buffer from DB latest flushed history.
- Message payloads: we now include `gameId`. Consider also broadcasting `appliedEvents` for observability/dev tools (behind a flag).

## Persistence / Data Model
- MoveHistory V1: `{ version: 1, events }` stored in `games.move_history` (JSONB).
  - Compression/chunking out of scope for MVP; revisit if arrays grow large.
- Config snapshot: stabilized to include `players`, `generation`, and `timing`.
  - Replays re-simulate from `startingGrid` (no regeneration).

## Frontend Replay (next iterations)
- Minimal viewer: page to load a completed game, fetch `config` + `move_history`, and scrub through frames.
  - Controls: play/pause, step forward/back, speed.
  - Render via existing board components; apply frames from `replayFrames`.
- Routing/API: expose endpoint to read `config` and `move_history` for a `gameId` (server already stores both).

## Testing & Tooling
- Unit tests: add coverage for `validateMove` and `processTick` ordering (playerIndex sort).
- Integration test: simulate a few steps with known events and assert board outcomes.
- Determinism test: see Immediate Follow-ups.
- Lint/build gates: ensure both FE/BE builds stay green post-changes (already added to workflow docs).

## Open Questions
- Do we want to persist `algoVersion` for terrain gen now? (helps terrain debugging across versions).
- Do we want per-event timestamps (submit-time) for future analytics? Out of scope for MVP.

## Decisions Captured
- Sorting: enforced inside core `processTick` to keep live and replay paths identical.
- Timing: parametric via snapshot `config.timing`; prevents drift when global defaults change.
- Event log granularity: log only applied moves, not submissions, to maintain determinism and compact storage.

## Small TODOs / Cleanups
- Add a typed helper in core to build `TimingConfig` from current constants to avoid repetition in server code.
- Consider consolidating the “tick vs step” terminology in code comments to consistently refer to the 1-based step index.
- Ensure cleanup always flushes latest move-history (added) and clears timers safely.
- Document the 1-based step index in shared types and any API docs.

