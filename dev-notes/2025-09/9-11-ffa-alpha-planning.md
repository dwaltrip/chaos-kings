# FFA Alpha Planning — 2025-09-11

## Summary
- Add free‑for‑all (FFA) support with up to 8 players.
- Introduce a “Start Early” unanimous voting flow for < 8 players (min 2).
- Use `@core/map/calc-map-size.ts` to size maps by player count during game creation.
- Unify player colors via `@core/colors` and ensure 8 distinct colors are used end‑to‑end.
- Tighten game start logic so countdown requires at least 2 connected players.

## Assumptions & Decisions
- Max players: 8 per game (configurable).
- Minimum to start: 2+ players.
- Start Early: unanimous consent among currently queued players; votes reset on membership change.
- Map sizing: use `calcMapSizeForPlayers(numPlayers)` at game creation; keep current `minGeneralDistance` for alpha.
- Matchmaking: spawn when queue == 8 or unanimous early‑start (>=2 players).
- Early‑start state: stored transiently in Redis; cleared on leave/spawn.
- WS: add `early-start-vote`, `early-start-status` messages; keep `queue-status`.
- Countdown: require ≥2 players connected to gameplay room; keep fallback but don’t start with 1.
- Player indices: assigned by queue order; preserved through create/spawn.
- Colors: single source of truth in `@core/colors`; expand `ColorMap` to 8; frontend uses core mapping only.
- Engine/rules: unchanged; engine already supports N players.

## Architecture Touch Points
- Backend
  - Matchmaking service, WebSocket API (game‑matchmaking domain), game creation flow, game server start logic.
- Core
  - Map sizing function (`calcMapSizeForPlayers`), color map completeness (8 colors).
- Frontend
  - Join Game page UI and store, WS handler for matchmaking; unify color usage in game UI.

## Backend Changes
- Matchmaking
  - Keep `PLAYERS_PER_GAME` as the hard max (8), but allow early creation with < 8 when unanimous Start Early vote is achieved and `queueSize >= 2`. Rename `PLAYERS_PER_GAME` to `FFA_NUM_PLAYERS_MAX` for clarity.
  - Track votes in Redis set keyed by the active queue: e.g., `matchmaking:early_votes` (members: userIds).
  - On join/leave: recompute `queue-status`, clear/reset votes when membership changes; broadcast `early-start-status`.
  - Concurrency: guard `createGame()` with existing `isCreatingGame` flag; ensure vote evaluation and creation happen atomically in `checkForMatch()` or a new `checkForEarlyStart()`.
  - Use `MATCHMAKING_ROOM_NAME` consistently when removing users from the matchmaking room after spawn (fix any hardcoded room names).

- WebSocket (game‑matchmaking domain)
  - New messages (client → server):
    - `early-start-vote` (payload: `{ vote: true|false }`) — add/remove user from vote set.
  - New messages (server → client):
    - `early-start-status` (payload: `{ voters: string[]; queueSize: number; allVoted: boolean }`).
  - Continue broadcasting `queue-status` after join/leave/vote.
  - Broadcast `early-start-status` on every join, leave, or vote change.

- Game creation
  - Determine `size = calcMapSizeForPlayers(playerIds.length)`.
  - Pass dynamic size into `generateGameMapV2(size, numPlayers, minGeneralDistance, seed)`.
  - Persist `config.size` with this value, and compute `playerIndexToColor` from `PLAYER_COLORS`.
  - Ensure runtime uses `game.config.size` (not default config) in the gameplay server when initializing the board.

- Game start countdown
  - In `GameServer.onPlayerJoinedRoom`, change threshold from `Math.min(1, expected)` to `Math.min(2, expected)`.
  - Fallback timer: only start countdown if ≥2 connected at expiry; otherwise keep waiting or mark as failed (alpha: keep waiting).

## Core Changes
- Colors
  - Ensure `@core/colors` `ColorMap` has 8 distinct, readable colors mapped to the existing 8 `PLAYER_COLORS` keys:
    - RED `#e33030`, BLUE `#308ee3`, GREEN `#2ecc71`, YELLOW `#f1c40f`, ORANGE `#e67e22`, PURPLE `#9b59b6`, PINK `#e84393`, SILVER `#95a5a6`.

- Map sizing
  - Use existing `@core/map/calc-map-size.ts` as the source. No change required beyond documenting usage in create‑game.
  - Current formula (approved for alpha): base `20×20` + `15×(players-2)` on each axis, ±20% variance. Persist `config.size` per game for deterministic runtime.

## Frontend Changes
- Join Game page (UI/Store)
  - Add “Start Early” button (toggle vote) and display status: `X/Y voted` and `queueSize/FFA_NUM_PLAYERS_MAX`.
  - Zustand: extend matchmaking store with `earlyStartVoters: string[]` and `hasVoted: boolean` (client‑side convenience) and actions to set from WS.
  - WS actions: send `early-start-vote` and handle `early-start-status` + `queue-status` updates.

- Game UI colors
  - Remove/avoid `frontend/src/game-ui/config/ui-constants.ts` palette usage for player colors.
  - Route all color lookups through `@core/colors` via existing `frontend/src/utils/player-colors.ts`.

## Redis Keys (proposed)
- `matchmaking:queue` — sorted set as today.
- `matchmaking:players` — player metadata as today.
- `matchmaking:games` — spawned games as today.
- `matchmaking:early_votes` — set of userIds who voted Start Early.

## Message Schemas (concise)
- `early-start-vote` (C→S): `{ vote: boolean }`.
- `early-start-status` (S→C): `{ voters: string[]; queueSize: number; allVoted: boolean }`.
- `queue-status` (S→C): `{ queueSize: number; playersNeeded: number }` (unchanged).
- `game-ready` (S→C): `{ gameId: number }` (number; unchanged trigger condition updated to include early start).

## Edge Cases
- Votes while joining/leaving: reset votes on membership change to ensure strict unanimity.
- Multiple games at once: creation guarded by `isCreatingGame`; alpha acceptable.
- Color overflow: reject create if `playerCount > PLAYER_COLORS.length` (already enforced).
 - General placement failures: with small maps/high `minGeneralDistance` and many players, `generateGameMapV2` may fail to place generals. Alpha: log and surface error; consider retry-with-new-seed in future.

## Implementation Plan
1) Core/colors: expand `ColorMap` to 8.
2) Backend: WS handlers for `early-start-vote` + broadcast `early-start-status`.
3) Backend: Redis vote tracking + integration into matchmaking flow.
4) Backend: Create‑game uses `calcMapSizeForPlayers(playerCount)`.
5) Backend: Countdown threshold set to 2; fallback respects ≥2.
6) Frontend: Join UI “Start Early” + store + handler wiring.
7) Frontend: Unify color usage to core mapping in game UI.
8) Verification: local manual tests across 2→8 players; build + type checks.

## Verification Checklist
- FE/BE build without TS errors.
- Queue reaches 8 → auto spawn; <8 with unanimous vote → spawn.
- Map sizes vary by player count; generals placed successfully.
- Game start countdown only with ≥2 connected; no premature start.
- Colors display correctly for up to 8 players (list + board tiles).

## Risks / Later
- Matchmaking concurrency scaling (multiple concurrent spawns) — future work.
- Persisting partial lobby state (restoring early votes after process restart) — not needed for alpha.
