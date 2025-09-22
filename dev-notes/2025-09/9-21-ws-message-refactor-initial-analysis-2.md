# WebSocket Message Refactor — Initial Analysis #2

- Author: AI (with Daniel)
- Date: 2025-09-21
- Scope: Current WebSocket message architecture (common + backend + frontend) with emphasis on matchmaking; options to split client/server directions; decisions and open questions.

**TL;DR**
- Today, domain message unions conflate client→server and server→client flows, which leaks into handlers on both BE/FE and reduces type safety. There’s a partial notion of WsServerMessage vs WsClientMessage, but naming and usage are inconsistent (WsServerMessage currently means “message handled by the server after hydration with user”, not server→client).
- The architecture will benefit from separating “direction” at three layers: base envelopes, domain message unions, and handler registries. The DomainAPI should handle only client→server messages; FE handlers should handle only server→client messages. Actions (both BE and FE) should be thin, context-agnostic, and take plain args.
- Below are concrete observations, 3+ refactor paths, and a set of decisions/questions to resolve before implementation.


**Current State**
- Base message types (common/types/websockets.ts):
  - `WsMessage`: `{ domain: string; type: string; payload: any }` used everywhere.
  - `WsServerMessage extends WsMessage { user: User }` — used by the server to augment inbound client messages with `user` from connection context.
  - `WsClientMessage extends WsMessage {}` — exists but not used consistently.
  - `WsDomainHandler` (FE): `handleMessage: (data: WsMessage) => void` — no differentiation for direction.
- Domain message unions mix directions:
  - `common/types/game-matchmaking.ts` defines `GameMatchmakingMessageType` as union of client and server message types: `join-queue`, `leave-queue`, `queue-status`, `game-ready`, `early-start-vote`, `early-start-status`.
  - `common/types/gameplay.ts` similarly mixes client (move/cancel/undo, join/leave-room) and server events (game-state-update, game-starting/started/ended).
  - `common/types/game-chat.ts` mixes chat events and join/leave-room; imports `User` but doesn’t use it (nit).
- Backend routing and handlers:
  - `backend/src/websocket/manager.ts` parses inbound JSON, validates shape, and injects `user` from the Fastify-augmented request; it passes a `WsServerMessage` to `handleWebSocketMessage`.
  - `backend/src/websocket/api.ts` DomainAPI routes by `domain` and `type`, but the handler signature uses `WsMessage` not `WsServerMessage`. It also “injects” `domain` into `broadcastToRoom` via `injectDomain` to ensure outbound messages carry the domain.
  - `GameMatchmakingWsAPI` registers handlers for both client and server-only types, with TODOs noting that server-only ones should be removed.
  - Backend action handlers (e.g., `join-queue`, `early-start-vote`) are mostly “fat” — they accept the raw `WsMessage` and often extract `data.user`, then perform both plumbing (join/broadcast) and app logic. This couples them to WebSocket context.
- Frontend:
  - `frontend/src/services/websocket-service.ts` routes messages by `domain` only; `send(message: WsMessage)` accepts a broad `WsMessage` type (not `WsClientMessage`).
  - `useWebsocket(domain, handler, room?)` registers per-domain handlers and optionally sends a generic join-room message via `createJoinRoomMessage`.
  - `GameMatchmakingWsHandler` handles both true server→client messages and a couple of client→server ones (with TODOs to remove); it extracts payloads and delegates to store actions — this is closer to the desired “thin handler” pattern.
  - `frontend/src/game-ui/store/gameplay-ws-handler.ts` is a good example of thin handler → plain actions with domain-agnostic function signatures.
- Cross-cutting:
  - `common/websockets/message-types.ts` defines generic `join-room` / `leave-room` messages (typed as `WsMessage`, not split by direction). Gameplay also includes `join-room`/`leave-room` in its domain union — a bit redundant/ambiguous.
  - Room naming helpers exist in `common/domains/game/utils.ts`.
  - No runtime validation for inbound messages (Zod/valibot, etc.), though a `validation` folder exists.


**Key Problems & Gaps**
- Direction ambiguity:
  - Message unions per domain include both flows, pushing server-only messages into the backend’s DomainAPI and client-only messages into FE handlers.
  - `WsServerMessage` naming implies server→client but is actually “server-handled inbound” (client→server augmented with `user`). This is error-prone.
