# Replay MVP - Remaining Design Decisions

**Date:** 2025-12-06
**Context:** Final design decisions for replay viewer MVP

## Summary of Decisions

This document covers all remaining design decisions for the replay MVP implementation.

---

## 1. Visibility System

**Decision:** Full map view only (no fog of war)

**Implementation:**
- Pass `isVisible = true` for all tiles
- No visibility calculations needed
- Users see complete game state

**Post-MVP:**
- Add player POV toggle
- Calculate visibility using `Board.getVisibleSquares(playerIndex)`
- Dropdown to select which player's perspective

**Rationale:** Simpler implementation, users typically want to see "what really happened." TileRenderer already supports `isVisible` prop for future POV mode.

---

## 2. Type Safety for move_history

**Decision:** Add proper `MoveHistoryV1` typing to database schema

**Current:**
```typescript
interface GamesTable {
  move_history: object | null;  // Too generic
}
```

**Updated:**
```typescript
import type { MoveHistoryV1 } from '@core/replay/types';

interface GamesTable {
  move_history: MoveHistoryV1 | null;
}
```

**Implementation:**
- Update `apps/backend/src/domains/games/game.db.ts`
- No database migration needed (TS types only)
- Better type safety at DB layer

---

## 3. Playback Controls

**Decision:** Two modes - Autoplay and Manual

### Autoplay Mode
- Play/Pause button
- Uses original `config.timing.tickRateMs` (single speed, no multiplier)
- Continuous frame advancement

### Manual Mode
- Step Forward / Step Backward buttons
- No continuous playback
- User controls each frame

### Mode Switching
- Pressing Play → enters autoplay mode
- Pressing Step Forward/Backward → pauses autoplay, enters manual mode

### State Management
```typescript
interface ReplayState {
  isPlaying: boolean;      // true = autoplay active
  currentStep: number;

  actions: {
    play: () => void;         // Start autoplay
    pause: () => void;        // Pause autoplay
    stepForward: () => void;  // Advance 1 frame, pause if playing
    stepBackward: () => void; // Go back 1 frame, pause if playing
  };
}
```

### NOT in MVP
- ❌ Scrubber/timeline slider
- ❌ Speed controls (0.5x, 1x, 2x)
- ❌ Jump to start/end buttons

**Post-MVP (Part 2):**
- Add scrubber for quick seeking
- Add speed multiplier controls
- Add jump to start/end

---

## 4. Player Defeat Visualization

**Decision:** Show only final winner (no intermediate defeats)

**Implementation:**
- Display winner when `gameEnded = true`
- No tracking of when individual players were eliminated

**Post-MVP:**
- Show "Player Red eliminated at step 245" messages
- Gray out defeated players in player list
- Visual indicators for elimination events

**Rationale:** Simpler for MVP, can add defeat tracking later as enhancement.

---

## 5. Missing Move History Handling

**Decision:** Defensive on both ends (hide + error)

Games created before the replay system have `move_history: null`.

### Implementation Strategy

**On Games List Page:**
- Don't show "Watch Replay" button if `game.move_history === null`
- Only show replay option for games with replay data

**In Replay Viewer:**
- Check for `move_history === null` in loader
- Display error message: "Replay not available for this game"
- Show link back to games list

**Rationale:** Users shouldn't encounter unavailable replays, but handle gracefully if they hit the URL directly.

---

## 6. Keyboard Shortcuts

**Decision:** Move to MVP Part 2 (post-MVP)

**Planned shortcuts for Part 2:**
- `Space` = Play/Pause
- `Arrow Right` = Step Forward
- `Arrow Left` = Step Backward
- `R` = Restart (jump to step 0)

**Rationale:** Focus on core functionality first, add keyboard controls as polish.

---

## 7. Player Colors Verification

**Decision:** Add verification note

**TODO:** Verify that `config.playerColors` format matches what `TileRenderer` expects.

