# Puzzles Spike 2 - Work Ranked by Ambiguity

**Date:** 2026-01-11
**Related:** `1-11-[4]-puzzles-spike-2-planning.md`

This document ranks the implementation work from most straightforward to most uncertain, to help guide implementation order and identify where more thinking/investigation is needed.

---

## Tier 1: Straightforward / Well-Defined

These items have clear requirements and established patterns.

1. **@core/puzzles/best-start types** - `BestStartConfig`, `BestStartResult` - well-defined in planning doc

2. **`isBestStartComplete()`** - Simple: `tick >= config.timing.armyProductionTicks`

3. **`scoreBestStart()`** - Count land/army for player 0, clear logic

4. **Frontend puzzle-store** - Simple state shape, well-defined in planning doc

5. **Frontend handlers** - Thin routers, established pattern from gameplay

6. **Frontend pure actions** - Clear split: outbound (send WS) vs inbound (update store)

7. **Backend handlers** - Thin routers, existing stubs to fill in

8. **Backend ws-effects** - Established pattern, clear messages to send

---

## Tier 2: Some Details TBD

These items have clear structure but some implementation details to figure out.

9. **`createBestStartPuzzle()`** - Mostly clear, but:
   - Blank map vs procedural generation?
   - General placement (center vs configurable)?

10. **PuzzleManager class** - Structure clear from planning doc, but:
    - Timer management details
    - Tick loop edge cases
    - Error handling

11. **`isMoveValid()`** - New function to build. Questions:
    - What rules exactly? Bounds + ownership + direction?
    - Where does it live? `@core/puzzles/` or more general `@core/`?
    - Design for later reuse in GameServer refactor

12. **Backend actions layer** - Clear pattern, but edge cases:
    - What if user already has an active puzzle?
    - Cleanup on disconnect?
    - One puzzle at a time enforcement

---

## Tier 3: Needs Investigation / May Change

These items have significant unknowns or may evolve during implementation.

13. **Reusing GameBoard** - Needs investigation:
    - May be tightly coupled to gameplay stores
    - May have multiplayer/fog of war assumptions
    - Fallback: build simpler puzzle-specific board using TileRenderer

14. **Reusing other gameplay components** - Unknown coupling:
    - Queued move arrows visualization
    - Stats display (land/army counts)
    - Turn display
    - May need to extract or rebuild for puzzle context

15. **Frontend UI layout** - Sketched but flexible:
    - Board + stats panel layout may evolve
    - Design may change based on what looks/feels right
    - Start/results screens are simple, play screen has more unknowns

16. **Keyboard shortcuts** - Need to understand:
    - How existing undo/clear shortcuts are implemented
    - How to hook into puzzle context
    - May need to share or duplicate logic from gameplay

---

## Suggested Approach

1. **Start with Tier 1** - Build confidence, establish patterns
2. **Tackle Tier 2** - Fill in details as you go, make decisions
3. **Investigate Tier 3 early** - Don't leave UI investigation until the end; spike on GameBoard reuse early to know if you need an alternative
