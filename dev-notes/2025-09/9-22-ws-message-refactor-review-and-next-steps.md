# WebSocket Message Refactor — Review & Next Steps (Post-Phase 2/Gameplay)

Date: 2025-09-22

## TL;DR

We refactored WebSocket messaging to be explicit and type-safe via directional envelopes, split domain unions, transport-agnostic domain actions, and per-domain ws-effects. Room naming is standardized with `roomKey(domain, room)`. Frontend sends client envelopes and consumes server-only unions; backend WS APIs hydrate `user` and delegate to actions through effects. The result: clearer architecture, safer types, simpler testing, and a stronger foundation for gameplay/chat features. One short tightening phase remains to remove duplicate domain injection, add inbound typing to remove casts, add leave-room lifecycle, and introduce minimal runtime validation and FE QoL.

What to review now:
- Goals & Rationale (why envelopes/effects/roomKey)
- Domain effects explanation and alternatives
- Message flow examples for Chat and Gameplay
- Old → New mapping table
- Domain/message matrices (C→S vs S→C)
- Proposed Final Phase (prioritized, with effort)
- Testing plan, Security/Authorization notes, Known Limitations

What we’ll do next (prioritized):
- P0: Consolidate outbound domain injection into effects (remove DomainAPI injection)
- P0: Add discriminated inbound typing in WS APIs (eliminate casts)
- P1: Add leave-room lifecycle on unmount/room change
- P1: Add minimal runtime validation for inbound C→S payloads
- P2: FE send queue and small send helpers; add tests for actions and WS APIs

## Executive Summary

We completed the envelope-based WebSocket refactor for Chat and Gameplay after establishing the groundwork and migrating Matchmaking. Directionality is explicit across the stack, backend domain actions are decoupled from the transport via domain-specific effects, and room naming is standardized with a `roomKey(domain, room)` helper to prevent collisions. On the frontend, domain handlers now consume server-only unions and all client sends are envelope-based. The result is a clearer, more robust WS architecture that’s easier to reason about, safer to extend, and simpler to test.

This document expands on what changed, why it changed, and how it currently behaves. It includes concrete examples, an explicit code review checklist, observations on ergonomics and type-safety, and a proposed final tightening plan. It should be usable as a standalone reference for a fresh review session.

## Goals & Rationale

- Make message direction explicit and unambiguous.
  - Previous `WsMessage` mixed flow introduced subtle errors (e.g., client handlers accidentally reading server fields like `user`).
  - Separate C→S and S→C unions force correct usage through the type system.
- Decouple domain logic from the transport.
  - Domain actions should operate on plain arguments and collaborate via minimal, domain-scoped effects (join/leave/broadcast).
  - This increases testability and reduces coupling to the WS manager.
- Standardize room naming and avoid cross-domain collisions.
  - Using `roomKey(domain, room)` ensures `game-chat:game-123` and `gameplay:game-123` are distinct.
- Improve developer ergonomics.
  - Frontend handlers consume a single outbound union per domain.
  - Backend WS APIs are thin and focused, with clear user hydration and action delegation.

## Domain Effects (ws-effects): What, Why, and Design Choices

Domain effects ("ws-effects") are small, per-domain modules that expose only the transport operations a domain is allowed to perform. For example, chat effects can: join a chat room, leave a chat room, and broadcast a new chat message to that room. Gameplay effects can: join/leave gameplay rooms. Importantly, effects:

- Wrap and narrow the raw `WsActions` from the WebSocket layer, so domain code never manipulates sockets directly or sends arbitrary messages.
- Compose details like room naming (via `roomKey(domain, room)`) and ensure the correct `domain` is present on all outbound payloads.
- Provide a stable interface to actions; actions accept plain arguments and call effects without knowing anything about WebSocket internals.

This pattern creates a clean “transport boundary”: domain actions are pure application logic (easy to test, reuse), and effects are the minimal shims that touch the network.

Why we chose effects now:

- Testing and reuse: Plain-arg actions can be tested with mocked effects, no sockets required.
- Safety: Effects centralize room-key composition and outbound domain scoping, preventing cross-domain mistakes.
- Incremental migration: Effects are easy to introduce per domain without rewriting the manager.