- Type safety leakage:
  - Handlers accept `WsMessage`, then downcast via unions/casts. No compile-time guard that FE handler can only receive server→client types or that BE DomainAPI only handles client→server.
  - `WsActions.sendToSelf/broadcastToRoom` accept `WsMessage`, allowing accidental outbound of client-only types.
- Coupled action logic:
  - Many backend actions accept a `WsMessage` and pull user/payload from it. They should accept `(userId, args, ctx)` with only what they need.
- Inconsistent room join/leave representation:
  - Generic `createJoinRoomMessage` is good, but gameplay also handles `join-room` and performs side-effects (notify game server). It’s unclear whether join/leave is a generic domain or domain-specific.
- Minor nits:
  - `common/types/game-chat.ts` imports `User` but doesn’t use it.
  - Some payloads unnecessarily carry timestamp/user when context already supplies that data.
  - Domain duplication of “join-room” in gameplay vs common.


**Guiding Principles**
- Make “direction” a first-class concept at type level and module boundaries.
- Keep message handlers “thin”: extract user/payload → call action with plain args.
- Ensure DomainAPI handles only client→server messages; FE `WsDomainHandler` handles only server→client messages.
- Avoid passing raw `WsMessage` into actions; actions should be decoupled from WebSocket plumbing.
- Prefer discriminated unions per direction for type-safe switches.


**Three (Plus) Sensible Paths Forward**

1) Minimal Split + Progressive Tightening
- What:
  - Split each domain’s message type into two unions:
    - `XxxClientMessageType` (client→server)
    - `XxxServerMessageType` (server→client)
  - Split domain namespaces into explicit message interfaces extending either `WsClientMessage` or a new `WsServerOutbound` alias.
  - Remove server-only message registrations from backend DomainAPI; remove client-only cases from FE handlers.
  - Adjust FE actions to construct `WsClientMessage` only.
- Pros:
  - Low friction, fewer cascading changes; gets immediate clarity in the most visible places.
  - Enables gradual cleanups of handlers to be thinner without overhauling infra.
- Cons:
  - DomainAPI and `WsActions` still accept/emit loose `WsMessage` types.
  - Naming confusion for `WsServerMessage` remains unless addressed.
- Scope fit: Good for first domain (matchmaking) to validate ergonomics.

2) Envelope-Centric Refactor + DomainAPI Generics (Recommended)
- What:
  - Introduce explicit envelopes with precise naming:
    - `WsClientEnvelope<TType extends string = string, TPayload = unknown>` — base client→server message shape.
    - `WsServerInbound<TType, TPayload> = WsClientEnvelope<TType, TPayload> & { user: User }` — what the server processes.
    - `WsServerOutbound<TType extends string, TPayload>` — base server→client message shape (no user attached).
  - Update `WsServerMessage`/`WsClientMessage` naming (or deprecate) to avoid direction confusion.
  - Domain-specific unions:
    - `XxxClientMessage = WsClientEnvelope<XxxClientMessageType, XxxPayloadByType[Type]>` unions
    - `XxxServerMessage = WsServerOutbound<XxxServerMessageType, ...>` unions
  - DomainAPI becomes generic over the domain’s client message union. Its handler signature receives `WsServerInbound` (so `user` is available and typed). Its `WsActions`’s outbound methods accept only the domain’s server message union.
  - FE `WsDomainHandler<XxxServerMessage>` only processes the server union; FE send APIs accept only `XxxClientMessage`.
  - Begin migrating backend actions to plain args (e.g., `joinQueue({ userId })`) called from thin WS handlers.
- Pros:
  - Clean direction split with strong compile-time guarantees end-to-end.
  - Handlers and actions get the exact shapes they need.
  - Sets a scalable pattern for all domains.
- Cons:
  - Heavier upfront change (DomainAPI signature, WsActions typing, common types).
  - Requires careful staged migration to avoid breaking builds across BE/FE.
- Scope fit: Best long-term design; start with matchmaking, then extend to gameplay and chat.

3) Command/Event Pattern per Domain
- What:
  - Reframe as `Commands` (client→server) and `Events` (server→client) per domain.
  - Each domain exports `Command` and `Event` discriminated unions with factories; FE can only issue commands, BE can only emit events.
  - DomainAPI registers command handlers only; FE `WsDomainHandler` registers event consumers only.
  - Optional: generate type maps from a single declaration to avoid stringly-typed drift.
