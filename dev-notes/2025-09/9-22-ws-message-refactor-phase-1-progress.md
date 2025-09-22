# WebSocket Message Refactor — Phase 1 Progress

Date: 2025-09-22

## Background

- Direction ambiguity: Domain message type unions mixed client→server and server→client flows. This forced both BE and FE to register or consider messages they should never handle and led to dummy/no-op handlers.
- Coupling in actions: Backend actions accepted entire WebSocket envelopes (and `WsActions`), binding domain logic to transport concerns and making the code harder to test.
- Hydrated inbound confusion: `WsServerMessage` was recently introduced as an initital attempt at refactoring, and meant “server-handled inbound” (client→server + user). The name reads like server→client, which is confusing.

## Phase 1 Goals

- Make direction a first-class concept for one domain (matchmaking) as a pilot.
- Remove wrong-direction handlers and simplify mental model for each side.
- Keep infra changes minimal but rename the base envelopes to eliminate ambiguity.
- Start decoupling domain actions from transport, without overengineering.

## Decisions

- Envelopes
  - `WsClientEnvelope`: client → server messages (no user attached).
  - `WsServerInbound`: server-hydrated inbound messages (client → server + `user`).
  - `WsServerOutbound`: server → client messages.
  - Rationale: the names encode direction and purpose and avoid the earlier ambiguity around “server message”.

- Directional message unions (matchmaking only)
  - Client types: `GameMatchmakingClientMessageType = 'join-queue' | 'leave-queue' | 'early-start-vote'` and `namespace GameMatchmakingClient` with typed envelopes.
  - Server types: `GameMatchmakingServerMessageType = 'queue-status' | 'early-start-status' | 'game-ready'` and `namespace GameMatchmakingServer` with typed envelopes.
  - Rationale: each side handles only what it should; removes need for dummy cases.

- Thin handlers, plain args
  - BE WS handlers extract `user`/payload from `WsServerInbound` and call actions with plain arguments.
  - Rationale: keeps handlers transport-aware, actions domain-focused.

- Domain-specific ws-effects
  - Instead of passing `WsActions` into actions, actions receive a small, typed effects object that encapsulates only the transport operations they are allowed to perform for their domain (e.g., broadcast queue status, game-ready, remove users from matchmaking room).
  - Rationale: actions remain explicit and testable without being tied to WebSocket details; effects stay thin and transport-only.

## Status / Implemention progress

Phase 1 first pass is complete. Below is a summary of the changes we've made so far.

- Types (common)
  - Replaced `WsMessage`/`WsServerMessage` with `WsClientEnvelope`, `WsServerInbound`, `WsServerOutbound`.
  - `WsDomainHandler` updated to consume `WsServerOutbound`.

- Matchmaking types (common)
  - Split into `GameMatchmakingClient` and `GameMatchmakingServer` namespaces and corresponding `...MessageType` unions.
  - Removed the old combined union.

- Backend infra (targeted updates only)
  - `WsActions` now sends `WsServerOutbound`; `WsMessageHandler` receives `WsServerInbound`.
  - `DomainAPI.handleMessage` accepts `WsServerInbound`.
  - Manager validates inbound as `WsClientEnvelope` and hydrates `WsServerInbound`.

- Matchmaking backend
  - WS API registers only C→S messages and builds `GameMatchmakingEffects` per request.
  - Actions (`joinQueue`, `leaveQueue`, `earlyStartVote`) accept plain args and effects; no `WsActions` usage in actions.
  - New `backend/src/game-matchmaking/ws-effects.ts` implements transport operations:
    - `joinMatchmakingRoom()`, `broadcastQueueStatus(...)`, `broadcastEarlyStartStatus(...)`, `broadcastGameReady(...)`, `removeUsersFromMatchmakingRoom([...])`.
  - ID conversions corrected: Redis expects string userIds; room removal needs numeric userIds.

