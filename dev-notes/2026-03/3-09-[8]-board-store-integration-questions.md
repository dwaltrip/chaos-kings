# Board Store Integration — Open Questions

Questions to keep in mind during integration. Don't need to answer all upfront — revisit after integrating puzzles + sandbox.

---

## Action Simplification

**Can `handleStateUpdate` become trivially thin?**
In puzzles and sandbox, `handleStateUpdate` currently does ~10 lines of orchestrator calls, visibility recomputation, and store setter calls. With board-store, it becomes one `applyTick()` call plus a few domain-specific fields. At that point, does the action even justify its own file, or can the handler call board-store directly?

**Can `queueMove` be shared across domains?**
Puzzles, sandbox, and gameplay all do the same thing: validate via `Board.canMove()`, call `addQueuedMove()`, update tile stores, move selection to destination, send WS message. The only difference is which ws-effects module sends the message. Could a shared `queueMove` live in `games/` with the WS send passed in or configured?

**Can `undoMove` / `clearMoves` be shared?**
Puzzles and sandbox versions just send a WS message — no local state changes. Gameplay's undo does local optimistic work. The WS-only versions could trivially share.

---

## Tile Components & Module Organization

**`BoardTile` and `toTileRendererProps` don't belong in board-store.**
Board-store should stay pure state (actions, hooks, diffing). Rendering concerns like `BoardTile`, `toTileRendererProps`, and `TileRenderer` are a separate layer. Current `BoardTile` imports `TileRenderer` from `gameplay/ui/` — that cross-domain direction is wrong.

**Where do the shared board UI pieces live?**
Options once integration is done:
- `games/board/` — sub-domain grouping both store and UI (`games/board/store/`, `games/board/ui/`)
- `board/` — its own top-level domain if it grows substantial enough
- `games/board-store/` for state + `games/ui/` for shared components — lighter touch

Let integration reveal the right shape before deciding.

**Can `PuzzleTile`, `SandboxTile`, `GameTile` collapse into a shared tile component?**
All three do the same thing: read per-tile state, compute a few derived flags, pass to `TileRenderer`. The only difference is the `onClick` handler wiring. Could each domain just use a shared component with a domain-specific click handler?

**Does `TileRenderer` need to move out of `gameplay/`?**
It's a pure presentation component imported by all three domains. It probably belongs in the shared board UI layer, wherever that ends up.

---

## WS Effects

**Can move-related WS effects be shared?**
`sendMoveRequest`, `sendUndoMove`, `sendCancelMoves` exist in puzzles, sandbox, and gameplay ws-effects. The message creators might differ by domain prefix. Worth checking if the protocol messages are actually the same or domain-specific.

---

## State Boundaries

**Is `'active' | 'ended'` the right status for board-store?**
Each domain has its own idle/loading concept. Board-store only knows `'active' | 'ended'`. This seems right — the domain owns "are we ready to start?" and board-store owns "is the game running or over?" But worth confirming this doesn't create awkward gaps.

**Where does `lastExecutedMove` live?**
Sandbox uses it for optimistic step-forward (cached in `moveHistoryCache`). Board-store doesn't have it. Options: (a) keep it in sandbox-specific code, (b) add to `BoardSourceState`. Leaning toward (a) since it's only used by sandbox's timeline feature.

**Where does `gameplayReady` live?**
Currently gates tick processing in gameplay's `updateGameplayState`. It's a domain-level concern (don't process ticks until setup is complete). Should stay in gameplay — board-store shouldn't know about readiness gates.

---

## Cleanup Scope

**What gets deleted after all three domains migrate?**
- `games/stores/board-session-store.ts`
- `games/stores/tile-store-registry.ts`
- `games/stores/tile-orchestrator.ts`
- `games/hooks/use-tile-store-state.ts`
- `games/utils/tile-selection-helpers.ts`
- `games/board-session/actions/` (if exists)
- Per-domain tile components (if collapsed into `BoardTile`)

**What about `gameplayStoreV2`?**
After migration it would shrink to: `game`, `gameplayReady`, player lookup maps. Worth asking if it still needs to exist or if those fields move elsewhere.

---

## Revisit After Two Domains

After puzzles + sandbox are integrated, revisit this doc and see which questions have natural answers from the implementation experience.
