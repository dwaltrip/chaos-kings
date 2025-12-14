# Open Questions - Resolved

This document archives questions from `open-questions.md` that have been resolved.

---

## UI Organization (Resolved Dec 2025)

### Pages vs Domains - Component Placement

**Original questions:**
1. When should domain-specific UI move to domains/ vs stay in pages/?
2. How to handle page-specific variations of domain components?
3. When does page-coupled logic belong in pages/ vs domains/?

**Example ambiguities:**
- Should `GameBoard` live in `domains/gameplay/` or `pages/game/`?
- Should `MatchmakingQueue` UI live in `domains/matchmaking/` or `pages/lobby/`?

**Resolution:** Domains own their full vertical slice, including pages. No top-level `src/pages/` directory.

**Key rules:**
- Pages live in `domains/*/pages/`
- Page-specific components are siblings to the page file
- Reusable UI goes in `domains/*/ui/` (promote when second consumer appears)
- Generic UI (no business logic) goes in `src/ui/`

**See:** docs/frontend-component-organization.md
