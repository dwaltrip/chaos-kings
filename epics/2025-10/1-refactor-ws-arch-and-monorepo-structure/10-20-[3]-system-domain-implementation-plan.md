# System Domain Implementation Plan

## Doc Purpose
Create a concrete, end-to-end plan for implementing the v2 system domain across backend and frontend. This doc turns the research findings into actionable steps with enough detail that either of us (or another teammate/agent) can pick up the work with minimal rediscovery.

---

## Context Snapshot
- **Scope:** Implement both backend and frontend layers for the system domain (protocol → handlers/actions/ws-effects → light client usage), assuming frontend WS infra work proceeds smoothly. Pause and reassess if any frontend blockers tied to Phase 2.2 emerge.
- **Messages (must-have):** `system:join-room`, `system:leave-room` (client → server) and `system:room-status-update` (server → client carrying full snapshots).
- **Room naming:** `domain-name:slug-for-room` convention. Exact helper/enforcement approach TBD; leave flexibility but capture intent.
- **Validation:** Enforce branded `RoomId`; keep additional validation minimal for this pass. Note the future decision point.
- **Heartbeat / lifecycle:** Explicitly out of scope here. Add note + TODO breadcrumb so we revisit once infrastructure settles.
- **Frontend state:** Keep the system domain lightweight. No persistent store yet—emit effects/hooks that domain features can call.
- **Cross-domain usage:** Other backend domains may call `systemActions.joinRoom/leaveRoom` directly (e.g., matchmaking auto-joins). Provide a helper or documented pattern for generating correctly prefixed room IDs.

---

## Goals
- Establish a clear, reusable system-domain slice that owns WebSocket room membership and distributes room status snapshots.
- Replace domain-specific join/leave transport messages with centralized system domain messages without breaking existing scaffolding.
- Provide frontend-facing helpers for other domains to invoke (join/leave) while remaining agnostic about their internal state management.
- Ensure all new code follows current import/export conventions and branded-type patterns.

## Non-Goals
- Implement heartbeat/keepalive, reconnection policies, or connection health monitoring.
- Build rich frontend state (stores, selectors) for room membership. Defer until real consumers materialize.
- Enforce strict room authorization or validation rules beyond branded IDs and shape checks.

---

## Architecture Blueprint

### Protocol Layer
Create a dedicated protocol module under `packages/protocol/domains/system/` with discriminated unions for both directions. We will also introduce a helper like `makeRoomId(domain, slug)` in this folder so both apps share the naming convention; add a note that we may migrate this helper into a future `platform` package once that layer stabilizes. Client consumers who need richer user data should fetch or hydrate it via existing JSON/user APIs—the system domain only ships `UserId[]`. Target shape:

```ts
// packages/protocol/domains/system/messages.ts
import { RoomId, UserId } from '@kernel/ids';

interface SystemJoinRoom {
  type: 'system:join-room';
  payload: { roomId: RoomId };
}

interface SystemLeaveRoom {
  type: 'system:leave-room';
  payload: { roomId: RoomId };
}

interface SystemRoomStatusUpdate {
  type: 'system:room-status-update';
  payload: {
    roomId: RoomId;
    memberIds: UserId[];
  };
}
```

Bundle these into `SystemClientMessage`, `SystemServerMessage` unions, and remember that the actual runtime unions live in `apps/backend/src/ws/message-types.ts` (and the frontend analogue once Phase 2.2 lands). Update those app-level files so the system messages participate in the aggregated unions.

### Backend Flow (Join Example)
1. **Frontend action** calls `systemWsEffects.joinRoom(roomId)`.
2. **Frontend ws-effect** sends `system:join-room`.
3. **Backend handler** receives the message, validates payload shape, and calls `systemActions.joinRoom({ roomId, userId, connectionId })`.
4. **Backend action**:
   - Delegates to `wsBridge.rooms.join(roomId, connectionId)`.
   - Updates an in-memory tracker that maps connection IDs to user IDs so we can emit `UserId[]` snapshots (the bridge only exposes connection sets).
   - Emits `systemWsEffects.broadcastRoomStatus(roomId, memberIds)` which publishes `system:room-status-update` via the bridge.