- Pros:
  - Very explicit mental model; maps to CQRS style.
  - Encourages clean decoupling and clearer semantics.
- Cons:
  - Larger conceptual shift; adds naming churn.
  - Similar implementation complexity to (2), with extra renaming overhead.

4) Room Management Consolidation (Complementary Step)
- What:
  - Treat `join-room` / `leave-room` as generic infra messages in a reserved domain (e.g., `ws-rooms`) handled entirely by the WebSocketManager.
  - Keep gameplay’s extra “on-player-joined-gameplay-room” behavior by having DomainAPI subscribe to a server-side room-join hook (no inbound message handling required in gameplay domain).
- Pros:
  - Separates plumbing (rooms) from domain logic fully.
- Cons:
  - Requires new mechanism to signal domain-specific side-effects on room state; more infra work.
- Note: Optional; can be a later follow-up after (2).


**Matchmaking Domain – Specific Observations**
- `common/types/game-matchmaking.ts` mixes `join-queue`, `leave-queue`, `early-start-vote` (client→server) with `queue-status`, `early-start-status`, `game-ready` (server→client).
- Backend `GameMatchmakingWsAPI` registers handlers for both directions with TODOs to remove.
- FE handler receives server messages and has stray client message cases with TODOs.
- Backend actions directly depend on `data.user` and `data.payload`, coupling to WS context. They should accept plain `userId` and args and return values or call `WsActions` for plumbing.


**Gameplay Domain – Specific Observations**
- `common/types/gameplay.ts` combines move/cancel/undo and room join/leave (client→server) with `game-starting/started`, `game-state-update`, `game-ended` (server→client) in one union.
- Backend `GameplayWsAPI` registers server-only messages as no-ops (TODO indicates these are not client-originated).
- FE `gameplay-ws-handler.ts` is a good “thin handler → plain action” example to emulate elsewhere.


**Game Chat – Specific Observations**
- `game-chat` types currently mix join/leave with chat messages; FE handler file not present (likely integrated in a page or earlier prototype). Backend sends `new-message` to a room; join/leave forwarded to `WsActions`.


**Critical Decisions / Questions**
- Envelope naming:
  - Adopt `WsServerInbound` (server-handled inbound, includes `user`) and `WsServerOutbound` (emitted to clients) to eliminate `WsServerMessage` ambiguity?
- Domain split granularity:
  - Keep join/leave in each domain or centralize room management?
  - If centralized, how to hook domain-specific reactions (e.g., notify game server when someone joins gameplay room)?
- DomainAPI generics:
  - Should `DomainAPI` be generic over ClientMessage union only, or both ClientMessage and ServerMessage unions to type its outbound `WsActions`?
- FE service routing and typing:
  - Keep routing by `domain` only, or also partition by `room`? Any need to scope handlers by domain+room for multi-room scenarios?
  - Should `WebSocketService.send` accept only `WsClientEnvelope`?
- Runtime validation:
  - Introduce Zod/Valibot schemas per message type? Validate inbound messages server-side before handling.
- Versioning / extensibility:
  - Any need for message version keys? Probably later, but worth a placeholder.


**Recommended Plan (Phased)**
- Phase 1 (Matchmaking pilot):
  - Define in `common/types/game-matchmaking.ts`:
    - `GameMatchmakingClientMessageType`: `join-queue | leave-queue | early-start-vote`
    - `GameMatchmakingServerMessageType`: `queue-status | early-start-status | game-ready`
    - Split message interfaces; client messages extend `WsClientEnvelope`, server messages extend `WsServerOutbound`.
  - Update `WsDomainHandler` to be generic over server message unions and update matchmaking FE handler to only handle server messages.
  - Update `GameMatchmakingWsAPI` to only register client message handlers.
  - Convert backend matchmaking action handlers to thin WS handlers + decoupled actions with plain args: `(userId: number, args)`.
  - Keep `WebSocketService` API shape but have `send` accept `WsClientEnvelope`.
  - Verify builds: `bash tools/build-all.sh` and fix types.
- Phase 2 (Gameplay + Chat):
  - Apply the same split and thin-handler pattern to gameplay and chat.
  - Remove server-only handlers from DomainAPIs; remove client-only cases from FE handlers.