- Frontend matchmaking handler
  - Handles only server→client: `queue-status`, `early-start-status`, `game-ready`.

## Build State (after Phase 1)

- Intentional breakage remains in non-migrated areas:
  - Chat
    - `common/types/game-chat.ts` still uses `WsMessage` and defines envelopes incompatible with `WsServerOutbound`.
    - `backend/src/game-chat/game-chat-ws-api.ts` broadcasts a `ChatMessage` that isn’t typed as `WsServerOutbound`.
  - Gameplay
    - Actions and WS API still expect `data.user` on client messages; types aren’t split or hydrated yet.
  - Common room messages
    - `common/websockets/message-types.ts` references `WsMessage` (removed), needs to be moved to envelopes or migrated to domain-level effects.

## Rationale for Effects Pattern

- Explicit and direct: Actions call specific domain effects, not generic `WsActions` or implicit plumbing.
- Testable: Effects can be stubbed; actions are plain functions with clear inputs and observable outputs (calls to effects).
- Decoupled: Actions do not import global managers or WebSocket services. Only the WS API layer constructs the concrete effects.
- Lightweight: Avoids the complexity of advanced type-level registries or command/event generators while retaining most benefits.

## Open Questions

- Join/Leave strategy
  - Should `join-room`/`leave-room` remain generic infra-level messages handled centrally, or become domain-owned with side-effects expressed via effects? Gameplay currently needs domain-specific side-effects on join.

- Frontend handler typing
  - Should `WsDomainHandler` become generic per domain and consume `XxxServerMessage` unions, enforcing direction at compile time on the FE as well?

- Outbound typing tightness
  - Should domain effects accept only the domain’s `XxxServerMessage` unions to prevent accidental cross-domain message emits?

- Architecture unification
  - Keep `DomainAPI` only on the backend, or introduce an analogous abstraction on the frontend to unify handler shape?

- Runtime validation
  - When to introduce Zod/Valibot schemas for inbound (C→S) and optionally outbound (S→C)? Before or after gameplay migration?

- Room addressing
  - Keep single key semantics or adopt standardized `domain:room` keys to avoid collision if multiple rooms under the same domain appear?

- ID normalization
  - Standardize userId across layers (numbers in app logic, strings in Redis), and keep conversions localized.

## Likely Next Steps

- Chat domain (smaller scope)
  - Split chat message unions into client/server.
  - Update BE chat WS API to construct `GameChatEffects` and refactor actions (if any) to plain args + effects.
  - Update FE chat handler to consume server-only messages.
  - Replace `WsMessage` references with new envelopes.

- Gameplay domain (larger scope)
  - Split gameplay message unions into client/server.
  - Ensure BE handlers consume `WsServerInbound` with `user` properly typed.
  - Introduce `GameplayEffects` for server emits and room operations; refactor gameplay actions to plain args + effects.

- Common join/leave
  - Either migrate to envelopes and keep as infra utilities, or move fully to domain-owned effects and remove cross-domain duplication.

- Type tightening (follow-up)
  - Restrict effects/broadcast APIs to accept only domain server message unions.
  - Consider FE typed send wrappers per domain.
  - Add runtime validation for inbound messages; optionally for outbound.

## Risks & Notes

- Temporary breakage: Expected during domain-by-domain migration; keep changes scoped and commit frequently.
- UserId conversions: Be careful around Redis (strings) vs application logic/rooms (numbers). Localize conversions.
- Effects discipline: Keep effects transport-only; avoid business rules inside effects to preserve separation of concerns.

## How to Continue (dev workflow)

- Build and test:
  - `bash tools/build-all.sh` to surface TS errors across FE/BE.
  - `bash tools/test-all.sh` for unit tests (core/backend as configured).
- Migration cadence:
  - Apply the split + effects pattern to one domain at a time.
  - Remove wrong-direction handlers immediately to avoid confusion.
  - Prefer small, frequent commits with clear subjects.

