# Branch: puzzles-1st-spike

**Base:** spike/ui-v0.1
**Commits:** 13
**Date:** Dec 2025 - Jan 2026
**Status:** In progress (WIP)

Inherits home page layout, nav refactor, and user domain improvements from `spike/ui-v0.1`. The actual UI content was experimental and unfinished when this branch started, but the approach feels solid: minimal styling, focus on UX and layout fundamentals, intentionally avoiding strong aesthetic/stylistic choices until the v1 vision is clearer. This branch continues that approach.

---

## Summary

"Best Start" puzzle mode - a mini-game/practice mode for optimizing the first 25 turns (one "round") of gameplay.

**Strategic rationale:** Puzzles are complementary to generals.io rather than competitive. Players can play real games there and do puzzles here. This is a community-friendly first release that adds value without fragmenting the player base.

---

## Concept: "Best Start" Puzzle

In generals.io-style games, the first 25 turns ("round 1") are critical:
- Players expand from their general to claim territory
- After each round, all owned land gains +1 unit
- Efficient early expansion compounds throughout the game

The puzzle isolates this phase for deliberate practice:
1. Generate a map with one general
2. Player has 25 turns to expand optimally
3. Score based on territory/units captured
4. Eventually: compare to computed ideal solution

---

## User Stories (PoC Scope)

### Core Loop
- **Start puzzle:** Generate map (blank map OK for PoC), initialize game state
- **Play puzzle:** See map, make moves, troops generate each turn, see turn/army info
- **Complete puzzle:** After 25 turns, round ends
- **See results:** Simple scoring (land count) for PoC
- **Next puzzle:** Start another

### Deferred for Later
- Procedural map generation (have code, needs puzzle-specific config)
- Ideal solution calculation and comparison
- Stats/history tracking over time
- Leaderboards (requires backend move validation)

---

## Architecture Decisions

### Backend Processing
Moves are processed on the backend (not frontend-only) to:
- Future-proof for leaderboards and anti-cheat
- Reuse existing game processing patterns
- Keep client logic simple

### Puzzle Rooms
Each puzzle session uses a room: `puzzles:user-{userId}`
- Analogous to game rooms for multiplayer
- Enables server→client state updates

---

## Implementation Status

### Frontend (`apps/frontend/src/domains/puzzles/`)

**Pages:**
- `BestStartMainPage` - Entry point at `/puzzles`, links to play
- `BestStartPlayPage` - Puzzle gameplay at `/puzzles/play`
  - Currently renders a 21x21 blank map with general at center
  - Start button triggers `startPlayingPuzzles` action
  - Uses existing `GameBoard` component

**Actions:**
- `startPlayingPuzzles(user)` - Initiates puzzle session via WebSocket

**WS Effects:**
- `sendStartPlaying()` - Request new puzzle
- `sendMoveRequest(coord, direction)` - Queue a move
- `sendCancelMoves()` - Clear move queue
- `sendUndoMove()` - Undo last queued move

### Backend (`apps/backend/src/domains/puzzles/`)

**Handlers:** (`handlers.ts`)
- `puzzles:start-playing` - Calls `setupAndStartPuzzle`
- `puzzles:move-request` - Stub
- `puzzles:undo-move` - Stub
- `puzzles:cancel-moves` - Stub

**Actions (`setup-and-start-puzzle.ts`):**
- `setupAndStartPuzzle(userId, connectionId)` - Async, joins user to puzzle room, fetches user, creates puzzle
- `createPuzzle(user)` - Creates initial puzzle state with map and gameState
- `buildMap()` - Creates 21x21 blank map with general at center (10,10)

**Types/Constants:** *(currently in `setup-and-start-puzzle.ts`, may move as work progresses)*
- `Puzzle` interface - `{ user, gameState, type }`
- `PUZZLE_TYPE_BEST_START` constant

**Utils (`utils.ts`):**
- `buildPuzzleRoomId(userId)` - Creates room ID for puzzle sessions

**Stubs/WIP:**
- `puzzles-manager.ts` - Empty (analogous to GameServer). Stub `PuzzleManager` class currently in `setup-and-start-puzzle.ts` for dev convenience, will move here once design settles.
- `create-puzzle.ts` - Empty
- `actions-OLD.ts` - Scratchpad/exploration code

### Protocol (`packages/protocol/domains/puzzles/`)

**Client Messages:**
- `puzzles:start-playing` - Empty payload
- `puzzles:move-request` - `{ sourceCoord, direction }`
- `puzzles:cancel-moves` - Empty payload
- `puzzles:undo-move` - Empty payload

**Server Messages:**
- `puzzles:state-update` - `{ board: any }` (TODO: proper types)
- `puzzles:end-puzzle` - `{ finalBoardState: any }` (TODO: proper types)

### Core Package Additions

**New files:**
- `map/make-blank-map.ts` - Creates empty grid of given dimensions
- `map/make-squares.ts` - `makeGeneralSquare()` factory

**Refactored:**
- `game-map-generator.ts` - Now uses `makeGeneralSquare()`

### Utils Package

- `range.ts` - Simple `range(n)` helper function

---

## Files Changed

```
Frontend (10 files):
  - App.tsx (added puzzle routes)
  - domains/home/pages/home/home-page.tsx (added Puzzles link)
  - domains/puzzles/* (new - 7 files)
  - domains/users/user-store.ts (added selectError)
  - ws/message-types.ts (added PuzzlesClientMessage)

Backend (9 files):
  - domains/puzzles/* (new - 7 files)
  - ws/message-types.ts (added puzzle types)
  - ws/server-bootstrap.ts (registered puzzlesHandlers)

Packages (7 files):
  - core/src/map/* (new - 2 files)
  - core/src/terrain-generation/game-map-generator.ts (refactored)
  - platform/domains/chat/helpers.ts (removed unused function)
  - protocol/domains/puzzles/* (new - 2 files)
  - utils/range.ts (new)
```

---

## Next Steps to Complete PoC

1. **PuzzleManager class** - Analogous to GameServer, which manages active multiplayer game sessions (move queues, game ticks, countdown timers, state broadcasting to players). GameServer is currently somewhat overloaded with logic that probably belongs elsewhere or in `@core`. Building PuzzleManager is an opportunity to learn from those mistakes and design with better separation of concerns from the start—potentially yielding insights for cleaning up GameServer later, or discovering shared patterns both could use.
   - Holds puzzle state (board, turn count, move queue)
   - Processes moves using existing core logic
   - Tracks when puzzle completes (turn 25)
   - *Partial:* `Puzzle` interface and `createPuzzle()` now exist

2. **Wire up handlers** - Connect move/undo/cancel to PuzzleManager

3. **State updates** - Send board state to client after each move

4. **Completion flow** - Detect turn 25, send final results, scoring

5. **Map generation** - Currently using blank 21x21 map with centered general
   - *Future:* Use existing procedural generator with puzzle-specific config

6. **Frontend handlers** - Process `puzzles:state-update` messages, update store/UI

---

## Open Questions

- Map generation config for puzzles (size, terrain density, etc.)
- Scoring algorithm beyond simple land count
- How to structure PuzzleManager vs GameServer (share code? separate?)
- Server message types need proper typing (currently `any`)
