# BoardStore v2 — Implementation Session Prompt

## Task

Refactor the BoardStore from a monolithic class into `createStore` (generic primitive) + `createBoardStore` (factory with centralized tile pipeline). TDD approach: write tests first, then implement.

## Key Documents (read all before starting)

- **Design doc:** `dev-notes/2026-03/3-09-[4]-board-store-v2-design-doc-3.md`
- **Implementation plan:** `dev-notes/2026-03/3-09-[5]-board-store-v2-implementation-plan.md`
- **Current code:** `apps/frontend/src/domains/games/board-store/` (all files)

**Note:** The design doc was written first and is stale on several points. The implementation plan and this prompt supersede it. In particular: the design doc says `derive` is NOT in `createStore`, shows `onChange(state)` with one param, and uses `BoardState` as the wrapper type name. All three were changed — see Decisions below.

## Decisions Made

- **Naming:** The new top-level state type is `BoardStoreState` (not `BoardState` — that name is taken by `@core/types`). TODO comment noting we should tighten up these type names later.
- **`derive` is a `createStore` concept.** `createStore<State, Derived>` takes a `derive: (state: State) => Derived` config option. The lib guarantees: mutate → derive → onChange(merged) → version++ → notify. `store.derived` is a first-class accessor. This keeps `runPipeline` (onChange) simpler — it receives derived state, doesn't compute it.
- **`onChange` receives a merged `State & Derived` object.** One object to pass around instead of two separate params. A dev-mode helper warns if derived keys collide with state keys.
- **No frame array.** `tileCache` Map is the only tile storage.
- **`reset` keeps board-level subscribers** (notifies them), clears tile subscribers. Existing "reset clears all subscribers" test should be updated to reflect this.
- **Version counter** as `useSyncExternalStore` snapshot. Add NOTE comment about shallow-copy fallback.
- **`FrameDiff` return values removed.** No method/action returns anything.
- **`onReset` stays in `createStore`** — runs before `onChange` so tile caches clear before pipeline rebuilds.
- **Re-entrancy guard on `runPipeline`:** don't build yet, add a comment noting the risk.

## Approach: TDD

**Phase 0 — Write failing tests first, and update existing tests.** Use an Opus sub-agent to very carefully implement the test changes.

**Phase 1 — Implement until tests go green.** Build everything at once (not step-by-step), using the implementation plan as a guide for what files to create/modify.

**Phase 2 — Build check + cleanup.**
- `npm run build` in frontend
- `npm test` in frontend
- Delete `frame-computation.ts`
- Verify file structure matches design doc

## Code Comments

Add the NOTE comments listed in the implementation plan's "Code Comments / NOTEs" section. They document design decisions and future hooks (batching, version counter fallback, reset behavior, tile caching rationale, pipeline optimization paths).
