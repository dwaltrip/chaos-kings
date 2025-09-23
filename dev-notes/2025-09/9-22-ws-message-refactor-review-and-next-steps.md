# WebSocket Message Refactor — Review & Next Steps (Post-Phase 2/Gameplay)

Date: 2025-09-22

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

1) Room lifecycle (small)
  - In `useWebsocket`, when `room` is provided: send `leave-room` on cleanup and when `room` changes. Acceptance: server membership prunes on navigation.

2) Inbound typing (medium)
  - Create discriminated inbound unions per domain and update WS APIs to use them for switch-based handling. Acceptance: eliminate `(data as any)` in domain WS APIs.

3) Outbound consolidation (small/medium)
  - Remove `DomainAPI` domain-injection duplication in favor of effects-bound injection. Acceptance: single source of domain injection; updated tests/builds.

4) Runtime validation (medium)
  - Add zod/io-ts schemas for C→S messages per domain. Acceptance: invalid messages are rejected with clear logs; code paths assume validated payloads thereafter.

5) FE QoL (small)
  - Add send queue and common send helpers in `WebSocketService`. Acceptance: messages sent pre-open are delivered; helpers reduce boilerplate and errors.

6) Tests (medium)
  - Add unit tests for chat/gameplay actions with mocked effects and basic integration tests for WS APIs. Acceptance: green test suite covering happy paths and common invalid input scenarios.

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

The refactor moves us to a clearer, more maintainable WebSocket architecture: direction is explicit, domain actions are testable and transport-agnostic, and room semantics are consistent and collision-free. A short tightening phase can remove the remaining rough edges (typing casts, duplicate domain injection, missing leave-room lifecycle) and add small QoL upgrades. With those in place, this will be a strong foundation for upcoming features like more complex gameplay events, spectating, and richer chat/system messaging.