Alternatives considered:

- Direct use of `WsActions` in actions: Quicker initially, but it leaks transport details into business logic and makes testing harder.
- Domain-specific outbound wrappers inside `DomainAPI`: Keeps transport centralized, but blurs ownership and still requires some domain-specific code in infra. We opted to push domain specifics down near the domain (effects) and keep `DomainAPI` thin.
- Global message bus abstraction: Overkill for current scope; increases complexity without clear benefits versus effects.

Connection to WebSocketManager and `injectDomain` simplification:

- Today, both `DomainAPI.injectDomain` and effects set/ensure the `domain` on outbound messages. This is intentionally redundant during migration to avoid breaking flows.
- In the final tightening phase, we plan to remove `injectDomain` and consolidate outbound domain scoping inside effects exclusively. That will:
  - Simplify `DomainAPI` (no outbound mutation),
  - Make responsibilities explicit (effects own domain scoping), and
  - Reduce cognitive overhead when reasoning about where `domain` comes from.
- With effects owning room-key composition and outbound scoping, `WebSocketManager` remains a generic router/broadcaster. It won’t need to know anything about domains beyond delivering messages and managing room membership.

## Old → New Mapping (At a Glance)

| Area | Before | After | Why it’s better |
|---|---|---|---|
| Message shape | `WsMessage` (mixed direction, ad hoc fields) | `WsClientEnvelope`, `WsServerInbound`, `WsServerOutbound` | Explicit direction; server adds `user`; fewer implicit assumptions |
| Domain unions | Mixed unions used by FE/BE | Split C→S and S→C per domain | Type safety; handlers only see what they should |
| Room naming | Ad hoc strings (e.g., `gameplay-123`) | `roomKey(domain, room)` + bare room in payloads | Avoid collisions; FE payloads cleaner |
| Actions | Used `WsActions` directly | Plain-arg actions + ws-effects | Testable, decoupled from transport |
| DomainAPI | Handled everything, injected domain | Thin dispatcher; outbound domain injection to be removed | Clearer responsibilities |
| FE handlers | Consumed mixed unions | Consume server-only unions | Simpler, safer client code |

## Domain/Message Matrices

Matchmaking
- C→S: `join-queue`, `leave-queue`, `early-start-vote`
- S→C: `queue-status`, `early-start-status`, `game-ready`

Chat
- C→S: `join-room`, `leave-room`, `post-message`
- S→C: `new-message`

Gameplay
- C→S: `join-room`, `leave-room`, `move-request`, `cancel-moves-request`, `undo-move-request`
- S→C: `game-starting`, `game-started`, `game-state-update`, `game-ended`

## Scope & Outcomes to Date

- Directional envelopes in common types:
  - `WsClientEnvelope` (client → server): `{ domain, type, payload }` with no `user`.
  - `WsServerInbound` (server-side hydrated): `WsClientEnvelope + { user }`.
  - `WsServerOutbound` (server → client): `{ domain, type, payload }`.
- Domains migrated off `WsMessage`:
  - Matchmaking (earlier), Chat (Phase 2), Gameplay (Phase 3).
- Backend actions are transport-agnostic and use domain effects for WS ops.
- Room naming standardized via `roomKey(domain, room)`.
- Frontend sends are envelopes; receives are dispatched by domain to server-only handlers.

## Concrete Examples

1) Chat: Client sending a message
```
// FE → BE
{
  domain: 'game-chat',
  type: 'post-message',
  payload: { room: 'game-42', content: 'gg wp' }
}

// BE WS API:
// - hydrates user → { id, username }
// - effects.broadcastNewMessage('game-42', { content, userId, username, timestamp })

// BE → FE broadcast
{
  domain: 'game-chat',
  type: 'new-message',
  payload: { room: 'game-42', content: 'gg wp', userId: 17, username: 'alice', timestamp: 1695400000000 }
}
```

Sequence (Chat: post-message)
```
FE send (post-message)
  → WS Manager (hydrate user)
  → Chat WS API (build effects)
  → postMessage action (trim, timestamp)
  → effects.broadcastNewMessage
  → WS Manager serverBroadcastToRoom
  → FE GameChat handler (new-message)
```