5. **Frontend handler** receives snapshot and hands it to whichever domain requested it (for now, likely a callback/hook consumer rather than a persisted store).

### Frontend Flow (Room Status Consumption)
- System ws-effects expose `joinRoom(roomId)` / `leaveRoom(roomId)` for outgoing messages.
- Incoming `system:room-status-update` handling remains a stub with detailed comments until the Phase 2.2 WS client finalizes its subscription interface. Downstream domains can manually wire listeners once that story lands.

---

## Implementation Plan

### 1. Protocol Package Updates
1. Add a kernel barrel: create `packages/kernel/ids.ts` exporting the branded IDs we need (`RoomId`, `UserId`, etc.) and wire it to the existing tsconfig path `@kernel/*`. Leave a TODO in that file (or nearby) to migrate existing imports gradually; no need to touch other domains yet.
2. Create `packages/protocol/domains/system/` with:
   - `client-messages.ts` (client → server DTOs).
   - `server-messages.ts` (server → client DTOs).
   - `index.ts` exporting unions + namespaces.
3. Update app-level union aggregators:
   - Backend: extend `apps/backend/src/ws/message-types.ts`.
   - Frontend: extend the equivalent file introduced during Phase 2.2 (add TODO comment if the file is not present yet).
4. Define shared payload shapes:
   - `RoomStatusPayload = { roomId: RoomId; memberIds: UserId[] }`.
   - Optional helper `validateRoomId(roomId: RoomId)` (no-op placeholder, but structure ready for future validation).
5. Double-check tree-shakable export blocks at the end of each file to satisfy import/export conventions.

### 2. Backend Domain Implementation
**File targets (new unless noted):**
- `apps/backend/src/domains/system/actions.ts`
- `apps/backend/src/domains/system/handlers.ts`
- `apps/backend/src/domains/system/ws-effects.ts`
- `apps/backend/src/domains/system/index.ts` (ensures domain registration mirrors other domains)

**Actions (`actions.ts`):**
```ts
function joinRoom({ roomId, userId, connectionId }: JoinRoomInput) {
  wsBridge.rooms.join(roomId, connectionId);
  roomMembershipTracker.add(roomId, { userId, connectionId });
  const memberIds = roomMembershipTracker.getUserIds(roomId);
  systemWsEffects.broadcastRoomStatus({ roomId, memberIds });
}
```
- Capture both `userId` and `connectionId` so we can expand to per-connection tracking later.
- Mirror shape for `leaveRoom` (remove connection, broadcast new snapshot) and ensure we keep `roomMembershipTracker` in sync since `wsBridge.rooms.getMembers()` only exposes connection IDs.
- Implement a lightweight in-memory `roomMembershipTracker` utility alongside the system actions so we can map connection IDs back to `UserId`. Leave breadcrumbs for persisting this state (Redis, etc.) if we outgrow the in-memory approach.
- Expose helper for other domains: `ensureJoined(domainSlug: string, context: HandlerContext)` which assembles the `domain-name:slug` identifier using the convention.

**Ws-effects (`ws-effects.ts`):**
- Provide `broadcastRoomStatus({ roomId, memberIds })` leveraging `wsBridge.broadcastToRoom(roomId, message)`.
- Provide `sendRoomStatusToConnection(...)` for targeted sync (useful for immediate self-update after join).

**Handlers (`handlers.ts`):**
- Register `system:join-room` and `system:leave-room`.
- Resolve `roomId` to branded type (simple cast for now).
- Extract `userId`/`connectionId` from `HandlerContext`.
- Delegate to actions and return `HandlerResult.ok`.

**Domain registration:**
- Ensure backend bootstrap imports `system/handlers` so messages get registered.
- Verify existing TODO references to stubbed system actions are cleaned up (remove stub implementations, update imports in other domains).