**Check:**
- Does `getPlayerColor(playerSquare.playerIndex)` work with `config.playerColors`?
- May need to map `playerIndex → config.playerColors[playerIndex]`

**Location to verify:**
- `apps/frontend/src/utils/player-colors.ts`
- `packages/core/src/game-config.ts` (playerColors type)

---

## 8. Routing

**Decision:** `/replay/:gameId`

**Route configuration:**
```typescript
{
  path: '/replay/:gameId',
  element: <ReplayPage />
}
```

**URL examples:**
- `/replay/123` - Watch replay of game 123
- `/replay/456` - Watch replay of game 456

---

## 9. Access Pattern / UI Entry Points

**Decision:** Implement in MVP Part 2

**Planned entry points (Part 2):**
- Button on games list page: "Watch Replay"
- Link from completed gameplay page
- Direct URL navigation

**For MVP:**
- Access via direct URL only (`/replay/:gameId`)
- No UI buttons yet
- Focus on replay viewer functionality

---

## 10. Replay Page Metadata

**Decision:** Barebones metadata for MVP, polish in Part 2

### MVP Includes (Minimal)
- Game ID
- Player names (from `game.players`)
- Winner display (when game ends)

### Post-MVP (Part 2) Includes
- Game date/time
- Game duration (total steps, real time)
- Player colors legend
- Game outcome/reason
- Formatted metadata section

**Implementation:**
```tsx
function ReplayPage() {
  return (
    <div className="replay-page">
      {/* Minimal header */}
      <div className="replay-header">
        <h1>Game #{gameId}</h1>
        <div>Players: {players.map(p => p.username).join(' vs ')}</div>
      </div>

      {/* Main replay viewer */}
      <ReplayViewer gameId={gameId} />

      {/* Controls */}
      <ReplayControls />
    </div>
  );
}
```

**Rationale:** Get core replay functionality working first, polish UI later.

---

## MVP Scope Summary

### ✅ In MVP (Part 1)
1. Lazy frame computation with N=25 checkpoints
2. LRU cache for computed frames
3. TileRenderer extraction for clean component architecture
4. Full map visibility (no fog of war)
5. Play/Pause autoplay mode
6. Step forward/backward manual mode
7. Proper `MoveHistoryV1` typing
8. Winner display only (no intermediate defeats)
9. Missing replay error handling
10. `/replay/:gameId` routing
11. Barebones page metadata
12. Direct URL access only

### 🔜 MVP Part 2 (Polish & Enhancement)
1. Scrubber/timeline for seeking
2. Speed controls (0.5x, 1x, 2x, etc.)
3. Keyboard shortcuts
4. "Watch Replay" buttons on games list
5. Link from completed gameplay page
6. Polished metadata display
7. Player POV toggle (optional)
8. Defeat visualization (optional)

---

## Technical Architecture Summary

**Packages:**
- `@core/replay` - `replayFrames()`, types (already exists)
- `apps/frontend/src/pages/replay/` - Replay page (new)
- `apps/frontend/src/domains/replay/` - Replay domain (new)
  - `stores/replay-store.ts` - Zustand store
  - `ui/replay-tile.tsx` - Tile component
  - `ui/replay-controls.tsx` - Control buttons
- `apps/frontend/src/domains/gameplay/ui/tile-renderer.tsx` - Extracted renderer (refactor)

**Data Flow:**
1. User navigates to `/replay/:gameId`
2. ReplayPage loads game via `GET /api/games/:gameId`
3. ReplayStore computes initial frame (step 0)
4. User controls playback (play/pause/step)
5. Store manages checkpoints and frame cache
6. ReplayBoard renders current frame using TileRenderer

---

## Next Steps

1. Refactor GameTile → extract TileRenderer
2. Create ReplayTile wrapper
3. Implement ReplayStore with checkpoint caching
4. Build ReplayPage with minimal UI
5. Add Play/Pause/Step controls
6. Test with real game data
7. Verify player colors work correctly
