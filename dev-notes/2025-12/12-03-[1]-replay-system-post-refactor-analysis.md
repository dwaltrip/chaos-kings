# Replay System - Post v0.2 Refactor Analysis

**Date:** 2025-12-03
**Context:** Reviewing replay functionality implemented in Sept 2025, assessing what survived the Oct-Nov v0.2 refactor

## Executive Summary

The core replay infrastructure implemented in September 2025 **survived the v0.2 refactor intact and is fully functional**. The backend captures move history, persists it to the database, and provides deterministic replay capabilities. However, **no frontend replay viewer was ever built** - this is the main missing piece for a complete replay feature.

**Current Status:**
- ✅ Backend move capture and persistence
- ✅ Core replay engine with deterministic re-simulation
- ✅ Database schema and storage
- ✅ Verification tooling (CLI script)
- ✅ All tests passing (98 total)
- ❌ No frontend replay viewer
- ❌ No API endpoint to fetch replay data
- ❌ No routing/UI for viewing replays

## September 2025 Implementation - Document Overview

### The 4 Replay Docs (chronological order):

1. **9-18-replay-mvp.md** - The master design document
   - Comprehensive architecture and phased implementation plan
   - Defines event-log driven re-simulation approach
   - 9 phases covering core, backend, and frontend

2. **9-18-replay-review-analysis.md** - Post-implementation review
   - Reviews commits starting at `5b54397`
   - Documents Phases 1-5 as completed
   - Provides findings, cleanup proposals, and execution notes

3. **9-18-replay-follow-ups.md** - TODO list
   - Immediate follow-ups (defeated players, determinism checks)
   - Enhancement ideas (versioning, crash resilience)
   - Frontend viewer roadmap

4. **9-18-replay-UI-brief-notes.md** - UI requirements sketch
   - Very brief notes on replay viewer controls
   - Play/pause, step controls, speed, scrubber
   - Player POV vs full map view

### What Was Implemented (Phases 1-5):

**Phase 1 - Core Foundations:**
- ✅ `MoveEvent` and `MoveHistoryV1` types in core
- ✅ `processStep()` - deterministic step processor with parametric timing
- ✅ `validateMove()` - move validation with reason codes
- ✅ Deterministic event ordering (by playerIndex)
- ✅ Board cloning utilities

**Phase 2 - GameConfig Snapshot:**
- ✅ Upgraded `GameConfig` to include:
  - `startingGrid` (source of truth for replay)
  - `playerColors[]` array
  - `map` (MapGenerationParams with seed)
  - `timing` (tickRateMs, production ticks)
- ✅ Centralized `TimingConfig` type
- ✅ Step-first naming (`processStep` vs `processTick`)

**Phase 3 - Server Integration:**
- ✅ `MoveHistoryBuffer` - encapsulated event buffering
- ✅ Periodic flush (1s cadence)
- ✅ Final flush on game end
- ✅ Applied events only (validated moves)

**Phase 4 - Defeated Players:**
- ✅ Server tracks defeated players
- ✅ Clears queues when general captured
- ✅ Ignores future moves from defeated players

**Phase 5 - Tests & Tooling:**
- ✅ Core unit tests for validation and ordering
- ✅ `scripts/replay-verify.ts` - CLI determinism checker
- ✅ Import order documentation

**Not Implemented (Phases 6-9):**
- ❌ Phase 6: Remove userGameMapping (deferred)
- ❌ Phase 7: Additional integration tests (basic tests exist)
- ❌ Phase 8: Type ownership cleanup (some TODOs remain)
- ❌ Phase 9: Frontend replay viewer **(KEY MISSING PIECE)**

## Current Codebase State (Post v0.2 Refactor)

### Core Package (`packages/core/`)

**Replay Infrastructure:**
- `src/replay/types.ts` - `MoveEvent`, `MoveHistoryV1`, re-exports `TimingConfig`
- `src/replay/replayer.ts` - `replayFrames()` generator function
  - Accepts `GameConfig` + `MoveHistoryV1`
  - Returns iterable of `{ step, board, gameEnded, winner }`
  - Supports bounds: `{ maxSteps?, stopAfterLastEvent? }`
- `src/step-processor.ts` - `processStep()` used by both live games and replays
  - Deterministic event ordering
  - Validates and applies moves
  - Triggers production based on timing
  - Detects game end (1 general remaining)

**Game Config:**
```typescript
interface GameConfig {
  startingGrid: GameGrid;
  playerColors: PlayerColor[];
  map: MapGenerationParams; // { size, numPlayers, minGeneralDistance, seed, algoVersion? }
  timing: TimingConfig;     // { tickRateMs, generalProductionTicks, armyProductionTicks }
  // TODO(engine-versioning): engineVersion?: string
}
```

