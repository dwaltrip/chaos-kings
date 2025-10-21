# WebSocket Architecture & Monorepo Refactor - Strategy

## Doc Purpose
This doc owns the strategic vision and foundational decisions for the epic. It contains stable reference material: goals, architecture principles, key decisions, and the overall phase plan. For current status and active work tracking, see [PROGRESS].md.

## Overview

This is a major refactor of the Generals v2 codebase that fundamentally restructures both our WebSocket message architecture and our monorepo organization. The work began in October 2025 and represents a thoughtful evolution of patterns we've been developing, bringing clarity, consistency, and stronger type safety to the entire codebase.

We're moving from a monolithic structure where backend and frontend code lived in relatively flat directories (`backend/src/`, `frontend/src/`) to a clean layered architecture with explicit boundaries between protocol definitions, shared domain logic, and application-specific code. The new structure makes it dramatically easier to understand where different types of code belong, how the pieces fit together, and how to extend the system as we add new features and domains.

This refactor is as much about establishing clear, consistent patterns as it is about the specific technical improvements. We're creating an architecture that's not just functional, but coherent and navigable - both for human developers and AI coding assistants working with the codebase.

### What

The new structure introduces:

**`packages/`** - Shared, pure code with no I/O or app-specific concerns:
- `protocol/` - Wire message types, DTOs, schemas (depends only on kernel)
- `core/` - Pure game domain logic, rules, mechanics
- `kernel/` - Minimal primitives (branded IDs, timestamps, etc.)
- `utils/` - Generic helper functions

**`apps/`** - Application-specific code:
- `backend/` - Server adapters: handlers, actions, persistence, WS server
- `frontend/` - Client adapters: hooks, stores, components, WS client
- Both apps have `domains/` subfolders in their `src` directory, organizing code by business domain (chat, matchmaking, gameplay, etc.)

### Why

**[WIP - Will expand and refine this section]**

The current v1 architecture works but has room for improvement:

**Clarity & Consistency:**
- Patterns are somewhat messy/inconsistent across the codebase
- Not always clear where code belongs or how to extend existing patterns
- Could be crisper and more explicit about boundaries and responsibilities

**Type Safety:**

- WebSocket messages could have stronger compile-time safety
- Payload types could be more rigorously defined
- Would benefit from discriminated unions and better type inference

**Separation of Concerns:**
- Transport and domain logic could be more cleanly separated
- Want clearer boundaries between protocol (wire) and domain (business logic)
- Handlers and actions could have more explicit, consistent responsibilities

**AI-Friendly Architecture:**
- Super crisp, clear patterns that are very consistent make it easier for AI agents to navigate and understand the codebase
- Loose coupling and strong typing help AI tools suggest correct changes
- Expressive, extensible patterns allow AI assistants to more confidently extend functionality
- Clear boundaries and conventions reduce ambiguity when AI is making modifications

**Scalability & Extensibility:**
- Want a very clear pattern for adding new message types
- Want a very clear pattern for adding new domains
- Monorepo structure can better support growth without cluttering project root

### When
- **Started:** October 2025
- **Status:** See [PROGRESS].md for current status

### Scope
This refactor touches:
- WebSocket message type system (both client→server and server→client)
- Backend domain organization and message handling
- Frontend domain organization and message handling
- Monorepo structure (packages/ and apps/)
- Core game logic organization
- Shared utilities and types (cleaning up common/ vs core/ confusion)

### Approach
We're using a **"leaves first"** strategy - building from the edges inward:

1. **Start with the wire** - Define protocol messages (type-safe, discriminated unions)
2. **Build thin adapters** - Create handlers, actions (stubbed), ws-effects for each domain
3. **Implement infrastructure** - WS bridges, client, server (adapted from demo repo)
4. **Migrate business logic** - Move actual domain logic into actions, services
5. **Clean up** - Remove old code, polish types, finalize structure

