# Puzzles Spike 2 - Work Ranked by Ambiguity

**Date:** 2026-01-11
**Updated:** 2026-01-11 (post-review)
**Related:** `1-11-[4]-puzzles-spike-2-planning.md`

This document ranks the implementation work from most straightforward to most uncertain, to help guide implementation order and identify where more thinking/investigation is needed.

---

## Key Findings from Review

Before implementation, we reviewed the planning doc against actual code. Key findings:

1. **`validateMove()` already exists** at `@core/moves/validate-move.ts` - no need to build
2. **Timing values:** Default config has `armyProductionTicks: 50` (not 25). 50 ticks = 25 turns.
3. **Component reuse decided:** Build puzzle-specific `PuzzleTile`/`PuzzleBoard` using `TileRenderer`
4. **Protocol needs fixes:** Server messages missing fields, using `any` types

---

## Tier 1: Straightforward / Well-Defined

These items have clear requirements and established patterns.

1. **@core/puzzles/best-start types** - `BestStartConfig`, `BestStartResult` - well-defined in planning doc

2. **`isBestStartComplete()`** - Simple: `tick >= config.timing.armyProductionTicks` (50 for default)

3. **`scoreBestStart()`** - Count land/army for player 0, clear logic

4. **Frontend puzzle-store** - Simple state shape, well-defined in planning doc

5. **Frontend handlers** - Thin routers, established pattern from gameplay

6. **Frontend pure actions** - Clear split: outbound (send WS) vs inbound (update store)

7. **Backend handlers** - Thin routers, existing stubs to fill in

8. **Backend ws-effects** - Established pattern, clear messages to send

9. **Protocol fixes** - Add `tick`, `moveQueue` to state-update; add `result` to end-puzzle; fix `any` types

---

## Tier 2: Some Details TBD

These items have clear structure but some implementation details to figure out.

10. **`createBestStartPuzzle()`** - Mostly clear:
    - PoC: Blank 21x21 map with centered general (already exists in spike code)
    - Future: Procedural generation with config

11. **PuzzleManager class** - Structure clear from planning doc:
    - Timer management (start/stop on lifecycle)
    - PoC error handling: Just clean up on errors
    - Edge cases decided: One puzzle per user, cleanup on navigate away

12. **Backend actions layer** - Clear pattern, edge cases decided:
    - User already has puzzle → Replace with new one
    - Cleanup on disconnect → Stop and remove puzzle
    - Add TODOs for multi-tab considerations

13. **`PuzzleTile` / `PuzzleBoard` components** - Decision made:
    - Build puzzle-specific components using `TileRenderer`
    - Wire to puzzle store (not gameplay store)
    - Attempt fog of war, defer if complex

---

## Tier 3: May Change During Implementation

These items may evolve based on what works in practice.

14. **Fog of war implementation** - Attempt to reuse visibility logic:
    - Core has `Board.getVisibleSquares()` - reusable
    - Frontend hooks are gameplay-coupled - may need puzzle versions
    - Decision: Attempt, defer if too complex

15. **Frontend UI layout** - Sketched but flexible:
    - Board + stats panel layout may evolve
    - Start/results screens are simple
    - Design may change based on what looks/feels right

16. **Keyboard shortcuts** - Need to understand:
    - How existing undo/clear shortcuts are implemented
    - How to hook into puzzle context
    - May need to share or duplicate logic from gameplay

---

## Suggested Implementation Order

Based on review findings:

1. **Protocol fixes** - Fix server message types first (unblocks both FE and BE)
2. **@core/puzzles/best-start** - Types, create, is-complete, score
3. **Backend PuzzleManager** - Tick loop, move queue, lifecycle
4. **Backend handlers + actions** - Wire stubs to PuzzleManager
5. **Backend ws-effects** - Broadcast state updates
6. **Frontend puzzle-store** - State management
7. **Frontend handlers + actions** - Process incoming messages
8. **Frontend PuzzleTile/PuzzleBoard** - Puzzle-specific components
9. **Frontend page updates** - Wire page to store, remove gameplay store usage

---

## What Already Exists (Don't Rebuild)

- `validateMove()` in `@core/moves/validate-move.ts`
- `buildPuzzleRoomId()` in backend puzzles utils
- Frontend `ws-effects.ts` with all 4 outbound messages
- Frontend pages (need updates, not rebuilds)
- Backend handler stubs (need implementation, not restructuring)