2) Gameplay: Client queuing a move
```
// FE → BE
{
  domain: 'gameplay',
  type: 'move-request',
  payload: { sourceCoord: {x: 4, y: 2}, direction: 'right' }
}

// BE WS API:
// - hydrates user
// - queueMove(user.id, sourceCoord, direction)

// BE → FE later (state update)
{
  domain: 'gameplay',
  type: 'game-state-update',
  payload: { tick: 37, boardState: { ... }, playerQueues: { ... } }
}
```

Sequence (Gameplay: join/start/state)
```
FE send (join-room: game-123)
  → WS Manager (hydrate user)
  → Gameplay WS API (effects.joinGameplayRoom)
  → GameServer observes player join (may start countdown)
  → GameServer broadcasts game-starting (countdown ticks)
  → GameServer broadcasts game-started
  → On ticks, GameServer broadcasts game-state-update
  → FE Gameplay handler updates stores
```

## Implemented Changes (By Area)

### Common
- `@common/types/websockets`: Added envelopes and `WsDomainHandler` signature used by FE services.
- `@common/types/game-matchmaking`: Split into `GameMatchmakingClient`/`Server` directional unions.
- `@common/types/game-chat`: Split into `GameChatClient`/`Server`. Renamed client send to `post-message`; server emits `new-message` with `username`, `userId`, and `timestamp` from the server.
- `@common/types/gameplay`: Split into `GameplayClient`/`Server`; removed `WsMessage`; standardized payloads; set `game-started.payload.playerMapping` to `{ playerId: string; playerIndex }` to match FE expectations.
- `@common/utils/room-key.ts`: `roomKey(domain, room)` returns a composite room key like `gameplay:game-123`.
- `@common/domains/game/utils.ts`:
  - `bareRoomForGameChat(game)` and `bareRoomForGameplay(game|id)` produce bare room ids (e.g., `game-123`).
  - `roomNameFor...` composes composite keys via `roomKey()`.

### Backend Infrastructure
- WS Manager: Validates client envelopes, hydrates to `WsServerInbound` with `user`, and dispatches to `DomainAPI`.
- `DomainAPI`: Maintains a domain registry and injects `domain` into outbound messages (temporary duplication with effects; see Final Tightening).

### Backend: Matchmaking
- Effects: `createMatchmakingEffects` with `joinMatchmakingRoom`, `broadcast...` helpers.
- Actions: `joinQueue`, `leaveQueue`, `earlyStartVote` accept plain args and call effects.
- Room naming: Adopted `roomKey(GAME_MATCHMAKING_DOMAIN, 'queue')`.

### Backend: Chat
- Effects: `createGameChatEffects` for `joinChatRoom`, `leaveChatRoom`, `broadcastNewMessage` that composes composite room keys.
- Action: `postMessage(userId, username, room, content)` performs trimming, length limits, and stamps server time.
- WS API: Registers C→S handlers (`join-room`, `leave-room`, `post-message`), hydrates user, and wires effects.

### Backend: Gameplay
- Effects: `createGameplayEffects` for `joinGameplayRoom`, `leaveGameplayRoom` using `roomKey`.
- Actions (plain args):
  - `queueMove(userId, sourceCoord, direction)`
  - `cancelQueuedMoves(userId)`
  - `undoLastQueuedMove(userId, gameId)`
- WS API: C→S handlers hydrate user and delegate to actions; join/leave via effects.
- GameServer: Uses composite room via `roomKey('gameplay', 'game-${id}')` and aligns `playerMapping` payload shape.

### Frontend Infrastructure
- `WebSocketService`: Sends envelopes; receives `WsServerOutbound`; dispatches to per-domain handlers.
- `joinRoom(domain, room)`: Sends a `join-room` envelope and tracks composite room keys.
- `useWebsocket(domain, handler, room?)`: Registers handler, waits until ready, and joins a room if provided. Cleanup deregisters the handler.

### Frontend: Chat
- Actions: Send `post-message` envelopes; join room with `createJoinRoomMessage(GAME_CHAT_DOMAIN, bareRoom)`.
- Handler: Consumes server `new-message` payloads and updates store.
- UI: `GameChat` auto-joins based on the current game via `bareRoomForGameChat` and `useWebsocket`.

