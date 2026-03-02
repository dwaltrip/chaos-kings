# Game State Research Compilation

Deep dive across all dev-notes from Aug 2025 – Mar 2026 related to game state management, board architecture, Zustand refactor, and unified board UI.

---

## Files Found (Chronological)

### Aug 2025 — Performance Analysis & Per-Tile Stores

**`8-13-game-page-refactoring.md`** — Early architecture analysis arguing `GameUI` should be autonomous, not dependent on `GamePage` for state. Key quote: "GameUI cannot function independently... Impossible to reuse GameUI in other contexts (spectator, replay, tutorial)." This framed the decoupling of state from rendering.

**`8-26-frontend-performance-analysis.md`** — Root cause analysis of mass re-renders:
- Every `GameTile` subscribes to entire `queuedMoves` array → 400 re-renders per move
- `Board.getVisibleSquares()` runs per tile = O(tiles × playerSquares × 8)
- Missing `React.memo` on `GameTile`
- Notes Zustand v5 custom equality functions work differently from v4

**`8-26-tile-store-refactor-analysis.md`** — Proposed per-tile Zustand stores to solve mass re-renders. Full `TileState` interface sketch. Open question: where does the coord→tileStore mapping live?

**`8-26-UI-perf-idea-v2.md`** — Daniel's brainstorm sketch of per-tile store architecture:
```ts
// gameBoardStore.updateBoard triggers buildTileLevelData() then distributes to per-tile stores
const gameBoardStore = create<GameBoardState>((set) => ({
  actions: {
    updateBoard: ((newBoardState) => {
      const dataPerTile: Map<Coord, TileState> = buildTileLevelData(newBoardState);
      dataPerTile.entries().forEach(([coord, state]) => {
        const tileStore = getOrCreateTileStore(coord);
        tileStore.update(state);
      });
    }),
  },
}));
```

**`8-27-phase-1-tile-store-implementation-summary.md`** — What was actually committed (commit `1ac2030`): Registry pattern (`tile-store-registry.ts`), individual hook selectors, tile orchestrator for bulk updates. **Phase 2 (migrate square/visibility state) was never completed.**

---

### Dec 2025 — Replay MVP & TileRenderer Extraction

**`12-06-[1]-replays-mvp-doc-1-checkpoint-strategy.md`** — Replay checkpoint/caching strategy (checkpoint every N=25 steps, LRU cache). This logic later became `TimelineEngine`.

**`12-06-[2]-replays-mvp-doc-2-tile-components.md`** — **Key architectural decision**: extracted `TileRenderer` (pure rendering, no hooks, all visual state as props) from `GameTile`. This is the foundation for all store-free rendering.
```
TileRenderer (pure rendering) — no hooks, no state management
GameTile (refactored) — gameplay hooks, wraps TileRenderer
ReplayTile (new) — simple wrapper, no interactions
```

---

### Jan 2026 — Unified Board Session & Sandbox

**`1-20-[1]-gameplay-puzzles-unification-options.md`** — Comprehensive analysis of sharing code across gameplay/puzzles/sandbox/replay. Documents Option 1A (Shared BoardSession Store) which was ultimately built. Also documents `createBoardInteractions(deps)` factory pattern. Key insight: "The store decision has cascading effects."

**`1-25-[1]-sandbox-design-doc.md`** — Full design doc including canonical `BoardSessionStore` interface and `TimelineManager`. Notes: "Sandbox uses new stores; existing modes unchanged — prove pattern first, migrate later." `SandboxTile` is "the unified tile — TODO: migrate GameTile/PuzzleTile."

**`1-25-[2]-sandbox-implementation-review.md`** — Post-implementation assessment. Confirms `BoardSessionStore` is "clean and ready for reuse." Store comparison table:

| Field | BoardSessionStore | GameplayStoreV2 | PuzzleStore |
|-------|------------------|-----------------|-------------|
| Board | `board` | `boardState` | `board` |
| Tick | `tick` | `tick` | `tick` |
| Selected | `selectedTile` | `selectedTile` | `selectedTile` |
| Visible | `visibleSquares` | `visibleSquares` | `visibleSquares` |
| Queue | `queuedMoves` | `queuedMoves` | `moveQueue` |

Migration readiness: puzzles = low-medium effort, gameplay = high risk.

---

### Feb 2026 — TimelineEngine

**`2-07-[1]-timeline-engine-design.md`** — Design doc for `TimelineEngine` in `@core/timeline/`. **Implemented and tested (43 tests).** API:
```ts
class TimelineEngine {
  constructor(initialState, timing, config?)
  tick(moves): ProcessStepResult
  jumpToTick(target): void
  reset(): void
  getState(): Readonly<GameState>
  getMaxTick(): number
  getCurrentTick(): number
}
```
Future: shared by sandbox, replay, puzzles, gameplay.

**`2-07-[2]-next-session-sandbox-integration.md`** — Handoff doc: integrate `TimelineEngine` into sandbox, rename `SandboxManager` → `SandboxSession`.

---

### Mar 2026 — Current Refactor

**`3-01-[1/2/3]-game-ui-lab-*.md`** — Game UI Lab implemented with **zero Zustand stores**. Everything computed from static snapshots, passed as props to `TileRenderer`. Proof-of-concept that boards render fine without stores.

**`3-01-[4]-game-state-refactor-notes.md`** — The trigger. Documents the stack overflow crash and 6 specific brittleness points in current Zustand architecture (cross-store sync, Object.is failures, bulk synchronous updates, etc.).

**`3-01-[5]-game-state-refactor-prompt-1.md`** — Current session framing. Goals: move away from Zustand, decouple state from rendering, enable future non-React board rendering.

---

## Key Themes

1. **BoardSessionStore exists and is ready for reuse** — designed Jan 2026, built for sandbox, gameplay/puzzles haven't migrated yet.

2. **Per-tile Zustand stores (Phase 1) were built but Phase 2 never completed** — the registry/orchestrator pattern exists but full state migration didn't happen.

3. **TileRenderer (pure, prop-driven) is the rendering foundation** — game-ui-lab proved zero-store boards work. The component-level decoupling is done.

4. **TimelineEngine in @core is fully implemented** — owns game state + history + checkpoints outside React. Not yet integrated with sandbox frontend.

5. **The "external store" direction is implicit everywhere** — `moveHistoryCache` outside Zustand, `TimelineEngine` owning state in @core, game-ui-lab using zero stores. The trajectory points toward plain JS state ownership with React as a thin rendering subscriber.
