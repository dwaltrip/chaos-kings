# Post-Integration Survey: Frontend Codebase State

Read-only survey of frontend code after board-store integration across all three domains. Organized by finding, not by file.

---

## 1. Exact duplication ready to collapse

### Three identical tile components

`PuzzleTile`, `SandboxTile`, `GameTile` are character-for-character identical (except the component name and display name). Each is ~32 lines doing the same thing:

```ts
const tile = useTileData(boardStore, coord);
const rendererProps = toTileRendererProps(tile);
return <TileRenderer {...rendererProps} onClick={tile.isSelectable ? () => setSelectedTile(coord) : undefined} />;
```

All wrapped in `React.memo` with `areCoordsEqual`. Same imports, same logic. **And** `board-store/board-tile.tsx` (27 lines) does the same thing without the memo wrapper. Four copies total.

Files: `puzzles/ui/puzzle-tile.tsx`, `sandbox/ui/sandbox-tile.tsx`, `gameplay/ui/game-tile.tsx`, `games/board-store/board-tile.tsx`

### queueMove — 95% identical across domains

All three implement the same pattern (~24-28 lines each):
1. Read board from `boardStore.state.game.board`
2. Guard: `!board` → return
3. Validate: `Board.canMove(board, source, direction)` → return
4. `addQueuedMove({ sourceCoord, direction })`
5. `setSelectedTile(Board.applyDirection(source, direction))`
6. `domainWsEffects.sendMoveRequest(source, direction)`

Only differences: gameplay has an extra `!selectedTile` guard, sandbox logs a debug message on missing board. The ws-effects call is the only truly domain-specific part.

Files: `puzzles/actions/queue-move.ts`, `sandbox/actions/queue-move.ts`, `gameplay/actions/queue-move.ts`

### Move ws-effects — identical protocol shape

All three domains have identical `sendMoveRequest`, `sendCancelMoves`, and `sendUndoMove`. Each calls the corresponding `MsgCreators.createXxxMessage()` from its own protocol package. The protocol messages have the same payload shape (`{sourceCoord, direction}` for move, empty for cancel/undo). Only the protocol import path differs (`@protocol/domains/puzzles/...` vs `sandbox` vs `gameplay`).

Files: `puzzles/ws-effects.ts` (lines 11-21), `sandbox/ws-effects.ts` (lines 40-50), `gameplay/ws-effects.ts` (lines 17-27)

---

## 2. Dependency direction violation: games → gameplay

`TileRenderer` and `TileRendererProps` live in `gameplay/ui/tile-renderer.tsx` but are imported by **7 files across 5 domains:**

- `games/board-store/board-tile.tsx`
- `games/board-store/tile-data.ts`
- `puzzles/ui/puzzle-tile.tsx`
- `sandbox/ui/sandbox-tile.tsx`
- `gameplay/ui/game-tile.tsx`
- `game-ui-lab/ui/lab-tile.tsx`
- `replay/pages/replay-tile.tsx`

This violates the stated rule: "`games` never imports from `gameplay` or `puzzles`." `TileRenderer` is clearly shared infrastructure, not gameplay-specific. It also imports `MoveArrow` from `gameplay/ui/move-arrow`.

**Resolution:** Move `TileRenderer` + `MoveArrow` to `games/` (likely `games/ui/` or alongside board-store).

---

## 3. Domain stores: lean and well-separated

Post-migration, each domain store holds only domain-specific metadata. Board state is fully externalized to board-store.

| Store | State held |
|-------|-----------|
| **puzzle-store** | `status` (idle\|playing\|ended), `result`, `userStats` |
| **sandbox-meta-store** | `status` (idle\|active), `isPaused`, `config`, `maxTickReached` |
| **gameplay-store-v2** | `game`, `gameplayReady`, player lookups (`players`, `playersByIndex`, `playersByUserId`, `currentPlayer`, `currentPlayerIndex`) |
| **gameplay-page-store** | `data` (GameWithPlayers), `countdownActive`, `countdownSeconds` + async loading state |

