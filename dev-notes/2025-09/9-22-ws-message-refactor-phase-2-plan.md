# WebSocket Message Refactor — Groundwork Summary and Chat Migration Plan (Phase 2)

Date: 2025-09-22

## Executive Summary

We completed Phase 1 groundwork to clarify message direction, decouple backend actions from transport via domain-specific effects, and migrate the matchmaking domain. We also updated the frontend WebSocket service to the new envelope types and adjusted common join/leave helpers. This document summarizes the current state, decisions, implemented changes, outstanding breakages, and the agreed plan to migrate the Chat domain next (Phase 2), including an early addition of a `roomKey(domain, room)` helper.

## Current State Snapshot

- Envelopes are introduced and adopted in the infra and matchmaking domain:
  - `WsClientEnvelope`: client → server
  - `WsServerInbound`: hydrated on server (client → server + `user`)
  - `WsServerOutbound`: server → client
- Backend WS manager validates client messages to `WsClientEnvelope`, hydrates to `WsServerInbound`, and all outbound is `WsServerOutbound`.
- Matchmaking domain migrated to split client/server message unions and effects.
- Frontend WebSocket service now sends `WsClientEnvelope` and receives `WsServerOutbound`.
- Common join/leave helpers (`createJoinRoomMessage`/`createLeaveRoomMessage`) now produce `WsClientEnvelope`.
- Standardized `gameId` to `number` in matchmaking server payloads.

## Key Decisions to Date

- Direction is explicit at the envelope and domain union levels. Each side handles only its proper flow.
- Actions accept plain args and call domain-specific, transport-only effects. They no longer depend on `WsActions` directly.
- FE will not mirror the backend `DomainAPI` pattern. FE handlers remain simple, consuming server-only unions.
- Runtime validation (schema-level) deferred until after domain migrations; basic envelope shape is validated.
- Defer unification of “domain injection” for outbound messages (keep current approach during migrations).
- Defer decision on client-originated join/leave vs server-side side-effects for room membership until later.

## Implemented Changes (Phase 1 + groundwork)

- Common types
  - Added `WsClientEnvelope`, `WsServerInbound`, `WsServerOutbound` in `@common/types/websockets`.
  - Updated FE `WsDomainHandler` to consume `WsServerOutbound`.
- Backend infra
  - Manager hydrates inbound to `WsServerInbound` and exposes `WsActions` that send `WsServerOutbound`.
  - `DomainAPI.handleMessage` now receives `WsServerInbound`.
- Frontend infra
  - `frontend/src/services/websocket-service.ts` now:
    - Sends `WsClientEnvelope` and receives `WsServerOutbound`.
    - Dispatches by `domain` to FE `WsDomainHandler`s.
  - `common/websockets/message-types.ts` now returns `WsClientEnvelope` for `join-room`/`leave-room`.
- Matchmaking domain
  - Split unions in `@common/types/game-matchmaking`:
    - Client: `join-queue | leave-queue | early-start-vote`
    - Server: `queue-status | early-start-status | game-ready`
  - Implemented `createMatchmakingEffects` providing only allowed transport ops.
  - Refactored actions to plain args + effects (`joinQueue`, `leaveQueue`, `earlyStartVote`).
  - Ensured Redis key formats and ID conversion are localized and correct.
  - Standardized `gameId` to `number` in server payloads; FE navigates using `number`.

## Build / Test Status

- Backend build: Fails in non-migrated domains (chat, gameplay) due to `WsMessage` references and handler signatures expecting old shapes.
- Frontend build: Fails in non-migrated chat/gameplay modules for the same reason.
- Backend tests: Failing broadly due to in-progress refactor; expected until chat/gameplay migration completes.

## Known Breakages / Debt (Intentional)

- Chat domain still uses `WsMessage` and mixed-direction unions.
- Gameplay domain still uses old unions and expects `data.user` on client messages directly.
- `common/websockets/message-types.ts` is now envelope-based for join/leave, but chat/gameplay types still need splitting.
- Redundant domain injection: both `injectDomain()` and effects set `domain`. Cleanup deferred.

## Approved Design for Chat Migration (Phase 2)