### Frontend: Gameplay
- `GamePage`: Passes `bareRoomForGameplay(gameId)` to `useWebsocket`; the server composes to composite with `roomKey`.
- `GameplayWsHandler`: Consumes only server unions and updates stores for starting, started, state-update, and ended events.

## Build / Test Status

- Frontend build passes (TypeScript + Vite prod build) after gameplay migration.
- Backend builds clean for migrated domains during development; broader runtime checks are pending full test coverage.
- Test coverage for WS flows is limited. The final tightening plan includes targeted unit/integration tests for domain handlers and actions.

## Ergonomics & Type Robustness — Detailed Observations

1) Directional clarity and safety
  - Splitting unions eliminated accidental use of `user` fields on the client and made it obvious which messages can be sent by which side.
  - FE domain handlers became simpler and more focused (consume only one union each).

2) Decoupled backend actions
  - Actions now accept plain domain arguments and delegate all transport concerns to effects. This makes actions easy to test and reuse (e.g., calling from non-WS paths if needed).
  - Effects expose only the operations a domain should perform (e.g., join room, broadcast to a specific room), reinforcing domain boundaries.

3) Room semantics and correctness
  - Clients only know “bare rooms” (e.g., `game-123`), improving readability in payloads and avoiding accidental cross-domain overlaps.
  - The server composes composite keys, centralizing the room namespace policy and preventing domain bleed-through.

4) Type resilience and casts
  - Most casts were removed, but WS APIs still use `(data as any).payload` in a few places when extracting message-specific fields.
  - A small typed helper or discriminated inbound union per domain would allow exhaustive `switch` on `type` with strongly-typed payloads to remove casts entirely.

5) Developer experience
  - Domain WS APIs now read as compact intent: hydrate user → maybe build effects → call action.
  - Frontend code became easier to follow: send envelope; handler switches on server-only union; stores update.

## Code Review Checklist (Fresh Session)

Use this list to methodically review the implementation:

- Common/types
  - No remaining imports of `WsMessage` in any migrated domain.
  - Check each union’s payloads align with how the server emits and FE consumes (e.g., gameplay `playerMapping` uses `{ playerId: string, playerIndex }`).
  - `roomKey` is the only place we compose composite room identifiers.

- Backend infrastructure
  - WS manager’s envelope validation: confirm it enforces `domain`, `type`, and presence of `payload` (even if `null`). Consider improving error messages/log context.
  - `DomainAPI` still injects domain in outbound messages; ensure this is consistent with effects until we consolidate.

- Backend domains
  - Effects: Verify all `joinRoom/leaveRoom/broadcast` paths use `roomKey(domain, room)` consistently.
  - Actions: Confirm they do not depend on WS types and accept only plain, minimal arguments.
  - WS APIs: Confirm they hydrate `user`, validate/guard payloads, and delegate to actions with appropriate args. Check for remaining `any` casts and note where typed inbound unions would help.
  - Gameplay GameServer: Composite room usage; outbound payloads conform to server unions; countdown/start/end sequences function as expected.

- Frontend
  - `WebSocketService`: Verify message handler registration/deregistration lifecycle; room tracking stores composite keys; joining is triggered only when connected.
  - `useWebsocket`: Confirms handler added on ready and removed on cleanup; when `room` changes, re-join occurs.
  - Domain handlers: Only switch on server unions; no lingering usage of inbound-only fields.
  - Pages: `GamePage` and `GameChat` auto-join with bare rooms derived from game id.

## Now-Visible Cleanups & Insights

1) Auto-leave rooms on unmount/change
  - Add `leave-room` sends in `useWebsocket` cleanup when a `room` is provided. This prevents stale memberships on server side and reduces noise.

2) Stronger inbound typing in WS APIs
  - Define a discriminated inbound union per domain (e.g., `GameplayInbound = { type: 'move-request', payload: ... } | ...`).
  - In domain handlers, switch on `type` and get strongly-typed `payload` with no casts. This also simplifies runtime guards.

