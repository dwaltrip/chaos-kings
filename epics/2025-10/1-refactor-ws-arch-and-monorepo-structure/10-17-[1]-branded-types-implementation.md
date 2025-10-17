# Branded Types Implementation - Planning

**Date:** 2025-10-17
**Status:** Planning complete, ready to implement
**Context:** End of Phase 1 - adding type safety for IDs across the system

## Overview

Implementing branded types for IDs (UserId, GameId, RoomId) to provide compile-time safety and prevent ID mixing bugs. Using `Brand<K, T>` pattern with explicit conversion boundaries.

## Implementation Scope

**Full Implementation (this session):**
- Kernel package - All branded types (UserId, GameId, RoomId) with constructors and conversion helpers
- Protocol layer - Fix voters array type, update TODO comments
- Platform constants - Brand MATCHMAKING_ROOM_ID
- Backend infrastructure - Fix HandlerContext.userId type
- Backend system domain - Update to use branded types (required by matchmaking)
- **Backend matchmaking domain - Complete reference implementation** with conversions at all boundaries
- Frontend system domain - Update to use branded types
- **Frontend matchmaking domain - Complete reference implementation** with conversions at all boundaries

**Future Work (tracked in epic docs):**
- Gameplay domain - Will implement branded types in future session
- Chat domain - Will implement branded types in future session

Matchmaking (both backend and frontend) will serve as the **complete working example** showing the full pattern: handlers convert primitives → branded, actions work with branded types, ws-effects convert branded → primitives.

## Decisions

### ID Types
- `UserId` = `Brand<number, "UserId">` (matching v1 backend - easy to migrate to UUIDs later)
- `GameId` = `Brand<number, "GameId">` (matching v1 backend)
- `RoomId` = `Brand<string, "RoomId">` (already created)

### Conversion Strategy
**Boundaries:**
- **Infrastructure layer** (WS server, HandlerContext): primitives only, domain-agnostic
- **Handlers** (domain entry): convert protocol primitives → branded types
- **Actions/domain logic**: work with branded types exclusively
- **WS-effects** (domain exit): convert branded types → protocol primitives

**Helpers:**
```typescript
idToNumber<T>(id: Brand<number, T>): number  // for GameId, UserId
idToString<T>(id: Brand<string, T>): string  // for RoomId
```

### Protocol Layer
- Payload types stay primitive (reflect actual wire format)
- MsgCreators accept primitives (symmetric with incoming conversion in handlers)
- NOTE: May revisit - could have MsgCreators accept branded types to centralize outgoing conversion

### Room ID Constants
Brand at definition:
```typescript
const MATCHMAKING_ROOM_ID: RoomId = RoomId('matchmaking-queue');
```

### Domain Types
Not creating separate domain entities yet - protocol shapes sufficient for current needs.

## Implementation Tasks

### Phase 1: Kernel Package Updates

**1.1 Add UserId constructor function**
- File: `packages/kernel/domains/user.ts`
- Add constructor: `const UserId = (value: number): UserId => value as UserId;`
- Export the constructor function

**1.2 Create GameId type and constructor**
- File: `packages/kernel/domains/game.ts` (new file)
- Add type: `type GameId = Brand<number, "GameId">;`
- Add constructor: `const GameId = (value: number): GameId => value as GameId;`
- Export both type and constructor

**1.3 Add RoomId constructor function**
- File: `packages/kernel/domains/system.ts`
- Add constructor: `const RoomId = (value: string): RoomId => value as RoomId;`
- Export the constructor function

**1.4 Add conversion helper functions**
- File: `packages/kernel/branded-type.ts`
- Add: `function idToNumber<T extends string>(id: Brand<number, T>): number { return id as number; }`
- Add: `function idToString<T extends string>(id: Brand<string, T>): string { return id as string; }`
- Export both functions

### Phase 2: Protocol Layer Fixes

**2.1 Fix voters array type**
- File: `packages/protocol/domains/matchmaking/server-messages.ts`
- Line 11: Change `voters: string[]` → `voters: number[]`
- Line 42: Update parameter type `voters: string[]` → `voters: number[]` in `createEarlyStartStatusMessage`

**2.2 Update TODO comments about conversions**
- Files: `packages/protocol/domains/matchmaking/server-messages.ts` and `packages/protocol/domains/gameplay/server-messages.ts`
- Update `// TODO: [BRANDED_TYPES-gameId]` comments to: `// TODO: [BRANDED_TYPES] Primitives over wire - conversions happen in app layer (handlers/ws-effects)`

### Phase 3: Platform Constants

**3.1 Brand MATCHMAKING_ROOM_ID constant**
- File: `packages/platform/domains/matchmaking/constants.ts`
- Import: `import { RoomId } from '@kernel/domains/system';`
- Change declaration: `const MATCHMAKING_ROOM_ID: RoomId = RoomId('matchmaking-queue');`

### Phase 4: Backend Infrastructure

**4.1 Fix HandlerContext.userId type**
- File: `apps/backend/src/ws/types.ts`
- Line 7: Change `userId: string` → `userId: number`