All stores are thin — simple setters, no business logic. The pattern is clean and consistent.

**Minor issues:**
- `sandbox-meta-store` has a TODO (line 5-7): `isPaused` and `maxTickReached` are "timeline concepts" that should move to a shared timeline store for replay-edit.
- `gameplay-store-v2` has `useIsGameEnded` duplicated with `gameplay-page-store.isGameEnded()` (acknowledged in a comment).
- Gameplay has a cross-store subscription: `gameplay-store-v2` subscribes to `gameplay-page-store` to sync the `game` field. This is orthogonal to board-store but worth noting as a pattern.

---

## 4. Handlers: appropriately thin

All three handlers are thin routers with no business logic:

| Domain | Lines of routing logic | Message types handled |
|--------|----------------------|----------------------|
| Puzzles | 8 | 2 (`state-update`, `end-puzzle`) |
| Sandbox | 19 | 3 (`session-started`, `state-update`, `error`) |
| Gameplay | 22 | 4 (`state-update`, `game-starting`, `game-started`, `game-ended`) |

**One borderline case:** Gameplay handler (line 29) calls `deserializeGameWithPlayers()` — a `@platform` deserialization utility. Could be moved to the action, but it's a one-time setup call, not a recurring pattern.

---

## 5. Actions: domain-specific logic is genuinely different

Beyond the duplicated `queueMove`, each domain has legitimately unique actions:

**Puzzles** (8 action files, mostly thin):
- `clear-moves.ts` and `undo-move.ts` are pure ws-effect wrappers (8 lines each)
- `handle-puzzle-end.ts` is the most complex (32 lines) — applies final board + async stats load
- `load-user-stats.ts` — REST API call, unique to puzzles

**Sandbox** (14 action files, moderate complexity):
- `step-forward.ts` (57 lines) — optimistic stepping with move history cache + core step-processor. Genuinely complex domain logic.
- `clear-moves.ts` (27 lines) — reads `lastExecutedMove` from history cache to compute selection after clearing. More sophisticated than puzzles/gameplay.
- `handle-state-update.ts` (31 lines) — calls `applyTick` + caches move history + syncs pause/max-tick state.
- 5 thin ws-effect wrappers (pause, play, reset, undo-move, step-back)

**Gameplay** (12 action files, moderate-to-high complexity):
- `setup-game-state.ts` (42 lines) — multi-store orchestration for game setup with conditional logic based on game status.
- `load-gameplay-page.ts` (30 lines) — async loading orchestration with guards, multi-action coordination.
- `update-gameplay-state.ts` (27 lines) — guards against race conditions (checks `gameplayReady` and `currentPlayerIndex`), reads player-specific queue.
- `update-for-game-ended.ts` (30 lines) — updates game status, applies final board, sets ended state.
- `cancel-queued-moves.ts` and `undo-last-queued-move.ts` — note naming inconsistency: gameplay uses `cancelQueuedMoves` while puzzles/sandbox use `clearMoves`.

---

## 6. Import pattern inconsistencies

### Board-store imports: mixed styles

Some files import individual functions directly, some mix function imports with `boardStore` object access:

```ts
// Puzzles style — aliases to avoid name collision
import { setStatus as setBoardStatus, setSelectedTile as setBoardSelectedTile } from '@/domains/games/board-store';

// Sandbox/Gameplay style — no aliases
import { boardStore, addQueuedMove, setSelectedTile } from '@/domains/games/board-store';
```

The aliasing in puzzles (`setBoardStatus`, `setBoardSelectedTile`) doesn't appear in other domains. Not a functional issue, but inconsistent.

### Sub-path vs index imports

Some files import from the board-store index, others from sub-paths:
```ts
import { boardStore } from '@/domains/games/board-store';           // from index
import { useTileData } from '@/domains/games/board-store/hooks';    // sub-path
import { toTileRendererProps } from '@/domains/games/board-store/tile-data'; // sub-path
```