This incremental approach keeps the codebase coherent at each step and provides clear next actions throughout the refactor.

---

## Foundational Architecture

**These docs define the target architecture and patterns:**

- [Monorepo Folder Structure](../../../dev-notes/2025-10/10-12-[1]-monorepo-folder-structure-v2.md) - packages/, apps/ structure & dependency rules
- [WebSocket Architecture Patterns](../../../dev-notes/2025-10/10-12-[2]-project-arch-massive-refactor.md) - Message types, handlers, actions, ws-effects

*Note:* The linked folder-structure doc still reflects the earlier plan with an active `packages/platform`. The current execution defers those extractions; rely on [PROGRESS].md for the latest implementation decisions.

**Key Principles (Summary):**
- Protocol depends only on kernel
- Apps bridge protocol ↔ domain
- Type safety via discriminated unions
- Clear separation: handlers → actions → ws-effects

---

## Refactor Goals

*Note: These goals are evolving as we learn. Treating as a living document.*

### Architecture & Structure
- Very tight, crisp structure that is easy to follow and stay aligned with
- Should work well for many different domains (chat, matchmaking, gameplay, future domains)
- Clean monorepo structure - support more packages/apps without cluttering project root
- Properly clean up overlap/confusion between "common" and "core"

### Extensibility
- Easy to add new message types to existing domains
- Easy to add entirely new domains
- Pattern should scale without major rewrites

### Type Safety & Developer Experience
- Robust compile-time safety for all WS messages and payloads
- Ergonomic, lightweight patterns - easy to use and edit
- Isolate complex types in specific areas (message-helpers, ws-client/server)
- Keep most codebase simple and approachable

### Protocol & Transport Layer
- Define all message types/contracts (both directions) concisely in one place
- Easy to review protocol at a high level
- Clean separation between transport layers and domain logic

### Domain Logic Organization
- App "actions" are primary entry points and high-level owners for domain/biz logic
- I/O handlers, timers, services stay thin on domain logic - delegate to "app actions" or "packages/core"
- Clear boundaries and responsibilities

### Code Reuse
- Maximize code reuse between FE/BE where it makes sense (both TypeScript)
- NOTE: Still determining which patterns/utilities are best shared vs. kept separate.
  - In particular, the `platform` package described by the origainl architecture docs is in a highly uncertain state. We may not end up using using it much.


### Migration Approach
- Logical, incremental progression - maintain coherence throughout
- Clear next steps at all times (avoid getting lost mid-refactor)
- Proceed in thoughtful, systematic fashion

*Note: Testability is not an explicit goal but emerges naturally from loose coupling, simplicity, and coherent architecture.*

---

## Architecture Evolution

### Deviations & Adaptations

**[2025-10-13] Platform package - MOSTLY SKIP FOR NOW**
Skip `packages/platform` for now. Keep domain types local to `apps/backend` and `apps/frontend`. Will extract to `packages/platform` if/when we see duplication pain. Reasoning: Wait for the pain before adding abstraction. Easy to extract later, harder to undo premature abstraction.

**[2025-10-13] Actions are bidirectional**
Clarified that actions are the "hinge" - called by handlers (incoming messages) AND by app code (outgoing messages, timers, user interactions). This is a key architectural pattern that wasn't fully explicit in the original docs.

**[2025-10-13] File granularity**
One `actions.ts` per domain (BE + FE) for now. May split into one-action-per-file later if files get large or complex. Starting simple.

**[2025-10-13] Infrastructure staging**
Mock `wsBridge` initially in domain code. Will pull actual implementation from demo repo in later phase. Allows us to build domain structure without blocking on infrastructure.

---

## Phases (Highly Tentative / In Flux)

*Note: Phase 1 and 2 are relatively solid. Phases 3+ are more tentative and will evolve significantly as we learn and encounter new requirements. Consider this a rough roadmap, not a fixed plan.*