**Move Validation:**
- `src/moves/validate-move.ts` - validates ownership, bounds, units, blocked destinations
- Returns `{ ok: boolean; reason?: MoveValidationReason }`

**Tests:**
- `src/step-processor-ordering.test.ts` - playerIndex ordering tests
- `src/moves/validate-move.test.ts` - validation reason coverage
- All core tests passing (53 tests)

### Backend (`apps/backend/`)

**Gameplay Domain:**
- `domains/gameplay/game-server.ts` - Live game server
  - Uses `MoveHistoryBuffer` to capture applied events
  - Calls `processStep()` each tick
  - Tracks defeated players
  - Flushes move history every 1s + on game end
  - Lines: 21-22 (buffer import), 49 (instantiation), 131 (append), 186 (final flush), 489-494 (flush method)

- `domains/gameplay/move-history-buffer.ts` - Event buffering
  - In-memory buffer with `append()` and `flush()`
  - Tracks `lastFlushedCount` to avoid redundant writes
  - Generic flush interface: `async flush(save: (history) => Promise<void>, force?)`

**Games Domain:**
- `domains/games/game-repository.ts` - Persistence
  - `updateMoveHistory(gameId, moveHistory)` - periodic updates
  - `updateStatusGameStateAndMoveHistory(...)` - atomic end-game update
  - Stores in `games.move_history` JSONB column

- `domains/games/actions/end-game.ts` - Game completion
  - Receives `moveHistory` from GameServer
  - Persists alongside final `game_state`

- `domains/games/game-routes.ts` - HTTP API
  - `GET /api/games` - list games
  - `GET /api/games/:id` - get game by ID
  - **Note:** Returns full game record including `config` and `move_history`

**Database:**
- Migration `1754523079189_add_config_and_move_history_to_games.ts`
- Adds `config` (JSONB) and `move_history` (JSONB) columns to `games` table

**Tooling:**
- `scripts/replay-verify.ts` - Determinism verification
  - Usage: `npm run replay:verify -- --gameId=<id>`
  - Loads `config` + `move_history` + `game_state` from DB
  - Re-simulates using `replayFrames()`
  - Compares final board to saved state
  - Outputs coordinate-level diffs on mismatch

**Tests:**
- Backend tests passing (45 tests)
- Includes game creation, move validation, step processor tests

### Frontend (`apps/frontend/`)

**Current Pages:**
- `pages/home/` - Home page
- `pages/join-game/` - Join game lobby
- `pages/games-list/` - List of games
- `pages/gameplay/` - Live gameplay

**Replay Support:**
- ❌ No `pages/replay/` directory
- ❌ No replay viewer components
- ❌ No replay-specific routes
- ❌ No replay state management (stores)

**Note:** The `GET /api/games/:id` endpoint already returns `config` and `move_history`, so the backend data layer is ready for frontend consumption.

## Architecture Comparison: Sept Docs vs Current Code

### Alignment (What Matched):

| Design Doc Element | Current Implementation | Status |
|-------------------|------------------------|--------|
| Event-log approach | `MoveEvent[]` in DB | ✅ Exact match |
| GameConfig snapshot | Includes map params, timing, colors | ✅ Exact match |
| Parametric timing | `timing` passed to `processStep()` | ✅ Exact match |
| Deterministic ordering | Sort by playerIndex in `processStep()` | ✅ Exact match |
| Move validation | `validateMove()` in core | ✅ Exact match |
| Buffered flush | `MoveHistoryBuffer` with 1s cadence | ✅ Exact match |
| Defeated player tracking | GameServer tracks + clears queues | ✅ Exact match |
| Re-simulation via `replayFrames()` | Generator in core | ✅ Exact match |

### Divergences (Minor):

1. **GameConfig shape evolved slightly:**
   - Sept design: `players: { count, colors[] }` + `generation: { seed, ... }`
   - Current: `playerColors[]` + `map: MapGenerationParams` (which includes seed)
   - **Impact:** Minimal - same data, slightly different nesting
   - **Note:** Current has TODO about `players.count` vs `map.numPlayers` duplication

2. **Replayer interface:**
   - Sept design: `replayFrames(config, history)`
   - Current: `replayFrames(config, history, opts?)` with `maxSteps` and `stopAfterLastEvent`
   - **Impact:** None - backwards compatible, added safety bounds

