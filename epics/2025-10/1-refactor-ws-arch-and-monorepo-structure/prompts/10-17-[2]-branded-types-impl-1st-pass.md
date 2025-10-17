# Implementation Session Prompt: Branded Types for IDs

## Task Overview

Implement branded types for IDs (UserId, GameId, RoomId) across the kernel, protocol, and matchmaking domain. This provides compile-time type safety to prevent ID mixing bugs.

**Reference document:** `10-17-[1]-branded-types-implementation.md` (contains full planning, decisions, and detailed implementation steps)

## Key Context

**Branded Types Pattern:**
```typescript
type Brand<K, T> = K & { __brand: T };
type UserId = Brand<number, "UserId">;
const UserId = (value: number): UserId => value as UserId;
```

**ID Types:**
- `UserId` = `Brand<number, "UserId">`
- `GameId` = `Brand<number, "GameId">`
- `RoomId` = `Brand<string, "RoomId">`

**Conversion Strategy:**
- **Handlers** (domain entry): Convert protocol primitives → branded types
- **Actions/domain logic**: Work with branded types exclusively
- **WS-effects** (domain exit): Convert branded types → protocol primitives using `idToNumber()`/`idToString()` helpers

**Conversion helpers to create:**
```typescript
function idToNumber<T extends string>(id: Brand<number, T>): number
function idToString<T extends string>(id: Brand<string, T>): string
```

## Implementation Scope

**Full implementation:**
1. Kernel package (all ID types + constructors + helpers)
2. Protocol layer (fix voters array type, update TODOs)
3. Platform constants (brand MATCHMAKING_ROOM_ID)
4. Backend infrastructure (HandlerContext.userId type)
5. Backend system domain (update signatures to use branded types)
6. **Backend matchmaking domain** (complete reference implementation)
7. Frontend system domain (update signatures to use branded types)
8. **Frontend matchmaking domain** (complete reference implementation)

**Future work (tracked in epic docs):**
- Gameplay and chat domains will be updated in future sessions

## Step-by-Step Implementation

Follow the detailed plan in `10-17-[1]-branded-types-implementation.md`, sections:
- **Phase 1:** Kernel Package Updates (steps 1.1-1.4)
- **Phase 2:** Protocol Layer Fixes (steps 2.1-2.2)
- **Phase 3:** Platform Constants (step 3.1)
- **Phase 4:** Backend Infrastructure (step 4.1)
- **Phase 5:** Backend System Domain (step 5.1)
- **Phase 6:** Backend Matchmaking Domain (steps 6.1-6.3) - **Complete backend example**
- **Phase 7:** Frontend System Domain (step 7.1)
- **Phase 8:** Frontend Matchmaking Domain (steps 8.1-8.3) - **Complete frontend example**

Each step includes specific file paths, line numbers, and exact code changes.

## Important Notes

1. **Follow export pattern:** All exports at END of files
2. **Follow import order:** See AGENTS.md for import ordering rules
3. **Matchmaking is the reference:** Both backend and frontend matchmaking fully implemented
4. **System domain required:** Both backend and frontend system domains must be updated (matchmaking depends on them)
5. **Protocol stays primitive:** Wire format is primitives, conversions happen in app layer
6. **Constants are branded:** `MATCHMAKING_ROOM_ID` branded at definition

## Key Files to Update

**Kernel:**
- `packages/kernel/branded-type.ts` - Add helpers
- `packages/kernel/domains/user.ts` - Add constructor
- `packages/kernel/domains/game.ts` - NEW FILE: Create GameId
- `packages/kernel/domains/system.ts` - Add constructor

**Protocol:**
- `packages/protocol/domains/matchmaking/server-messages.ts` - Fix voters type
- `packages/protocol/domains/gameplay/server-messages.ts` - Update TODO comments

**Platform:**
- `packages/platform/domains/matchmaking/constants.ts` - Brand constant

**Backend Infrastructure:**
- `apps/backend/src/ws/types.ts` - Fix HandlerContext.userId type

**Backend System Domain:**
- `apps/backend/src/domains/system/actions.ts` - Update signatures

**Backend Matchmaking (Complete Example):**
- `apps/backend/src/domains/matchmaking/handlers.ts` - Add conversions
- `apps/backend/src/domains/matchmaking/actions.ts` - Use branded types
- `apps/backend/src/domains/matchmaking/ws-effects.ts` - Add conversions

**Frontend System Domain:**
- `apps/frontend/src/domains/system/actions.ts` - Update signatures

**Frontend Matchmaking (Complete Example):**
- `apps/frontend/src/domains/matchmaking/handlers.ts` - Add conversions
- `apps/frontend/src/domains/matchmaking/actions.ts` - Use branded types

## Success Criteria

1. ✅ All kernel types created with constructors and helpers
2. ✅ Protocol voters array is `number[]` not `string[]`
3. ✅ MATCHMAKING_ROOM_ID is branded as RoomId
4. ✅ HandlerContext.userId is `number` not `string`
5. ✅ Backend system domain accepts branded types (RoomId, UserId)
6. ✅ Backend matchmaking domain has conversions at all boundaries
7. ✅ Frontend system domain accepts branded types (RoomId)
8. ✅ Frontend matchmaking domain has conversions at all boundaries
9. ✅ Code follows import/export patterns from AGENTS.md

## After Implementation

1. Commit with message referencing this tactical note (`10-17-[1]-branded-types-implementation.md`)
2. Note any issues or deviations in the tactical note
3. **Update `[STRATEGY-AND-TRACKER].md`:**
   - Add entry to "Progress Tracker > Completed" section (2-3 bullets max, follow existing format)
   - Update "In Progress" section if needed
   - Add reference to this tactical note in "Tactical Docs" section at bottom

## Questions/Issues During Implementation

If you encounter questions or issues:
1. Check the tactical doc first - detailed steps are there
2. Follow the matchmaking pattern for guidance
3. Document any deviations or problems in the tactical doc
4. Add to [TODOS].md if you discover new work items

---

**Start with Phase 1 (kernel updates) and work through sequentially. The tactical doc has all the details you need.**
