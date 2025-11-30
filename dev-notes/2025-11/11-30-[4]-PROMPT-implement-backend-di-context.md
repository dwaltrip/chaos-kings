# Context Injection Implementation

  Please implement the AsyncLocalStorage context pattern as documented in:
  `dev-notes/2025-11/11-30-[3]-context-injection-implementation-plan.md`

  ## Background
  During a repository refactor, I discovered test isolation issues. The current `dbInstance?` parameter approach is incomplete and broken. We're migrating
  to AsyncLocalStorage-based context injection where repositories call `getContext()` internally, keeping app code clean.

  ## Key Principles
  1. **Repositories get context internally** - app code just imports and uses them
  2. **ws-lib must stay generic** - NO imports from `@/context/*`
  3. **Follow the phase order** in the doc - commit after each phase
  4. **Run builds + tests** after each phase

  ## Critical Naming Decisions
  - `AppHandlerContext` → `ConnectionContext` (connection-scoped)
  - `AppContext` with aliases: `RequestContext`, `MessageHandlerContext` (handler-scoped)
  - ws-lib: `createContext` → `createConnectionContext`, add `setupHandlerContext`

  ## Start Here
  Phase 1: Create `src/context/app-context.ts` with AsyncLocalStorage
  Phase 2: Migrate one repository as proof-of-concept (user-repository)

  Read the full doc first, ask questions if anything is unclear, then execute phase by phase.