### Phase 5: Backend System Domain

**5.1 Update system action signatures to use branded types**
- File: `apps/backend/src/domains/system/actions.ts`
- Import: `import { RoomId } from '@kernel/domains/system'; import { UserId } from '@kernel/domains/user';`
- Update `joinRoom(roomId: RoomId, userId: UserId)` signature
- Update `leaveRoom(roomId: RoomId, userId: UserId)` signature
- Add TODO note about actual implementation with Redis

### Phase 6: Backend Matchmaking Domain (Complete Example)

**6.1 Update matchmaking handlers with conversions**
- File: `apps/backend/src/domains/matchmaking/handlers.ts`
- Import: `import { UserId } from '@kernel/domains/user';`
- Line 9: Change to `matchmakingActions.joinQueue(UserId(ctx.userId))`
- Line 13: Change to `matchmakingActions.leaveQueue(UserId(ctx.userId))`
- Line 16: Change to `matchmakingActions.earlyStartVote(vote, UserId(ctx.userId))`

**6.2 Update matchmaking actions to accept branded types**
- File: `apps/backend/src/domains/matchmaking/actions.ts`
- Import: `import { UserId } from '@kernel/domains/user'; import { RoomId } from '@kernel/domains/system';`
- Update `joinQueue(userId: UserId)` signature (remove `ctx` parameter)
- Update `leaveQueue(userId: UserId)` signature
- Update `earlyStartVote(vote: boolean, userId: UserId)` signature
- Update system action calls: `systemActions.joinRoom(MATCHMAKING_ROOM_ID, userId)` (constant already branded)
- Update system action calls: `systemActions.leaveRoom(MATCHMAKING_ROOM_ID, userId)`

**6.3 Update matchmaking ws-effects with conversions**
- File: `apps/backend/src/domains/matchmaking/ws-effects.ts`
- Import: `import { idToNumber, idToString } from '@kernel/branded-type';`
- Import: `import { UserId } from '@kernel/domains/user'; import { GameId } from '@kernel/domains/game';`
- Update `broadcastEarlyStartStatus(voters: UserId[], queueSize: number, allVoted: boolean)` signature
- Line 17: Change to `voters.map(idToNumber)`
- Update `broadcastGameReady(gameId: GameId)` signature
- Line 24: Change to `idToNumber(gameId)`

### Phase 7: Frontend System Domain

**7.1 Update system ws-effects to accept branded types**
- File: `apps/frontend/src/domains/system/actions.ts` (currently named `systemWsEffects`)
- Import: `import { RoomId } from '@kernel/domains/system';`
- Update `joinRoom(roomId: RoomId)` signature (was `roomId: string`)
- Update `leaveRoom(roomId: RoomId)` signature
- Note: Will need to convert `idToString(roomId)` when sending message (once ws implementation exists)

### Phase 8: Frontend Matchmaking Domain (Complete Example)

**8.1 Update matchmaking handlers with conversions**
- File: `apps/frontend/src/domains/matchmaking/handlers.ts`
- Import: `import { UserId } from '@kernel/domains/user'; import { GameId } from '@kernel/domains/game';`
- Line 10: Change to `matchmakingActions.handleQueueStatus(payload);` (no change - no IDs in payload)
- Line 14: Change to `matchmakingActions.handleEarlyStartStatus({ voters: payload.voters.map(UserId), queueSize: payload.queueSize, allVoted: payload.allVoted });`
- Line 18: Change to `matchmakingActions.handleGameReady(GameId(payload.gameId));`

**8.2 Update matchmaking actions (inbound) to accept branded types**
- File: `apps/frontend/src/domains/matchmaking/actions.ts`
- Import: `import { UserId } from '@kernel/domains/user'; import { GameId } from '@kernel/domains/game'; import { RoomId } from '@kernel/domains/system';`
- Update `handleEarlyStartStatus` signature: `payload: { voters: UserId[]; queueSize: number; allVoted: boolean }`
- Update `handleGameReady` signature: `handleGameReady(gameId: GameId)` (was `payload: { gameId: number }`)

**8.3 Update matchmaking actions (outbound) to use branded RoomId**
- File: `apps/frontend/src/domains/matchmaking/actions.ts` (same file)
- Line 14: `systemWsEffects.joinRoom(MATCHMAKING_ROOM_ID);` (constant already branded, no change needed)
- Line 24: `systemWsEffects.leaveRoom(MATCHMAKING_ROOM_ID);` (constant already branded, no change needed)

## Open Questions

- **MsgCreators conversion:** Should MsgCreators accept branded types (centralizing outgoing conversion) or stay primitive (symmetric with incoming)? Flagged with TODO for now.
- **Domain types:** When do we need separate domain entities vs. using protocol types directly?

## Notes

- Branded types are phantom - `__brand` property only exists at compile time
- Easy to change base type later (number → string for UUIDs)
- Don't do arithmetic or comparisons on IDs
- Use constructors consistently to maintain type safety

## References

- Branded types discussion in main refactor strategy doc
- Phase 1 wrap-up task in progress tracker
