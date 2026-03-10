# Board Store V2 — Background & Design Decisions

Reference doc covering the problems, design evolution, and key decisions behind the board-store v2 implementation. For API reference and file map, see the [board-store README](../../apps/frontend/src/domains/games/board-store/README.md).

---

## The Problem

The gameplay page used Zustand for all board state. This worked at small scale but broke down:

1. **Stack overflow** — "Maximum call stack size exceeded" from cross-store subscription chains. `gameplayPageStore.subscribe(syncGame)` triggered synchronous `set()` inside a subscriber, creating re-entrancy.

2. **`Object.is` brittleness** — Zustand uses `Object.is` for change detection. Selectors returning new objects (`{ top, left }`), Sets, or Maps triggered re-renders on every notification even when values were unchanged.

3. **Bulk synchronous `set()`** — `tileOrchestrator.updateTileSquares()` called `set()` on 400+ individual per-tile stores in a loop. Each `set()` triggered its own notification cycle.

4. **Stale module-level extraction** — Actions like `setSelectedTileV2` extracted at module level via `getState()` could go stale after store resets.

5. **Scattered derivation logic** — Visibility, selection, borders, queued directions all computed in different places (selectors, hooks, components) with no single "compute the frame" path.

**What the replacement needed:** Framework-agnostic state layer. One path for all updates. Per-tile granular notifications without per-tile stores. Cheap diffing to avoid unnecessary re-renders.

---

## Design Evolution

### V1: Class-Based BoardStore (March 1)

First design doc ([3-01-[9]](3-01-[9]-board-store-design-doc.md)). Single `BoardStore` class with three state buckets (source, UI, derived), a frame array updated in place, and per-tile subscriptions.

This was implemented and tested (40 tests passing), but it tangled concerns: generic reactive plumbing, domain mutations, the compute pipeline, and per-key tile subscriptions all lived in one class.

### V2 Design Doc 1: createStore + KeyedStore (March 9)

Extracted a generic `createStore` primitive and a `KeyedStore<V>` abstraction for per-key subscriptions/caching. Clean separation, but `KeyedStore` was a speculative abstraction — tiles were the only consumer.

### V2 Design Doc 2: Selector-Based Subscriptions (March 9)

Different approach: each subscriber declares a selector (what slice it cares about) and an equality function. The lib runs all selectors after every mutation and notifies those whose values changed.

**Rejected because:** Distributes tile computation across 400+ independent selectors. Can't add dirty-region skipping or spatial culling when each subscriber runs in isolation. Harder to debug (no single place to see "what happened this tick").

### V2 Design Doc 3: createStore + Centralized Pipeline (March 9) — **Chosen**

Final design ([3-09-[4]](3-09-[4]-board-store-v2-design-doc-3.md)). Generic `createStore` primitive (~30 lines) owns the mutation lifecycle. Board-specific `createBoardStore` factory owns tiles, caching, and a centralized `runPipeline` that iterates all tiles, diffs, and notifies.

**Why this won:** Centralized control over the tile iteration enables future optimizations as additive changes — no rearchitecting:
- **Dirty regions** — only recompute tiles affected by the mutation
- **Spatial culling** — skip tiles outside the viewport on large maps
- **Direct buffer output** — write to canvas/WebGL instead of TileData objects

---

## Key Decisions

### In-place mutation (not immutable)

State is mutated in place by pure action functions. The diff function (`tilesEqual`) determines what actually changed. This avoids `Object.is` brittleness entirely — we never rely on reference equality for change detection.

Tradeoff: no cheap "did anything change?" check at the state level. Every action runs the full pipeline even for no-ops. The tile diff catches it, and at current scale (400 tiles, ~1 tick/sec) this is fine.

### Centralized pipeline over distributed selectors

One `runPipeline` function iterates all tiles after every action. Each tile is computed, diffed against cache, and only changed tiles notify their subscribers.

Alternative (Design Doc 2) had each subscriber own its own selector. Rejected because centralized iteration is the thing that makes dirty regions, spatial culling, and direct buffer output possible.

### Per-tile diffing via snapshot cache

`tileCache: Map<string, TileData>` stores the last-computed value for each tile. `getTileData(coord)` returns the cached object — same reference if unchanged. This is critical for `useSyncExternalStore`: if `getSnapshot` returns a new object when nothing changed, React detects a "change" and re-renders, creating an infinite loop.

`tilesEqual` does field-by-field comparison of all 16 TileData fields. All fields are primitives (numbers, booleans, enums), so this is fast.

### `derive` as a lib concept

The generic store owns the derive lifecycle: after every mutation, `derive(state)` runs before `onChange` fires. This enforces ordering without the caller having to manage it.

Currently computes visibility (fog of war) and the queued moves map. It's a thin abstraction and could have been dropped, but having the lib own this guarantees derived state is always fresh when the pipeline runs.

### Version counter for board-level snapshots

`useBoardState` uses `store.version` as the `useSyncExternalStore` snapshot. Technically the snapshot should be the data itself for full tearing protection, but since actions are synchronous and don't run mid-render, this works in practice. Fallback if issues appear: shallow-copy the state container.

### No generic per-key abstraction

Tiles are the only consumer of per-key subscriptions. Direct `Map<string, TileData>` cache + `Map<string, Set<() => void>>` subscriber map do the job without an abstraction layer. If a second per-key use case appears (per-player stats, per-territory aggregates), we can extract a shared abstraction then.

### Module singleton with factory escape hatch

`index.ts` creates a single `boardStore` instance and exports wrapped actions. But `createBoardStore` is also exported — multiple instances are possible for testing or future multi-board scenarios.

---

## What's Deferred / Not Needed

- **Integration into app pages** — gameplay, sandbox, puzzles still use old Zustand stores
- **Old store removal** — can coexist during transition, remove after integration is stable
- **Action batching** — calling multiple actions runs the pipeline after each one. A `batch()` wrapper could defer pipeline to the end. Not needed yet since most interactions are single-action.
- **Dirty regions** — `setSelectedTile` affects ~5 tiles but recomputes all 400. Additive optimization: snapshot affected coords, only iterate those.
- **Spatial culling** — for large scrollable maps, skip tiles outside viewport
- **Non-React rendering** — store and pipeline have no React dependency; canvas/WebGL can subscribe directly
- **Timeline manipulation** — sandbox/replay need `jumpToTick`, stepping backward; `applyTick` + `reset` cover the basics but timeline engine integration is future work
- **Re-entrancy guard** — if a subscriber calls an action during `runLifecycle`, it would recurse. TODO in code.

---

## Related Docs

- **[Board-store README](../../apps/frontend/src/domains/games/board-store/README.md)** — API reference, file map, type glossary
- **[3-01-[9] Design Doc (v1)](3-01-[9]-board-store-design-doc.md)** — original class-based design
- **[3-09-[4] Design Doc 3](3-09-[4]-board-store-v2-design-doc-3.md)** — final chosen design (most detailed)
- **[3-09-[5] Implementation Plan](3-09-[5]-board-store-v2-implementation-plan.md)** — TDD approach, step-by-step plan