The hooks and tile-data functions aren't re-exported from the index. This is intentional (keeps the index API focused on actions) but not documented.

---

## 7. Page components: different enough to stay separate

Unlike tile components, the page components are structurally different:

- **Puzzles play page** — user auth, puzzle status, manual army/land stat calculation, two-column layout
- **Sandbox page** — session lifecycle (start/cleanup on mount/unmount), playback controls, click-to-deselect
- **Gameplay page** — async game loading, route params, join/leave room lifecycle, countdown, error/loading states, navigation guards

All three use `useBoardState(boardStore)` to read board state, which is the consistent shared pattern. The domain-specific concerns around that are genuinely different.

**One potential concern:** Puzzles play page (lines 68-74, 115-129) manually computes army/land stats from the board — gameplay gets these from `playerStats` in board-store. Puzzles passes `[]` for `playerStats` to `applyTick`, so it has to compute them itself. Worth considering whether puzzles should compute stats server-side or derive them from the board in a shared helper.

---

## 8. The games/ shared layer

Post-cleanup, `games/` contains:
- **`board-store/`** — 15 files (~1,100 lines impl + ~550 lines tests). Custom store factory with tile caching, centralized pipeline, derived state. Not Zustand — a minimal `createStore` with subscriber-per-tile granularity.
- **`games-api.ts`** — REST API layer for loading game entities

The board-store is purely state management + rendering data pipeline. No handlers, no ws-effects — domains own their own WS coordination. This is correct.

**What's NOT in games/ but probably should be:** `TileRenderer`, `MoveArrow`, and the `BoardTile` concept (currently `board-tile.tsx` in board-store, but the three domain copies are the actual consumers).

---

## 9. Domain structure overview

| Domain | Type | Key pattern |
|--------|------|-------------|
| **games** | Shared layer | Board-store + game API. Used by gameplay, puzzles, sandbox |
| **gameplay** | Board domain | Real-time multiplayer. Largest domain (24 files) |
| **sandbox** | Board domain | Offline board with timeline controls (24 files) |
| **puzzles** | Board domain | Puzzle solving (16 files) |
| **replay** | Special | Does NOT use board-store — own replay store + frame cache |
| **chat** | Non-board | In-game chat |
| **matchmaking** | Non-board | Game queue |
| **users** | Non-board | Auth/identity, imported by many domains |
| **system** | Non-board | Connection lifecycle |
| **game-ui-lab** | Experimental | UI component showcase |
| **home** | Non-board | Landing page |

**Replay is the outlier:** It uses its own state management and rendering, not board-store. This may be intentional (frame-based snapshots vs continuous state) or may be pre-migration tech debt.

---

## 10. Staleness in docs

### docs/architecture.md
- No mention of board-store architecture, the custom store factory, or the tile caching pipeline
- Frontend domain structure section (line 99-107) doesn't explain the shared board-store pattern
- `games` domain described as "Game entity management, lifecycle" — missing "shared board rendering layer"
- References `docs/frontend-component-organization.md` which may not exist
- No mention of replay's separate architecture

### apps/frontend/AGENTS.md
- Cross-domain import rule ("games never imports from gameplay") is violated in practice
- No mention of board-store as a pattern (only mentions Zustand stores)
- No guidance on when to use board-store vs domain-specific state

---

## Summary: top items for cleanup discussion

1. **Collapse tile components** — 4 identical copies → 1 shared `BoardTile` in `games/`
2. **Move TileRenderer + MoveArrow** to `games/` — fixes the dependency violation, 7 files benefit
3. **Extract shared queueMove** — parameterize the ws-effects call, share the rest
4. **Audit move ws-effects** — protocol shapes are identical; consider shared move ws-effects
5. **Naming consistency** — `cancelQueuedMoves` vs `clearMoves`
6. **Update docs** — architecture.md and frontend AGENTS.md need board-store sections
7. **Decide on replay** — should it adopt board-store or is its architecture intentionally different?
