# Session Prompt: Package.json + TypeScript Setup for V2 Architecture

  ## Context

  We're in Phase 1 of a major WebSocket architecture and monorepo refactor. We've just completed scaffolding three domains (chat,
  matchmaking, gameplay) following a new structure, but haven't set up the build/type-checking infrastructure yet.

  **Current State:**
  - ✅ Domain scaffolding complete: chat, matchmaking, gameplay
  - ✅ New files created in:
    - `packages/protocol/domains/{chat,matchmaking,gameplay}/`
    - `packages/platform/domains/{matchmaking,gameplay}/`
    - `apps/backend/src/domains/{chat,matchmaking,gameplay}/`
    - `apps/frontend/src/domains/{chat,matchmaking,gameplay}/`
  - ❌ No package.json or TypeScript configs for new structure
  - ❌ Type-checking not yet working for new v2 code
  - ⚠️ Existing v1 code still needs to work (in `backend/src/`, `frontend/src/`)

  **New Architecture:**
  /packages
    /protocol      # Wire DTOs, message types (depends only on kernel)
    /platform      # Shared domain constants/helpers
    /kernel        # Minimal primitives (future)
    /utils         # Generic helpers (future)
    /core          # Pure game logic (exists, not yet moved)

  /apps
    /backend       # Server: handlers, actions, ws-effects
    /frontend      # Client: handlers, actions, stores

  **Import Conventions (from AGENTS.md):**
  - New code uses path aliases: `@protocol`, `@platform`, `@core`, `@utils`, `@kernel`
  - Apps use `@/` for local imports (e.g., `@/domains/chat/actions`)
  - Import order: third-party → shared packages → app code

  ## Goals

  1. Set up package.json files for new packages and apps (if needed)
  2. Configure TypeScript to type-check new v2 code
  3. Verify all imports resolve correctly
  4. Maintain existing v1 build/type-checking (don't break anything)
  5. Document the setup for future reference

  ## Approach

  **Let's discuss each question/decision one by one before implementing.** I want to understand the existing setup first, then make
  incremental changes.

  ## Key Questions to Discuss

  ### 1. Existing Setup
  - What's the current monorepo structure? (workspaces, turborepo, nx, lerna, or just plain npm?)
  - Check root `package.json` - is there already workspace configuration?
  - What TypeScript configs exist? (root tsconfig.json, per-app configs?)
  - Are path aliases (`@protocol`, `@core`, etc.) already configured somewhere?
  - What's the current build process? (scripts in package.json)

  ### 2. Package Structure
  - Should each package in `packages/` have its own package.json?
  - Or should we rely on root package.json + TypeScript path aliases?
  - Do packages need to declare dependencies individually or share from root?

  ### 3. TypeScript Configuration
  - Do we need separate tsconfig.json files for:
    - Each package in `packages/`?
    - Each app in `apps/`?
    - Or can we extend a base config?
  - How to configure path aliases to match our import conventions?
  - Should v1 and v2 code share the same tsconfig or be separate?

  ### 4. Type-Checking Strategy
  - Should we type-check:
    - Only new v2 code?
    - All code (v1 + v2)?
    - Separate commands for each?
  - What npm script should run type-checks? (new or extend existing?)
  - Should type-checking be part of pre-commit hooks?

  ### 5. Build Strategy
  - Do packages need build outputs, or just type-checking?
  - If they need builds, where should outputs go?
  - How does this integrate with existing v1 build process?
  - Should we use TypeScript project references for incremental builds?

  ### 6. Dependencies
  - What dependencies do the new packages actually need?
    - `packages/protocol` - probably just TypeScript + type imports from `@core`, `@kernel`
    - `packages/platform` - minimal, maybe none
    - Apps already have dependencies in their existing package.json files?

  ## Files to Explore First

  **Root:**
  - `package.json`
  - `tsconfig.json`

  **Apps:**
  - `apps/backend/package.json` (or `backend/package.json`?)
  - `apps/backend/tsconfig.json` (or `backend/tsconfig.json`?)
  - `apps/frontend/package.json` (or `frontend/package.json`?)
  - `apps/frontend/tsconfig.json` (or `frontend/tsconfig.json`?)

  **Existing:**
  - Any existing build scripts or configs
  - Check if path aliases are already working in the codebase

  ## Success Criteria

  By the end of this session:
  - [ ] Can run a command to type-check new v2 code (e.g., `npm run type-check:v2`)
  - [ ] All imports in new domain files resolve correctly (no TypeScript errors)
  - [ ] Path aliases work: `@protocol`, `@platform`, `@core`, `@utils`, `@kernel`, `@/`
  - [ ] Existing v1 build and type-checking still works
  - [ ] Clear documentation of the setup (what we did and why)
  - [ ] Decisions documented in refactor docs if needed

  ## Additional Context

  **Import/Export Patterns (from AGENTS.md):**
  - All exports at end of files using named export syntax
  - Import order: third-party → shared packages (@utils → @protocol → @platform) → app code
  - Files use kebab-case naming

  **Refactor Strategy:**
  - "Leaves first" approach - build from edges inward
  - Keep v1 code working throughout the refactor
  - Incremental, coherent progression

  **Pre-existing Infrastructure:**
  - Pre-commit hooks exist (prettier runs on commit)
  - TypeScript is already in use (files are .ts/.tsx)
  - Some build process already exists for v1 code

  ## References

  - **Refactor Strategy:** `epics/2025-10/1-refactor-ws-arch-and-monorepo-structure/[STRATEGY-AND-TRACKER].md`
  - **Architecture Docs:** `dev-notes/2025-10/10-12-[1]-monorepo-folder-structure-v2.md`
  - **Import Conventions:** `AGENTS.md`
  - **New Domain Files:**
    - Backend: `apps/backend/src/domains/{chat,matchmaking,gameplay}/`
    - Frontend: `apps/frontend/src/domains/{chat,matchmaking,gameplay}/`
    - Protocol: `packages/protocol/domains/{chat,matchmaking,gameplay}/`
    - Platform: `packages/platform/domains/{matchmaking,gameplay}/`

  ## How to Proceed

  1. **Explore existing setup** - Answer questions in section "1. Existing Setup"
  2. **Discuss each decision** - Go through questions 2-6 one by one, make decisions
  3. **Propose minimal changes** - Show what files need to be created/modified
  4. **Implement incrementally** - Make changes, test that imports resolve
  5. **Verify** - Run type-checks, ensure nothing broke
  6. **Document** - Update docs with any decisions or new conventions

  Let's start with exploring the existing setup. Can you check the root package.json and tsconfig files?
