# Review Session: BoardStore Design Doc

## Context

We just finished a deep design session for replacing Zustand-based game state management in the frontend with a framework-agnostic plain JS state layer called `BoardStore`. The design doc is at:

**`dev-notes/2026-03/3-01-[9]-board-store-design-doc.md`**

Supporting context docs (read these too):
- `dev-notes/2026-03/3-01-[8]-game-state-refactor-design-decisions.md` — high-level design decisions and rationale
- `dev-notes/2026-03/3-01-[6]-game-state-research-compilation.md` — compilation of all prior notes/brainstorming on this topic going back to Aug 2025
- `dev-notes/2026-03/3-01-[7]-current-game-state-code-survey.md` — full survey of current frontend game state code (what exists today)
- `dev-notes/2026-03/3-01-[4]-game-state-refactor-notes.md` — the trigger: documents the Zustand brittleness and stack overflow crash

Also read the existing board session store that this replaces:
- `apps/frontend/src/domains/games/stores/board-session-store.ts`

And the current tile system it replaces:
- `apps/frontend/src/domains/games/stores/tile-store-registry.ts`
- `apps/frontend/src/domains/games/stores/tile-orchestrator.ts`
- `apps/frontend/src/domains/games/hooks/use-tile-store-state.ts`

And the current gameplay store (the most complex consumer):
- `apps/frontend/src/domains/gameplay/stores/gameplay-store-v2.ts`

And the pure rendering component (stays mostly unchanged):
- `apps/frontend/src/domains/gameplay/ui/tile-renderer.tsx`

## Task

Do a detailed critical review of the design doc (`3-01-[9]-board-store-design-doc.md`). Read all the context docs and current code listed above first.

Look for:
1. **Gaps** — anything the design doesn't address that the current system handles (edge cases, state that's missing, flows that aren't covered)
2. **Inconsistencies** — places where the design contradicts itself or doesn't fit with the existing codebase
3. **Risks** — things that could go wrong, performance concerns, migration hazards
4. **Open questions** — decisions that were deferred but might need answers before implementation
5. **Simplification opportunities** — anything that's over-designed or could be simpler
6. **Missing details** — areas that need more specificity before someone could implement from this doc

Key goals of the refactor to evaluate against:
- Decouple state management from React (enable future canvas/WebGL renderer)
- Eliminate Zustand brittleness (Object.is, cross-store subscriptions, bulk set() calls)
- Keep per-tile granular re-renders
- Work across all board modes: gameplay, puzzles, sandbox, replay, game-ui-lab
- Simple, predictable data flow

Be thorough and critical. Flag anything that feels wrong, unclear, or under-specified. We want to catch issues before implementation, not during.