### 3. Frontend Domain Implementation
**File targets:**
- `apps/frontend/src/domains/system/ws-effects.ts`
- `apps/frontend/src/domains/system/handlers.ts`
- `apps/frontend/src/domains/system/hooks.ts` (lightweight optional helper)

**Ws-effects:**
```ts
function joinRoom(roomId: RoomId) {
  wsClient.send({ type: 'system:join-room', payload: { roomId } });
}
```
- Mirror `leaveRoom`.
- Keep room-status listening minimal for now; wire a placeholder handler (see below) and capture richer subscription needs once the WS client pub/sub story is clear.

**Handlers:**
- Register a stub handler for `system:room-status-update` that logs or no-ops with a detailed inline comment describing how downstream domains should expect to subscribe once Phase 2.2 finalizes the client pub/sub API. This keeps the wiring testable without prematurely designing the listener pattern.

**Hooks (optional but recommended):**
- Defer `useRoomStatus` (or similar) until we know how the frontend will expose subscriptions. Document the intent in a TODO comment near the handler.

**Integration touchpoints:**
- Update domains that currently call gameplay-specific join messages to instead import `systemWsEffects`.
- Document usage examples in comments or README snippet so future domains know how to depend on the system domain.

### 4. Remove Legacy Join/Leave References
- Locate and prune `gameplay:join-room` / `gameplay:leave-room` protocol references once the system domain is functional. Replace calls with system equivalents and ensure any TODO markers pointing to system implementation are resolved.
- Update tests or stubs that expected gameplay-specific messages.

### 5. Manual Verification Plan
- After backend + frontend changes, run a local session (or mock via unit harness once WS client lands) to confirm:
  1. Join message results in backend room membership and snapshot broadcast.
  2. Leave message drops membership and snapshots update accordingly.
  3. Other domain actions can call `systemActions.joinRoom` without sending messages (e.g., simulate matchmaking auto-join).
- Capture issues in `[TODOS].md` if manual testing reveals follow-up work.

---

## Deliverables Checklist
- [ ] Protocol module with system domain message unions.
- [ ] Backend actions/handlers/ws-effects wired to the shared wsBridge.
- [ ] Frontend ws-effects and message listeners available to other domains.
- [ ] Legacy gameplay join/leave wiring removed or redirected.
- [ ] Heartbeat follow-up TODO recorded and referenced in doc.
- [ ] Note documenting room ID naming helper requirement (even if helper is minimal now).

---

## Risks & Mitigations
- **Frontend WS infra dependency:** If Phase 2.2 slips, we may need temporary shims or feature flags around system ws-effects. Mitigation: document blocker early; plan allows for pausing frontend portion if necessary.
- **Room ID misuse:** Without enforced helpers, callers might bypass the `domain-name:slug` convention. Mitigation: provide `makeRoomId(domain, slug)` helper in the protocol system domain (imported by both apps) and note future lint rule or branded constructor.
- **Snapshot broadcast volume:** Full snapshots may become expensive later. Mitigation: noted as acceptable trade-off for now; future optimization path (diff events) documented.

---

## Open Questions & Follow-Ups
1. **UserId derivation strategy:** Validate the `roomMembershipTracker` approach during implementation. If the ws bridge or handler context already exposes a user lookup we can leverage that instead of duplicating state.
2. **Member payload shape:** For `memberIds`, do we expose bare `UserId[]`, or do we want richer data (username, presence) soon? Current assumption: `UserId[]`. Flag if we expect quick expansion.
3. **Frontend listener registry:** Keep as an intentional TODO in code comments; revisit once the Phase 2.2 WS client exposes its subscription story.
4. **Heartbeat TODO:** Add entry in `[TODOS].md` (“Implement system heartbeat & lifecycle handling”) to ensure the deferral remains visible.

Once we confirm the membership-tracking approach and the frontend listener pattern, we can move straight into implementation. Everything else is ready to execute.