3. **No `defeatedPlayers` return from `processStep()`:**
   - Sept design considered returning `defeatedPlayers?: number[]`
   - Current: GameServer computes defeated via general diff before/after step
   - **Impact:** None - works correctly, just different implementation (Approach B)

### Missing from MVP Plan:

1. **Frontend replay viewer** (Phase 9) - completely absent
2. **Engine versioning** - Still a TODO in `GameConfig`
3. **Some type ownership cleanup** - Various TODOs remain
4. **Mid-game crash resilience** - No Redis buffer (out of scope for MVP)

## What Would It Take to Build a Replay Viewer?

Based on the Sept UI notes and current architecture, here's what's needed:

### 1. Backend API Endpoint (Optional - may already work)

The existing `GET /api/games/:id` endpoint returns:
```json
{
  "game": {
    "id": 123,
    "config": { ... },      // Has startingGrid, timing, etc.
    "move_history": { ... }, // Has version + events[]
    "game_state": { ... },   // Has final board state
    "status": "completed"
  }
}
```

**Assessment:** This endpoint already provides everything needed! Just needs:
- ✅ Config (for replay initialization)
- ✅ Move history (for events)
- ✅ Game state (for metadata, winner info)

**Potential improvement:** Add dedicated `/api/games/:id/replay` endpoint that returns ONLY the replay-relevant data to reduce payload size.

### 2. Frontend Replay Page

**File Structure:**
```
apps/frontend/src/pages/replay/
  ├── index.tsx              // Main replay page component
  ├── components/
  │   ├── replay-controls.tsx  // Play/pause, speed, step buttons
  │   ├── replay-scrubber.tsx  // Timeline slider
  │   └── replay-metadata.tsx  // Game info, players, winner
  └── stores/
      └── replay-store.ts      // Zustand store for replay state
```

**Routing:**
- Add route: `/replay/:gameId`
- Route config in React Router

**State Management (Zustand store):**
```typescript
interface ReplayState {
  // Data
  config: GameConfig | null;
  history: MoveHistoryV1 | null;
  frames: ReplayFrame[];  // Pre-computed or lazy

  // Playback state
  currentStep: number;
  isPlaying: boolean;
  speed: number;  // 0.5x, 1x, 2x

  // Actions
  loadReplay: (gameId: string) => Promise<void>;
  play: () => void;
  pause: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  jumpToStep: (step: number) => void;
  setSpeed: (speed: number) => void;
}
```

**Key Implementation Considerations:**

1. **Pre-compute vs Lazy Frames:**
   - **Option A:** Pre-compute all frames on load using `replayFrames()`
     - Pros: Instant scrubbing, simple
     - Cons: Memory usage for long games
   - **Option B:** Compute on-demand with caching
     - Pros: Lower memory, faster initial load
     - Cons: More complex, may need cache invalidation

2. **Frame Storage:**
   - Store in Zustand as array: `frames: ReplayFrame[]`
   - Each frame: `{ step, board, gameEnded, winner }`

3. **Playback Timer:**
   - Use `setInterval()` when playing
   - Clear on pause/unmount
   - Advance `currentStep` based on `speed`

4. **Board Rendering:**
   - Reuse existing `GameBoard` component from gameplay page
   - Pass `frames[currentStep].board` as board state
   - Use `config.playerColors` for rendering

5. **Visibility Modes:**
   - Default: Full map (all tiles visible)
   - Optional: Player POV using `Board.getVisibleSquares(playerIndex)`
   - Toggle in controls

6. **Performance:**
   - Memoize frame computation
   - Throttle render during fast playback
   - Consider virtualization for very long games

### 3. UI Components Needed

**ReplayControls:**
- Play/Pause button
- Step forward/backward buttons
- Speed selector (0.5x, 1x, 2x, maybe 4x)
- Jump to start/end buttons
- Current step indicator

**ReplayScrubber:**
- Slider/timeline showing full game length
- Marker for current position
- Click to jump to arbitrary step
- Maybe show key events (general captures) on timeline

**ReplayMetadata:**
- Game ID, date played
- Player names + colors
- Game outcome (winner, reason)
- Game duration (total steps, time elapsed)

**ReplayBoard:**
- Reuse existing GameBoard component
- Display current frame's board state
- Show player colors from config
- Optional: highlight last move

### 4. Effort Estimate

**Minimal Viable Replay Viewer:**
- Backend: ~0 hours (endpoint exists)
- Frontend Store: 2-3 hours
- Replay Page Shell: 1 hour
- Board Integration: 1 hour
- Basic Controls (play/pause/step): 2-3 hours
- Scrubber: 2-3 hours
- Polish + Testing: 2-3 hours

**Total: ~10-15 hours for basic viewer**