3) Consolidate outbound domain injection
  - Today both `DomainAPI` and effects ensure `domain` on outbound. Choose one (recommend effects-only), remove the other to avoid confusion and double work.

4) WebSocketService QoL
  - Add an optional outbound queue for messages attempted before the socket reaches OPEN; flush on open.
  - Consider typed helpers for common sends (e.g., `sendMove`, `sendCancelMoves`) to reduce repetition and enforce payload shapes at call sites.

5) Room helpers consolidation
  - Add `roomForGameplay(gameId)` and `roomForChat(gameId)` thin wrappers returning bare rooms to centralize the pattern.

6) Validation & telemetry
  - Add zod/io-ts validation for inbound C→S messages; in dev, log a clear error and ignore invalid messages; in prod, consider structured logs/metrics.
  - Consider light telemetry around joins/leaves and per-domain message throughput for observability.

## Proposed Final Phase (Tightening) Plan

Priority-Tagged Roadmap

- P0 (highest impact)
  - Outbound consolidation (S/M): Remove `DomainAPI` domain injection; effects own outbound scoping. Acceptance: single source of domain; no outbound mutation in infra.
  - Inbound typing (M): Add discriminated inbound unions per domain; WS APIs switch on `type` with typed `payload`. Acceptance: zero `(data as any)` casts in domain WS APIs.
- P1 (important)
  - Room lifecycle (S): In `useWebsocket`, send `leave-room` on unmount and when `room` changes. Acceptance: server membership prunes on navigation; logs show join/leave symmetry.
  - Runtime validation (M): zod/io-ts schemas for inbound C→S messages. Acceptance: invalid messages are rejected with clear logs; handlers assume validated payloads.
- P2 (QoL)
  - FE send queue + helpers (S): Queue outbound before OPEN; helpers like `sendMove`, `sendCancelMoves`. Acceptance: no lost messages on connect; simpler call sites.
  - Tests (M): Unit tests for actions (mocked effects) + light integration tests for WS APIs (hydrate user, effects called). Acceptance: green suite covering happy and invalid cases.

## Backlog / Revisit Later

- Room membership policy: Evaluate a manager-driven room membership model (automatic joins on domain events) versus command-driven joins; pick a consistent approach.
- ID type standardization: Audit `number` vs `string` for `userId`/`playerId` fields and normalize to one type across FE/BE.
- Schema/codegen: Consider generating TypeScript unions and zod schemas from a single source to reduce drift.
- Performance: Monitor payload sizes/frequencies (especially `game-state-update`); consider diffing or compression if needed.
- Security: Add per-room authorization checks to ensure only entitled users can join/broadcast in a room.

## Risks & Open Questions

- Dual domain injection paths: Effects + `DomainAPI` could cover mistakes but also hide them; consolidation is recommended to reduce cognitive load.
- Validation cost: Runtime validation adds CPU; likely negligible at current scale, but we can guard with dev-only schemas or toggle.
- Error reporting: For invalid C→S payloads, decide between silent drops with logs versus explicit error messages back to clients.

## Summary

## Testing Plan (Expanded)

- Actions (unit with mocked effects)
  - Chat: `postMessage` trims whitespace, enforces length cap, timestamps on server, calls `broadcastNewMessage` with correct args.
  - Gameplay: `queueMove` (requires mapping), `cancelQueuedMoves`, `undoLastQueuedMove` handle missing game gracefully and call server methods when available.
- WS APIs (light integration)
  - Hydrates `user` and rejects/ignores if absent for user-dependent actions.
  - Join/leave call the correct effect with bare room; effects compose composite room via `roomKey`.
  - Payload guards for missing/invalid fields (until zod/io-ts arrives).
- Frontend
  - `useWebsocket` joins when connected; on cleanup (post-tightening), sends leave-room.
  - Handlers properly switch on server-only unions; no reliance on inbound-only fields.

## Security & Authorization Notes

- Current assumption: authenticated users; no per-room access control in WS layer.
- Desired: enforce that gameplay/chat room membership corresponds to game participants; non-participants cannot join.
- Options: perform authorization checks in WS API join handlers, or centralize checks in `WebSocketManager` with domain hooks.

## Known Limitations

