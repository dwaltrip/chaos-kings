# WebSocket Message Refactor — Review & Next Steps (Post-Phase 2/Gameplay)

Date: 2025-09-22

## Executive Summary

We completed the envelope-based WebSocket refactor for Chat and Gameplay after establishing the groundwork and migrating Matchmaking. Directionality is now explicit, backend actions are transport-agnostic via domain-specific effects, and room naming is standardized with a `roomKey(domain, room)` helper. Frontend handlers consume server-only unions, and sending uses client envelopes. Builds are green for FE and stable for BE pending broader tests. This document summarizes what changed, key decisions, ergonomics/type observations, and proposes a focused “final tightening” phase, plus a backlog of follow-ups.

## Scope & Outcomes to Date

- Directional envelopes in common types:
  - `WsClientEnvelope` (client → server), `WsServerInbound` (hydrated with `user`), `WsServerOutbound` (server → client).
- Domains migrated off mixed `WsMessage` usage:
  - Matchmaking (earlier), Chat (Phase 2), Gameplay (now).
- Backend domains use effects to join/leave/broadcast; actions receive plain args (no transport coupling).
- Room naming standardized with `roomKey(domain, room)` to prevent cross-domain collisions.
- Frontend WebSocketService sends envelopes and dispatches by `domain`; domain handlers consume outbound-only unions.

## Implemented Changes (By Area)

- Common
  - `@common/types/websockets`: Envelopes + FE `WsDomainHandler` signature.
  - `@common/types/game-matchmaking`: Split into `GameMatchmakingClient`/`Server` unions.
  - `@common/types/game-chat`: Split into `GameChatClient`/`Server` unions; client uses `post-message`, server uses `new-message`.
  - `@common/types/gameplay`: Split into `GameplayClient`/`Server` unions; updated payloads; removed `WsMessage`.
  - `@common/utils/room-key.ts`: `roomKey(domain, room)` helper.
  - `@common/domains/game/utils.ts`: `bareRoomForGameChat`, `bareRoomForGameplay`; `roomNameFor...` composes with `roomKey`.

- Backend Infra
  - WS manager hydrates client messages to `WsServerInbound` (adds `user`) and dispatches via `DomainAPI`.
  - `DomainAPI` injects `domain` on outbound (temporary duplication with effects until consolidation).

- Backend Domain: Matchmaking
  - Effects (`createMatchmakingEffects`) and actions (`joinQueue`, `leaveQueue`, `earlyStartVote`).
  - Adopted `roomKey(GAME_MATCHMAKING_DOMAIN, 'queue')` in effects.

- Backend Domain: Chat
  - Effects (`createGameChatEffects`): `joinChatRoom`, `leaveChatRoom`, `broadcastNewMessage` using composite room.
  - Action `postMessage(userId, username, room, content)`: trims/limits content; timestamps on server.
  - WS API: Registers only C→S handlers; hydrates user; builds effects per request.

- Backend Domain: Gameplay
  - Effects (`createGameplayEffects`): `joinGameplayRoom`, `leaveGameplayRoom` using composite room.
  - Actions refactor to plain args:
    - `queueMove(userId, sourceCoord, direction)`
    - `cancelQueuedMoves(userId)`
    - `undoLastQueuedMove(userId, gameId)`
  - WS API: Registers only C→S handlers; hydrates user; delegates to actions; join/leave via effects.
  - GameServer: `roomName = roomKey('gameplay', 'game-${id}')`; `playerMapping` payload aligned (`playerId: string`).

- Frontend Infra
  - `WebSocketService`: Sends `WsClientEnvelope`; receives `WsServerOutbound`; domain-based handlers.
  - `WebSocketService.joinRoom(domain, room)`: stores composite key via `roomKey`.
  - `useWebsocket(domain, handler, room?)`: joins room on ready; cleaned deps to include `room`.

- Frontend: Chat
  - Actions send `post-message` envelopes; join uses `createJoinRoomMessage(GAME_CHAT_DOMAIN, room)`.
  - Handler consumes server-only `new-message`; UI renders `username`.
  - Auto-join chat room via `useWebsocket` in `GameChat`.

- Frontend: Gameplay
  - `GamePage` joins gameplay room using bare room; server composes via `roomKey`.
  - Handler consumes only server unions (`game-starting`, `game-started`, etc.).

## Build / Test Status

- FE build: passes (vite + TS check).
- BE build: type-checked during work; gameplay/chat related errors resolved. Broader runtime tests pending.
- Tests: Gameplay/Chat do not have unit tests for WS flows yet; can be added in tightening phase.

## Ergonomics & Type Robustness — Observations