- Phase 3 (Infra tightening):
  - Adopt envelope renames: introduce `WsClientEnvelope`, `WsServerInbound`, `WsServerOutbound` and deprecate current `WsServerMessage` naming.
  - Make `DomainAPI` generic over client union; optionally over server union to type `WsActions.broadcastToRoom/sendToSelf`.
  - Consider consolidating join/leave under room infra (optional).
  - Add runtime validation for inbound messages where risk is higher.


**Concrete Improvements to Make Along the Way**
- Base types (common/types/websockets.ts):
  - Rename and clarify envelopes: `WsClientEnvelope`, `WsServerInbound`, `WsServerOutbound`.
  - Update `WsDomainHandler<TServerMessage = WsServerOutbound>` to carry a server union generic.
- Domain types:
  - Split unions per direction and ensure message interfaces extend the correct envelope.
  - Add factory helpers for client commands and server events.
- Backend DomainAPI and WsActions:
  - DomainAPI generic over client union; handler signature `(data: WsServerInbound<...>, actions: WsActions<ServerUnion>)`.
  - `WsActions` generics so outbound methods only accept server union for that domain.
- Handlers → actions decoupling:
  - Extract `userId` and payload fields in the thin handler; call action with plain args; keep broadcast logic in handler or in an emitter helper close to handler (but not inside domain-agnostic actions).
- FE WebSocketService:
  - Type `send` to accept `WsClientEnvelope`.
  - Keep routing by domain; consider adding a room-aware handler registry if/when needed.
- Hygiene:
  - Remove unused imports (e.g., `User` in `game-chat` types) and unnecessary payload fields (e.g., timestamps where not used).
  - Normalize naming (kebab-case filenames are already followed).


**Risks / Migration Notes**
- Touches shared types → can cascade BE/FE build breaks. Mitigate via domain-by-domain rollout, starting with matchmaking.
- DomainAPI generics refactor increases scope. Consider landing envelope renames and domain splits first (Phase 1–2), then tighten DomainAPI types (Phase 3).
- Keep unit/integration checks focused on changed areas; use `tools/build-all.sh` frequently.


**Suggested Naming (to reduce confusion)**
- Client → Server: `WsClientEnvelope`
- Augmented inbound on server: `WsServerInbound`
- Server → Client (outbound): `WsServerOutbound`
- Domain unions: `GameMatchmakingClientMessage | GameMatchmakingServerMessage`, similarly for `Gameplay`, `GameChat`.


**Open Questions (to resolve before coding phases 2–3)**
- Should join/leave be exclusively infra-level (single `ws-rooms` domain) or remain duplicated in domains where side-effects are needed?
- Do we want FE routing by domain+room to avoid accidental cross-room event handling if multiple rooms under same domain are ever present?
- Do we want runtime message validation (Zod) now or after direction split to reduce scope?
- Should we introduce per-domain typed “senders” on FE (e.g., `matchmakingClient.sendJoinQueue()`), or stick with simple factories for now?


**Why this order?**
- Splitting unions and adopting envelope names gives immediate clarity and prevents mis-registrations (BE handling server-only, FE handling client-only).
- Matchmaking is a well-scoped domain to pilot the pattern and downstream impacts.
- DomainAPI generics and infra consolidation can be layered on once the split proves ergonomic.


**References / Touchpoints**
- Current mixed unions and TODOs:
  - `common/types/game-matchmaking.ts`
  - `backend/src/game-matchmaking/game-matchmaking-ws-api.ts`
  - `frontend/src/pages/join-game/game-matchmaking-ws-handler.ts`
  - `common/types/gameplay.ts`, `backend/src/gameplay/gameplay-ws-api.ts`, `frontend/src/game-ui/store/gameplay-ws-handler.ts`
  - `common/types/game-chat.ts`, `backend/src/game-chat/game-chat-ws-api.ts`
- Infra:
  - `backend/src/websocket/manager.ts`, `backend/src/websocket/api.ts`, `backend/src/websocket/types.ts`
  - `frontend/src/services/websocket-service.ts`, `frontend/src/hooks/use-websocket.ts`
  - `common/websockets/message-types.ts` (join/leave)


**Next Suggested Action**
- Implement Phase 1 on the matchmaking domain (types split, thin handlers, FE handler cleanup), verify builds/tests, and use that as the baseline pattern for gameplay/chat.

