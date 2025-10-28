# Backend Domain Integration Guide

**Status:** Reference guide (living document)
**Created:** 2025-10-28
**Based on:** First pass integrations of user, chat, and matchmaking domains

---

## Purpose

Guide for integrating v1 backend app logic into v2 domain structure. Captures patterns and learnings from the first three backend domain integrations (user, chat, matchmaking).

**Note:** These are observations from relatively simple domains so far. The gameplay domain (still pending) will likely introduce new complexities and patterns. This doc is meant to provide general guidance and reference examples, not serve as a precise step-by-step implementation guide.

---

## Prerequisites

Before starting a backend domain integration:

- [ ] Domain scaffold exists (`handlers.ts`, `actions.ts`, `ws-effects.ts`, `types.ts`)
- [ ] Protocol messages defined in `packages/protocol`
- [ ] V1 code has been moved into `apps/backend/src/domains/[domain]/` (even if unintegrated)

---

## Integration Workflow

### 1. Start with Handlers

**Goal:** Make handlers pure message routers

- Convert payload primitives → branded types at handler boundary
- Call domain actions with branded types (never pass raw context)
- Remove all business logic from handlers

**Pattern:**
```ts
const chatHandlers = {
  'chat:send-message': ({ roomId, content }, ctx) => {
    broadcastChatMessage(RoomId(roomId), content, UserId(ctx.userId));
  },
} satisfies HandlerMapWithCtx<ChatClientMessage, AppHandlerContext>;
```

### 2. Integrate Actions

**Strategy:** Adapt existing v1 actions rather than reimplementing in stubbed v2 actions

- Update function signatures to use branded types
- Remove dependencies on v1 patterns (old effects, ws-api, etc.)
- Call v2 ws-effects for broadcasting
- Add `systemActions.joinRoom/leaveRoom` where needed

**Note:** Phase 1 scaffolding created stub actions - in practice it's easier to modify the real v1 action files

### 3. Update Service Layers

**If domain has services (Redis, etc.):**

- Update public method signatures to accept branded types
- Add serialize/deserialize at storage boundaries
- Keep internal storage operations using primitives

**Example (matchmaking-service.ts):**
```ts
const redisUserIds = {
  serialize: (userId: UserId): string => idToNumber(userId).toString(),
  deserialize: (str: string): UserId => UserId(Number(str)),
};

async addPlayer(playerId: UserId, playerData: PlayerData = {}) {
  // ... serialize at boundary
  await this.redis.zAdd(this.queueKey, {
    score: timestamp,
    value: redisUserIds.serialize(playerId),
  });
}
```

### 4. Extract Helpers (As Needed)

**When you see duplication across 2+ actions in the same domain:**

- **Action helpers** - Extract common action patterns
  - Example: `broadcast-matchmaking-status.ts`
- **Utility helpers** - Extract cross-cutting concerns
  - Example: `db-utils.ts` with `requireEntity`

**Don't extract prematurely** - wait for duplication to appear

### 5. Delete Obsolete v1 Files

**Common deletions:**
- `game-[domain]-ws-api.ts` - Old v1 message handlers
- `ws-effects-v0.1.ts` - Old ws-effects implementation
- `actions-v0.1/` - Temporary v1 action files
- Stubbed v2 actions (if you adapted v1 actions instead)

### 6. Fix Imports Throughout

**Every file touched should have imports reorganized:**

1. Third-party libraries (`kysely`, `crypto`, etc.)
2. Shared packages (`@common`, `@kernel`, `@platform`)
3. App-level code (generic → specific)

**Consolidate kernel imports:**
```ts
import { UserId, RoomId, ChatMessageId } from '@kernel/ids';
```

### 7. Create Barrel Exports

**If domain has multiple action files, add `actions/index.ts`:**
```ts
export { findUser } from './find-user';
export { createUser } from './create-user';
export { autoCreateUser } from './auto-create-user';
```

---

## Common Patterns

### Branded Type Boundaries

**Three layers:**
1. **Handler:** Primitives → Branded
2. **Actions:** Branded throughout
3. **Service/DB:** Branded → Primitives (serialize)

### Action Signatures

**Pass exactly what's needed:**
```ts
// ❌ Don't pass full context
function broadcastMessage(message: Entity, ctx: UserContext)

// ✅ Pass specific args
async function broadcastMessage(roomId: RoomId, content: string, userId: UserId)
```

### Infrastructure Additions

**Only add when clearly needed:**
- Chat: Added `requireEntity` utility helper
- Matchmaking: Added `getConnectionsForUser` to ws-lib

**Don't over-engineer** - add infrastructure when you hit a clear need

---

## Common Cleanups & TODOs

**Examples of TODOs, questions, and cleanup notes that came up during the integrations so far.** These illustrate the types of issues you might encounter and need to track. It also shows how we drew the line between mixing in additional refactoring and fixes and defering things in ordeer to move forward with the basic integration.

### Database Integration
- Temporary ID generation (should come from DB insert)
- Timestamp generation (should come from DB)
- Repository duplication

### Cross-Domain Boundaries
- Actions calling into other domains (is this a code smell?)
- Should domain X call domain Y actions, or own the logic?
- Document as TODO in epic if unclear

### Implementation Quality
- Quick implementations that need review
- Type conversions that feel awkward
- Raw strings where branded types would be better

**Pattern:** Add inline TODOs + add to epic [TODOS].md if cross-cutting

---

## Progression Strategy

### Build on Previous Learnings

Each domain built on the previous:
- **User:** Path fixes, import cleanup patterns
- **Chat:** First real integration, helper extraction, file deletion
- **Matchmaking:** "Built on what we learned" - more sophisticated patterns

**Recommendation:** Review the most recent integration commit before starting yours

### Domain Complexity

Expect increasing sophistication:
- User: 11 files changed, minimal deletions
- Chat: 8 files, first helper extraction
- Matchmaking: 18 files, multiple helpers, infrastructure additions

**Simpler domains come first** - save complex ones for when patterns are mature

---

## Examples & References

### Commits
- User integration: `bac62be`
- Chat integration: `e020b53`
- Matchmaking integration: `756598d`

### Files to Reference
- **Simple handler:** `apps/backend/src/domains/chat/handlers.ts`
- **Helper extraction:** `apps/backend/src/domains/matchmaking/actions/broadcast-matchmaking-status.ts`
- **Service updates:** `apps/backend/src/domains/matchmaking/matchmaking-service.ts`
- **Utility helper:** `apps/backend/src/utils/db-utils.ts`

---

## Anti-Patterns

**Don't:**
- Leave business logic in handlers
- Pass full context objects to actions
- Forget to delete v1 files
- Ignore import ordering conventions
- Extract helpers before seeing duplication
- Add infrastructure "just in case"

**Do:**
- Keep handlers thin and pure
- Use branded types in action signatures
- Delete obsolete files as you go
- Follow import conventions religiously
- Extract helpers when you see the 2nd use
- Add infrastructure when you hit a clear need