- Dual outbound domain injection (effects + DomainAPI) — slated for removal in final tightening.
- Some `(data as any)` casts in WS APIs — will be eliminated with discriminated inbound unions.
- FE send queue not implemented — small QoL risk (dropped messages pre-open).
- Runtime validation deferred — inbound payloads rely on guards; schemas will tighten this.

## Key Files

- Common
  - `common/types/websockets.ts` — envelope interfaces and `WsDomainHandler`.
  - `common/types/game-chat.ts`, `common/types/gameplay.ts`, `common/types/game-matchmaking.ts` — split unions.
  - `common/utils/room-key.ts` — `roomKey(domain, room)`.
  - `common/domains/game/utils.ts` — bare/composite room helpers.
- Backend
  - `backend/src/websocket/manager.ts` — hydrate envelopes and dispatch.
  - `backend/src/websocket/api.ts` — `DomainAPI`; to be simplified.
  - `backend/src/game-chat/ws-effects.ts`, `backend/src/gameplay/ws-effects.ts`, `backend/src/game-matchmaking/ws-effects.ts` — domain effects.
  - `backend/src/game-chat/game-chat-ws-api.ts`, `backend/src/gameplay/gameplay-ws-api.ts` — C→S handlers.
  - `backend/src/gameplay/actions/*` — plain-arg actions for gameplay.
  - `backend/src/gameplay/game-server.ts` — composite room usage; broadcasts.
- Frontend
  - `frontend/src/services/websocket-service.ts` — envelopes in/out; `joinRoom` uses `roomKey` for tracking.
  - `frontend/src/hooks/use-websocket.ts` — lifecycle and auto-join.
  - `frontend/src/pages/game/game-chat/*` — chat actions/handler/UI.
  - `frontend/src/game-ui/store/gameplay-ws-handler.ts`, `frontend/src/pages/game/game-page.tsx` — gameplay handler and join.

## Code Snippets (Illustrative)

Chat effects (excerpt)
```
function createGameChatEffects(wsActions: WsActions) {
  return {
    joinChatRoom(room: string) {
      wsActions.joinRoom(roomKey(GAME_CHAT_DOMAIN, room));
    },
    broadcastNewMessage(room: string, payload) {
      wsActions.broadcastToRoom(roomKey(GAME_CHAT_DOMAIN, room), {
        domain: GAME_CHAT_DOMAIN,
        type: 'new-message',
        payload: { room, ...payload },
      });
    },
  };
}
```

Chat action (excerpt)
```
async function postMessage(userId, username, room, content, effects) {
  const text = content.trim().slice(0, 500);
  if (!text) return;
  effects.broadcastNewMessage(room, {
    content: text,
    userId,
    username,
    timestamp: Date.now(),
  });
}
```

Gameplay WS API (excerpt)
```
const GameplayWsAPI = new DomainAPI(GAMEPLAY_DOMAIN, {
  'move-request': async (data) => {
    const { user, payload } = data;
    if (!user || !payload) return;
    await queueMove(Number(user.id), payload.sourceCoord, payload.direction);
  },
});
```

## FAQ (Short)

- Why split unions? To make direction explicit and let the type system prevent misuse.
- Why effects? They keep transport concerns out of actions, improving testability and safety (roomKey/domain scoping).
- Why bare rooms on FE? Cleaner payloads and no cross-domain collisions; server composes composite keys.
- Why remove DomainAPI injection? Single source of truth for outbound scoping reduces duplication/confusion.

## Changelog Pointers

- refactor(ws/chat): migrate to envelopes + effects
- chore(ws): minor fixes post chat migration
- refactor(ws/gameplay): split unions, adopt roomKey, and migrate WS API
- docs(ws): refactor review and next steps
- docs(ws): expand refactor review with detailed rationale, examples, checklist, and tightening plan

The refactor moves us to a clearer, more maintainable WebSocket architecture: direction is explicit, domain actions are testable and transport-agnostic, and room semantics are consistent and collision-free. A short tightening phase can remove the remaining rough edges (typing casts, duplicate domain injection, missing leave-room lifecycle) and add small QoL upgrades. With those in place, this will be a strong foundation for upcoming features like more complex gameplay events, spectating, and richer chat/system messaging.
