**Fresh Session Prompt (Flexible, Judgment-Driven)**

- Context: Continue replay MVP follow-ups for Generals v2 (prototype).
- Primary reference: `dev-notes/2025-09-18-replay-review-analysis.md` (“Detailed
 Execution Plan (Prioritized)”).
- Supporting context: `dev-notes/2025-09-18-replay-mvp.md`, `dev-notes/2025-09-18-replay-follow-ups.md`.

**Approach**
- Docs are guidance, not gospel: follow the plan unless you identify a better path. When deviating, state the rationale briefly. After implementing, concisely inform user of non-trivial deviations along with your reasoning.
- Optimize for determinism, type safety, and maintainability with minimal, focused changes.
- Keep in mind we are still prototyping! Be careful not to over-engineer.

**Constraints**
- Naming: use “step” terminology; do not introduce new “tick” names.
- Types: avoid `any`; centralize shared types where the plan calls for it.
- Import order: third-party → `@common/...` → `@core/...` → local `@/...`.
- Style: kebab-case filenames, 2-space indentation, exports at bottom.
- Engine versioning: do not add; a TODO comment is acceptable.
- Moving towards all game-specifc logic and types stored in `@core`, with `@common` for generic shared code. All new code should adhere to this.
  - Update AGENTS.md and CLAUDE.md to reflect this.

**Execution**
- Start with Phase 1 in the review doc. Implement exactly what’s needed; if you see a simpler/better sequence, adjust and provide a short note to the user aftwerwards.
- After each phase:
  - Run FE/BE builds and tests per repo scripts (e.g. `bash tools/build-all.sh`)
  - Post a concise progress update (what changed, why, build/test status).
  - Keep commits scoped to the phase with succinct messages.

**Acceptance Gates**
- Each phase must meet the acceptance criteria listed in the review doc (or your justified, updated criteria if you deviated).
- Preserve behavior where specified (e.g., move-history flush cadence), and ensure defaults keep current behavior (e.g., replayer optional bounds).

**Deliverables**
- Phase-by-phase code changes aligned with the plan (flexibly applied).
- Brief notes appended to `dev-notes/2025-09-18-replay-review-analysis.md` when deviating or clarifying acceptance criteria.
- Tests and small scripts called for in the plan, with green builds.

If ambiguity arises, prefer choices that improve determinism and type integrity, and document the decision briefly in the review doc before proceeding.