**Enhanced Features (+5-10 hours):**
- Player POV mode
- Timeline event markers
- Keyboard shortcuts
- Speed customization
- Share/embed functionality
- Mobile optimization

### 5. Technical Risks & Considerations

**Re-simulation Performance:**
- For long games (1000+ steps), full replay might be slow
- Mitigation: Pre-compute on load, show loading state
- Future: Server-side frame snapshots every N steps

**Memory Usage:**
- Storing all frames in memory could be large
- Mitigation: Start with pre-compute, optimize later if needed
- Each frame is ~(width × height × 8 bytes) per square

**Determinism Verification:**
- The `replay-verify.ts` script ensures determinism
- Should run as part of CI/CD
- Frontend can detect mismatches by comparing to `game_state.board`

**Browser Compatibility:**
- Core replay logic is pure JS, should work everywhere
- No special browser APIs required

**Responsiveness:**
- Board rendering needs to scale to mobile
- Controls should be touch-friendly
- Consider separate mobile layout

## Open Questions & Design Decisions Needed

1. **Should we pre-compute all frames or compute on-demand?**
   - Recommendation: Start with pre-compute (simpler), optimize later if needed

2. **Do we need a separate `/api/games/:id/replay` endpoint?**
   - Recommendation: Use existing `GET /api/games/:id` for MVP, optimize later

3. **Should replays show fog of war by default?**
   - Recommendation: Show full map by default, add POV toggle later

4. **Do we want to support watching replays of in-progress games?**
   - Recommendation: Only support completed games for MVP
   - Future: Could poll for updates and show partial replay

5. **Should we add replay sharing (permalink, embed)?**
   - Recommendation: Defer to post-MVP
   - Would need: public replay links, auth/privacy controls

6. **Do we want replay speed controls beyond 0.5x/1x/2x?**
   - Recommendation: Start with 3 speeds, add custom input if requested

7. **Should we implement keyboard shortcuts?**
   - Recommendation: Yes, very useful for power users
   - Space = play/pause, Arrow keys = step, 1/2/3 = speed

8. **How do we handle games with no move history?**
   - Recommendation: Show error message "Replay not available"
   - Only games completed after replay implementation have history

## Recommendations

### Immediate Next Steps (if building replay viewer):

1. **Create frontend replay page structure** (1-2 hours)
   - `pages/replay/index.tsx`
   - Basic routing
   - Stub components

2. **Build replay store** (2-3 hours)
   - Fetch game data
   - Integrate `replayFrames()` from core
   - Pre-compute frames
   - Playback state management

3. **Integrate board rendering** (1-2 hours)
   - Reuse GameBoard component
   - Wire up to replay store

4. **Implement controls** (3-4 hours)
   - Play/pause/step
   - Scrubber
   - Speed selector

5. **Polish & test** (2-3 hours)
   - Loading states
   - Error handling
   - Responsive design
   - Manual testing with real replays

### Future Enhancements (post-MVP):

1. **Engine versioning** - Add `engineVersion` to `GameConfig`
2. **Snapshot checkpoints** - Store board state every N steps for faster seeking
3. **Replay analytics** - APM tracking, territory graphs, army size over time
4. **Replay sharing** - Public links, embeds, social media cards
5. **Tournament replays** - Bracket integration, highlight reels
6. **Replay comments** - Community discussion on replays
7. **Replay speed analysis** - Identify critical moments, auto-highlight
8. **Crash resilience** - Redis buffer for mid-game durability

## TODOs Still in Codebase

From `GameConfig`:
```typescript
// TODO: num players is duplicated between `players.count` and `map.numPlayers`...
// TODO(engine-versioning): engineVersion?: string
```

From `create-game.ts`:
```typescript
// TODO: look into if this is an acceptable way to generate seeds
```

From `game-routes.ts`:
```typescript
// TODO: Are there easy / nice ways of having request.params auto-typed?
```

These are minor and don't block replay viewer implementation.

## Conclusion

The replay system is **85% complete**. The backend infrastructure is robust, well-tested, and production-ready. The core replay engine is deterministic and efficient. **The only major missing piece is the frontend viewer**, which would take approximately 10-15 hours to build a functional MVP.

The September 2025 implementation was well-designed and has aged well through the v0.2 refactor. The architecture is sound and ready for frontend integration. No major changes or refactors are needed to support a replay viewer - it's purely additive work on the frontend.

**Test Status:** ✅ All tests passing (98 total: 45 backend, 53 core)
**Production Readiness:** Backend is production-ready, frontend needs to be built
**Recommended Timeline:** 2-3 days for basic replay viewer MVP
