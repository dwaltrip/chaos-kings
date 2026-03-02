# Game State Refactor — Design Decisions

High-level architecture decisions for replacing Zustand-based game state management with a framework-agnostic plain JS state layer.

---

## Core Concept

The state layer produces "here's what each tile looks like right now" as plain data. The renderer just receives that data and draws it. Diffing happens in between.

```
tick arrives (or user input like selection change)
  → core state updates (plain JS, no framework)
  → derive per-tile render data (plain JS)
  → diff against previous per-tile data (plain JS)
  → only push changed tiles to the renderer
```

---

## Decisions Made

### Three buckets of core state
1. **Board-level** — `BoardState`, tick number, isEnded, players/metadata
2. **Tile-level** — per-tile `Square` data (type, army count, player index), queued directions
3. **UI-level** — selectedTile, and things derived from it (adjacency, valid moves)

### Centralized derived data computation
One function (or small set of functions) that takes core state and produces the full "frame" — a `TileRenderData` for every tile. All derivation logic lives in one place, easy to test in isolation.

### Per-tile diffing (Option A)
The state layer diffs tile render data per-tile and only pushes changed tiles to the renderer. This gives precise control over what re-renders — important for a future canvas renderer where there's no React.memo. Tile data is a small flat struct so diffing is cheap.

### One path for everything
Tick updates and UI changes (selection, etc.) go through the same compute-then-diff flow. No special fast paths. Keep it simple and explicit — all data flow and dependencies clearly laid out. Optimize later if needed.

### Optimistic queued moves
Just works naturally — update `queuedMoves` in core state on user input, recompute tile data, diff, push. Server tick overwrites `queuedMoves` with canonical version, recompute, diff, push. No dual-write needed.

### Single consumer for now, multi-consumer ready
Design the interface so it's possible to have multiple consumers (React, canvas, debug tools) subscribing to the same frame output. But don't build multi-consumer machinery until there's a second consumer. Leave a code comment noting where consumers could subscribe.

### Rendering is pure / declarative
Rendering code receives tile render data and draws it. No logic about "should I re-render?" in the renderer — that decision is made by the state layer's diffing.

### Framework-agnostic
All state management, derivation, and diffing logic is plain JS/TS with zero React or framework dependencies. The React bridge is a thin adapter at the edge.

---

## Deferred / Punt for Now

### Tick batching / rAF
Not worth solving now. Game tick rate is ~0.5-1s so back-to-back ticks are rare. React 18+ batches within microtasks anyway. If we move to canvas, rAF batching would matter more. Leave a code comment about this.

### Timeline manipulation (two flavors)
Some board sessions just receive ticks from the server (gameplay). Others need `jumpToTick`, stepping backward, checkpoints (sandbox, replay, puzzles). `TimelineEngine` in `@core` handles the latter. The state layer interface should support both "push a new tick" and "I jumped to tick N, here's the full state" — but don't over-design for this yet.

### Performance optimizations
Compute all tile render data every tick. Optimize later. There are probably easy wins (e.g. only recompute visibility when board changes, not on selection change) but start simple.

---

## What's Next

Sketch out the actual interfaces and data shapes:
- `TileRenderData` struct
- Core state shape
- The "compute frame" function signature
- The diffing mechanism
- The React bridge / hook API
