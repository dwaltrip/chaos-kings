# Session Prompt: Cross-Domain Cleanup & Architecture Review

## Context

Board-store integration is complete across all three domains. Read these docs:

1. **`3-10-[4]-board-store-all-domains-integrated.md`** — Full picture: per-domain findings, confirmed patterns, cleanup TODO list
2. **`3-09-[9]-board-store-integration-survey.md`** — Action-by-action mappings and cross-domain patterns (the "before" picture that complements [4]'s "after")
3. **`apps/frontend/src/domains/games/board-store/README.md`** — Board-store API reference. Relevant for the "where do rendering concerns belong" question.
4. **`docs/architecture.md`** — Overall architecture guide. Relevant for Part 3 domain organization discussion. Note: last substantive update was Nov/Dec 2025 — predates board-store, the puzzles/sandbox domains, and much of the current frontend structure. May need updating as part of this work or as a follow-up.

Also skim the current state of all three domains' actions and tile components to see the duplication firsthand.

## Part 1: Manual Test

Before any refactoring, manually test gameplay in the browser. Focus on:
- Basic tile selection and movement
- Keyboard repeat performance (hold arrow key — should feel responsive at ~50ms)
- Undo/cancel moves
- Game end state (all tiles visible, nothing selectable)

If anything feels off, debug before proceeding.

## Part 2: Concrete Cleanups

These are confirmed ready — review the code, then implement:

### Shared tile component
PuzzleTile, SandboxTile, GameTile are identical. Collapse into one shared memoized component. Decide where it lives.

### Shared `queueMove`
Three identical functions differing only in the WS send call. Extract to shared location with send function as parameter.

## Part 3: Broader Architecture Discussion

The board-store migration revealed that the three board-based domains (puzzles, sandbox, gameplay) share a lot more than expected. Now that the dust has settled, step back and think about the bigger picture:

### Where do shared board concerns live?
`board-store/` currently contains both state management (`actions.ts`, `derived.ts`) and rendering (`toTileRendererProps`, `BoardTile`, `TileRenderer`). These are different layers. What's the right organization?

### WS effects: shared or per-domain?
`sendMoveRequest`, `sendUndoMove`, `sendCancelMoves` exist in all three domains. Are the underlying protocol messages the same or different? If same shape, should they be shared? What's the right boundary between domain-specific and shared WS concerns?

### Actions: how much sharing is too much?
`queueMove` is identical. `undoMove` and `clearMoves` are nearly identical (some domains are WS-only, gameplay has optimistic local updates). Tick handlers are all `applyTick()` + domain setters. Where's the line between useful dedup and premature abstraction?

### Domain stores after migration
All three domain stores shrank significantly. Are they still pulling their weight? Could any be replaced with simpler patterns (context, module-level state, etc.)?

### The `games/` shared layer
`games/` currently has `board-store/` and some leftover types. Is this the right home for shared board UI, shared actions, shared ws-effects? Or does the growing shared layer suggest a different organization?

Surface trade-offs and discuss before implementing. The goal is a coherent architecture, not just less duplication.