- Domain: `GAME_CHAT_DOMAIN = 'game-chat'`
- Client → Server (`GameChatClientMessageType`)
  - `join-room`: `{ room: string }`
  - `leave-room`: `{ room: string }`
  - `post-message`: `{ room: string; content: string }` (renamed from old client-side “new-message” for clarity)
- Server → Client (`GameChatServerMessageType`)
  - `new-message`: `{ room: string; content: string; userId: number; username: string; timestamp: number }`
- Effects (backend)
  - `joinChatRoom(room: string)`
  - `leaveChatRoom(room: string)`
  - `broadcastNewMessage(room: string, { content, userId, username, timestamp })`
- Actions (backend)
  - `postMessage(userId: number, room: string, content: string, effects)`: validate inputs, construct payload with sender info + timestamp, broadcast.
- Backend WS API
  - Register only C→S handlers: `join-room`, `leave-room`, `post-message`.
  - Hydrate `user` from `WsServerInbound` and construct effects per request.
- Frontend
  - Actions send `WsClientEnvelope` for `post-message`.
  - Handler consumes only server→client `new-message` union and updates UI store accordingly.
- Validation (minimal for now)
  - Envelope shape check continues (required `domain`, `type`, `payload`).
  - In `postMessage`, trim/ignore empty content and apply a reasonable length cap (e.g., 500 chars).

## `roomKey(domain, room)` Helper (Early Addition)

- Purpose: Prevent accidental cross-talk between domains using the same bare room names.
- Shape: `roomKey(domain: string, room: string): string` → returns a stable composite key like `${domain}:${room}`.
- Adoption:
  - Use when joining/broadcasting/leaving rooms on both FE and BE for chat.
  - Optionally adopt in matchmaking immediately for `MATCHMAKING_ROOM_NAME` (e.g., `roomKey('game-matchmaking', 'queue')`).

## Migration Steps (Execution Order)

1) Types
- Update `common/types/game-chat.ts` to remove `WsMessage` and define split unions using envelopes.

2) Backend
- Add `backend/src/game-chat/ws-effects.ts` with the effects listed above.
- Add `backend/src/game-chat/actions/post-message-action.ts` using plain args + effects.
- Update `backend/src/game-chat/game-chat-ws-api.ts` to register only client→server handlers and construct effects.
- Introduce `common/utils/room-key.ts` and adopt it in chat (and matchmaking if low-effort).

3) Frontend
- Update `frontend/src/pages/game/game-chat/game-chat-actions.ts` to send envelopes (`post-message`).
- Update `frontend/src/pages/game/game-chat/game-chat-ws-handler.ts` to consume server-only `new-message` and update store.
- Ensure FE chat code paths no longer import or depend on `WsMessage`.

4) Verification
- Build BE and FE to resolve type errors.
- Manual test: join a chat room; send/receive messages; verify sender info and timestamps.

5) Optional Polish
- Consider small UI improvements (system messages, join/leave notifications) as server→client messages later.

## Risks & Mitigations

- Naming churn on chat messages (client `post-message`, server `new-message`): mitigated by scoped changes in types, WS API, and FE actions/handler.
- Incomplete cleanup of domain injection: defer until after chat/gameplay migrations; avoid mixing patterns in chat (prefer effects to set domain for now).
- Room key adoption: ensure consistent usage across join/send/broadcast; helper centralizes this pattern.

## Deferred Questions / Decisions

- Outbound domain injection: Consolidate on a single approach after migrations (likely effects or a typed wrapper).
- Room membership model: Decide later whether to centralize join/leave at the manager or continue domain-driven joins as commands.
- Runtime validation: Add domain schema validation for inbound messages post-migration; outbound optional.

## Verification Checklist (Post-Phase 2)

- No references to `WsMessage` remain in chat code paths (common, BE, FE).
- BE/FE builds pass without chat-related type errors.
- Manual E2E: joining/leaving rooms, posting messages, and receiving messages work; sender info appears correctly.
- Matchmaking still works as before (no regressions from roomKey adoption if applied).

## Next Milestones

- Phase 2 (Chat): Implement the steps above and stabilize builds.
- Phase 3 (Gameplay): Apply the split + effects pattern to gameplay; migrate handlers to consume `WsServerInbound`; add `GameplayEffects` for outbound.
- Phase 4 (Tightening): Introduce typed domain-bound outbound APIs (effects accept only server unions), consider consolidating domain injection, and add inbound runtime validation.