### Phase 1: Domain Structure ✅ COMPLETE (Oct 2025)

**Goal:** Create v2 ws-related files for each domain in apps/backend and apps/frontend.

**Protocol messages:**
- Created `client-messages.ts` and `server-messages.ts` for all domains in `packages/protocol`
- Domains covered: chat, matchmaking, gameplay

**For each domain:**
- **Backend:** `handlers.ts`, `actions.ts` (stubbed), `ws-effects.ts`, `types.ts`
- **Frontend:** `handlers.ts`, `actions.ts` (stubbed)

**Domains:**
- Chat - handlers, actions, ws-effects (BE + FE)
- Matchmaking - handlers, actions, ws-effects (BE + FE)
- Gameplay - handlers, actions, ws-effects (BE + FE)

**Completion:**
- All domain structures scaffolded (handlers, actions, ws-effects)
- Branded types (UserId, GameId, RoomId, ChatMessageId) implemented across all domains
- TypeScript infrastructure set up and passing typecheck

---

### Phase 2: WS Infrastructure

**Goal:** Implement the actual WebSocket infrastructure that domains will use.

- Implement wsBridge (backend + frontend)
- Implement WS server (backend)
- Implement WS client (frontend)
- We will adapt the working ws client and ws server from the demo repo, integrating with the existing v1 code where needed. This will require much careful thought.
- Wire up the mocked bridges in domain code

---

### Phase 3+: Migration & Integration (Will expand into multiple phases)

**Goal:** Migrate all v1 logic into v2 structure and make everything functional.

*Note: This will realistically be several distinct phases. Details TBD as we learn.*

- Migrate remaining v1 backend logic into v2 app structure
- Migrate remaining v1 frontend logic into v2 app structure
- Unstub all actions with real business logic
- Wire everything together end-to-end
- Test and validate all domains working

---

### Phase 4+: Core & Common Reorganization

**Goal:** Clean up package structure and move shared logic to proper locations.

- Migrate `/core` into `packages/core`
- Reorganize `/common` into appropriate locations (protocol, kernel, utils, etc.)
- Clean up core/common overlap and confusion
- Ensure dependency rules are followed (e.g., protocol only depends on kernel)

---

### Phase 5+: Cleanup & Polish

**Goal:** Remove old code, finalize types, polish the architecture.

- Remove old v1 code (backend/src, frontend/src)
- Final type cleanup
- Finalize branded types implementation (if not done earlier)
- Documentation polish
- Performance review

---

## Key Decisions & Learnings

### [2025-10-13] Architecture Q&A Session

**1. Platform package**
Wait for duplication before extracting. Keep types in apps/ for now. Backend and frontend "projections" of domain types will be mostly similar but with some differences (DB vs UI concerns). Don't want to over-engineer or create premature abstractions.

**2. Actions pattern**
Actions are the domain API - called by both handlers (incoming) and app code (outgoing). This bidirectional pattern is key to the architecture:
- **Incoming:** handler receives message → calls action → action does business logic
- **Outgoing:** app code (button click, timer, etc.) → calls action → calls ws-effects → sends message

**3. Implementation approach**
Reference old v1 code for functionality, but structure using new v2 patterns. We're recreating the behavior, not just moving files. Look at existing backend/frontend code to understand what needs to be implemented, then map it to the new structure.

**4. Pragmatic staging**
Mock infrastructure (wsBridge) initially. Stub actions. Fully implement thin routing layers (handlers, ws-effects, types). Build incrementally from the edges inward.

**5. Context simplicity**
Start with just `userId` in `HandlerContext`. Add domain-specific context only when clearly needed. Flag during implementation if more context is required.

**6. Testing strategy**
No tests during initial scaffolding. Keep tight and minimal. Focus on getting structure right first.

**7. File organization**
One `actions.ts` per domain for now (both BE and FE). Will refactor to one-action-per-file if files become unwieldy.