- Directional clarity improved:
  - C→S and S→C unions prevent accidental cross-direction usage.
  - FE handlers don’t deal with inbound shapes or `user` on client messages anymore.
- Decoupled backend actions:
  - Plain-arg actions easier to test and reuse.
  - Effects contain transport-only ops; scoped and domain-safe.
- Room model clarity:
  - Clients send bare rooms; server composes with `roomKey(domain, room)`.
  - Avoids collisions and keeps FE payloads clean.
- Type robustness:
  - End-to-end envelope types reduce implicit coupling, but some casts remain in WS APIs when extracting payloads.
  - Final pass could strengthen the inbound handler typing per message type to eliminate `(data as any)`.
- Developer ergonomics:
  - Domain WS APIs are simpler; each handler hydrates user and calls a narrowly-typed action.
  - FE feels clearer with server-only unions; minimal code churn to adopt envelopes on send.

## Code Review Checklist (Fresh Session)

- Common/types
  - Confirm each domain split has no lingering `WsMessage` imports.
  - Verify payload shapes match current UI and server logic (e.g., gameplay `playerMapping`).
- Backend
  - WS manager: envelope validation sufficient for now? Any log noise or gaps?
  - DomainAPI: Note the domain injection duplication with effects; acceptable short-term.
  - Effects: Verify consistent `roomKey` usage and domain scoping.
  - Actions: Validate args-only signatures; no transport access; correct error handling/logging.
  - GameServer: Room key composition; payloads align to server unions; countdown/start/end broadcasts OK.
- Frontend
  - `WebSocketService`: handler registration/deregistration correctness; room tracking; join timing.
  - Domain handlers: Only consume outbound unions; correct payload usage.
  - GamePage / Chat: Confirm auto-join and bare-room usage; UI uses correct fields.

## Now-Visible Cleanups & Insights

- Auto-leave rooms on unmount:
  - Add `leave-room` send in `useWebsocket` cleanup when `room` is provided.
- Stronger inbound typing in WS APIs:
  - Introduce per-domain inbound union discriminants to avoid `(data as any)` casts.
- Consolidate outbound domain injection:
  - Decide on a single approach (effects or DomainAPI wrapper) and remove duplication.
- FE WebSocketService improvements:
  - Optional send queue for messages before connection is OPEN.
  - Stronger typing for `addMessageHandler(domain, handler)` via domain-specific overloads (post-consolidation).
- Room helpers consolidation:
  - Consider a typed helper like `roomFor('gameplay', gameId)` to avoid manual string composition.
- Validation:
  - Add runtime schema validation per message (zod/io-ts) once unions are stable.
- Logging/telemetry:
  - Add structured logs around domain joins/leaves and message rates.

## Proposed Final Phase (Tightening) Plan

1) Room lifecycle
- Auto-send `leave-room` on unmount/room change in `useWebsocket` for gameplay/chat.

2) Inbound typing
- Add per-domain inbound discriminated types and update DomainAPI registrations to use them (remove `(data as any)` casts).

3) Outbound consolidation
- Pick effects-first for outbound injection and remove DomainAPI domain-injection duplication.

4) Runtime validation
- Add schemas for C→S messages in each domain; log or reject invalid payloads cleanly.

5) FE QoL
- Add optional send queue in `WebSocketService`.
- Add tiny helpers for common sends (e.g., `sendMove`, `sendCancelMoves`) that enforce message shape.

6) Tests
- Add unit tests for domain actions (chat/gameplay) with mocked effects.
- Add light integration tests for WS API handlers (hydrate user, call effects/actions with correct args).

## Backlog / Revisit Later

- Room membership policy: Decide whether joins/leaves should be centralized by the manager or remain domain-driven commands.
- Standardize ID types across payloads: audit `number` vs `string` for `userId`/`playerId` and align everywhere.
- Consider codegen for unions and validation schemas to avoid drift.
- Performance: Monitor broadcast sizes/frequency; consider compression or diffing for large state updates.
- Security: Add per-room authorization checks (ensure users can only join rooms they’re entitled to).

## Risks & Open Questions

- Mixed domain injection: Keeping both effects and DomainAPI injection could mask mistakes; consolidation in the final phase recommended.
- Validation cost: Runtime validation adds overhead; consider sampling/only-in-dev modes if needed.
- Error handling strategy: How should invalid C→S payloads be reported to clients (error messages vs silent drops)?

## Summary

The refactor has clarified message direction, reduced coupling, and standardized room semantics. The system now has cleaner boundaries and is easier to reason about and test. A brief tightening phase will eliminate minor duplication, strengthen runtime and compile-time guarantees, and add a few QoL improvements, leaving a solid foundation for future features.