**8. Scope strategy**
Do one domain at a time. Matchmaking first, then gameplay. Get each domain fully structured before moving to the next. This maintains coherence and provides clear checkpoints.

**9. Branded types**
Use plain strings + TODO comments for now (following chat pattern). Will attempt branded types implementation at end of Phase 1 as an experiment.

**[2025-10-17] Branded Types Implementation**

Implemented branded ID types across all v2 domains (system, matchmaking, chat, and gameplay) with clear conversion boundaries:
- **Pattern:** Primitives at infrastructure edges, branded types in domain logic
- **Boundaries:** Handlers convert primitives → branded (entry), ws-effects convert branded → primitives (exit)
  - When migrating app code, will convert at other boundaries: I/O for DB, redis, etc

---

## Open Questions

**Branded types:**
- When/how to implement?
- Current status: Deferred - using plain strings with TODO comments
- Experiment planned for end of Phase 1

**Platform package:**
- What threshold of duplication triggers extraction?
- What patterns of divergence mean we shouldn't share?
- How to handle DB vs UI projection differences?

**Room identifiers:** Long-term pattern? (currently using constants like `MATCHMAKING_ROOM_ID`)

**Error handling:** Cross-domain pattern for communicating errors to clients?

**Domain-specific context:**
- Which domains will need more than `userId` in `HandlerContext`?
- When does it make sense to add domain-specific context vs keeping it in action parameters?

**Core/packages facade pattern:**
- For action-y/core logic type stuff (not helpers/utilities), should core methods be called directly or should it go through an "app action" as a facade?
- Would a facade make most app code more agnostic about core internals?
- What's the right balance between directness and indirection?

**Testing:**
- When to add tests?
- Unit tests for domain logic?
- Integration tests for WS flow?
- What level of test coverage is appropriate?

**Old v1 code lifecycle:**
- When to delete old code?
- Keep in parallel during entire migration?
- Delete incrementally as domains are migrated?

**Code reuse patterns:**
- Which utilities/helpers should be shared between FE/BE?
- When does duplication provide better clarity than sharing?
- How to handle similar-but-different patterns (e.g., validation on both sides)?

---

## References

### Architecture Docs
- [Monorepo Folder Structure](../../../dev-notes/2025-10/10-12-[1]-monorepo-folder-structure-v2.md)
- [WebSocket Architecture Patterns](../../../dev-notes/2025-10/10-12-[2]-project-arch-massive-refactor.md)

### Tactical Docs

**Phase 1 - Domain Structure:**
- [2025-10-15] [Matchmaking Implementation Planning](./10-15-[1]-matchmaking-implementation-planning.md)
- [2025-10-15] [Gameplay Implementation Planning](./10-15-[2]-gameplay-implementation-planning.md)
- [2025-10-17] [Branded Types Implementation](./10-17-[1]-branded-types-implementation.md)
- [2025-10-17] [Branded Types - Chat & Gameplay](./10-17-[2]-branded-types-chat-gameplay.md)

**Phase 2 - WS Infrastructure:**
- [2025-10-18] [WS Infrastructure Integration Plan](./10-18-[1]-ws-infrastructure-integration-plan.md)
- [2025-10-19] [WS Infrastructure Planning](./10-19-[1]-ws-infra-planning.md)
- [2025-10-19] [Backend WS Infrastructure Implementation](./10-19-[2]-ws-infra-backend-implementation.md) ✅
- [2025-10-19] [Frontend WS Infrastructure Implementation](./10-19-[3]-ws-infra-frontend-implementation.md)
- [2025-10-19] [WS Infrastructure Integration Testing](./10-19-[4]-ws-infra-integration-testing.md)

**System Domain:**
- [2025-10-20] [System Domain Missing Implementation](./10-20-[1]-system-domain-missing-impl.md)

**Future:**
- TBD: Business logic migration
- TBD: Many other items as we progress through phases
