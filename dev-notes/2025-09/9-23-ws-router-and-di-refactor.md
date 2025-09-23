# WebSocket Routing + DI Tightening (Post-Phase 2)

Date: 2025-09-23

## Summary

We simplified the WebSocket stack by introducing a tiny, explicit router, inverting domain registration to export single handlers, and injecting dispatch into the WebSocketManager (no global routing). We also clarified the handler-side actions API by renaming `WsActions` to `ClientWsActions` with verbs that match intent. This reduces hops, makes the runtime path obvious, and consolidates outbound scoping in effects.

Changes at a glance:

- Replace `WebSocketAPI`/`DomainAPI` chain with a small `WsRouter` (domain → handler) and DI.
- Invert registration: each domain exports `handleXMessage`, server setup registers them.
- Pass router `dispatch` into `WebSocketManager` via constructor (explicit dependency).
- Rename `WsActions` → `ClientWsActions` with `join/leave/broadcast/reply`.
- Keep domain effects as the single source of outbound domain/roomKey composition.

## Rationale

- Reduce indirection: The previous chain (Manager → WebSocketAPI → DomainAPI → handler) added hops without material benefits. A simple router is easier to read and reason about.
- Improve testability: Explicit `handleXMessage` functions are trivial to unit-test; `WebSocketManager` accepts a dispatcher function for easier mocking.
- Clarify responsibilities: Effects own outbound concerns; handlers operate on typed inbound and plain effects; manager owns transport and rooms only.
- Ergonomics: `ClientWsActions` names now express intent clearly (join/leave/broadcast/reply), removing ambiguity.

## Key Diffs (Before → After)

Before: WebSocketAPI + DomainAPI chain

```ts
// manager.ts
handleWebSocketMessage(data, actionsForClient(client));

// api.ts
class WebSocketAPI { /* finds DomainAPI and calls handleMessage */ }
class DomainAPI { /* injects domain and calls a handler map */ }
```

After: Router + DI + explicit handlers

```ts
// router.ts
class WsRouter {
  register(domain: string, handler: (data, actions) => void) { /* ... */ }
  dispatch(data, actions) { /* domain map lookup */ }
}

// manager.ts
constructor(private dispatchFn: (data, actions) => void) {}
ws.on('message', () => this.dispatchFn(inbound, this.actionsForClient(client)));

// setup.ts (centralized)
const router = new WsRouter();
router.register(GAME_CHAT_DOMAIN, handleGameChatMessage);
router.register(GAMEPLAY_DOMAIN, handleGameplayMessage);
router.register(GAME_MATCHMAKING_DOMAIN, handleGameMatchmakingMessage);
const wsManager = new WebSocketManager((d, a) => router.dispatch(d, a));
```

Before: Actions naming

```ts
interface WsActions {
  joinRoom(roomId: string): void;
  leaveRoom(roomId: string): void;
  broadcastToRoom(roomId: string, data: WsServerOutbound): void;
  sendToSelf(data: WsServerOutbound): void;
}
```

After: Clear intent via verbs

```ts
interface ClientWsActions {
  join(roomId: string): void;
  leave(roomId: string): void;
  broadcast(roomId: string, data: WsServerOutbound): void; // from a handler
  reply(data: WsServerOutbound): void;                      // to the sender
}
```

Effects remain the single source of outbound domain/roomKey:

```ts
// game-chat/ws-effects.ts
ws.broadcast(roomKey(GAME_CHAT_DOMAIN, room), {
  domain: GAME_CHAT_DOMAIN,
  type: 'new-message',
  payload: { room, ...payload },
});
```

## Files Touched

- Added: `backend/src/websocket/router.ts` (WsRouter), `backend/src/websocket/setup.ts` (central setup)
- Updated: `backend/src/websocket/manager.ts` (DI dispatch), `backend/src/websocket/index.ts` (exports setup),
  domain WS APIs to export explicit handlers: `backend/src/game-chat/game-chat-ws-api.ts`,
  `backend/src/gameplay/gameplay-ws-api.ts`, `backend/src/game-matchmaking/game-matchmaking-ws-api.ts`
- Renamed actions interface + usages: `backend/src/websocket/types.ts` → `ClientWsActions` and all effect call sites

## Reasoning Details

1) Simpler routing beats generic layers
   - Directional envelopes + inbound unions already give us strong typing.
   - The extra `WebSocketAPI/DomainAPI` indirection obfuscated the flow; the router makes the path obvious.

2) Inversion improves readability and testing
   - Domains export `handleXMessage` with a typed inbound union.
   - Server wiring (`setup.ts`) is clear and central; handlers are easily unit-tested.

3) Stronger separation of concerns
   - `WebSocketManager`: transport/rooms/logging; no domain knowledge.
   - `WsRouter`: domain/type routing only.
   - `Effects`: own outbound scoping (domain + roomKey), guard domain boundaries.
   - `Handlers`: pure domain logic; typed `switch` over inbound `type`.

4) Clearer action naming
   - `join/leave/broadcast/reply` communicates intent and context (client-handler-originated vs server-originated broadcasts).

## Migration Notes

- We updated all effect modules and internal actions to the new `ClientWsActions` names.
- `serverBroadcastToRoom` remains for server-originated messages (e.g., gameplay tick/state). Optionally, we can add a server-effects wrapper later for symmetry.
- Legacy `websocket/api.ts` remains in repo but is not used in the current path; it was kept compiling for minimal churn.

## Future Considerations

- Validation: Add zod/io-ts schemas per inbound `type` to reject invalid payloads with clear logs.
- Naming polish (optional): `serverBroadcastToRoom` → `serverBroadcast` to align with client naming.
- Telemetry: Light counters for joins/leaves and per-type message rates.
- FE QoL: send queue + leave-room on cleanup (already noted in previous plan).

## Quick Examples

Domain handler (chat):

```ts
function handleGameChatMessage(msg: GameChatServerInbound, actions: ClientWsActions) {
  const fx = createGameChatEffects(actions);
  switch (msg.type) {
    case 'join-room':  fx.joinChatRoom(msg.payload.room); break;
    case 'leave-room': fx.leaveChatRoom(msg.payload.room); break;
    case 'post-message':
      if (!msg.user) return;
      const { room, content } = msg.payload;
      void postMessage(Number(msg.user.id), msg.user.username, room, content, fx);
      break;
  }
}
```

Manager wiring with DI dispatch:

```ts
const router = new WsRouter();
router.register(GAME_CHAT_DOMAIN, handleGameChatMessage as any);
// ...other domains
const wsManager = new WebSocketManager((data, actions) => router.dispatch(data, actions));
```

Effects own outbound `domain` + `roomKey`:

```ts
function createGameChatEffects(ws: ClientWsActions) {
  return {
    joinChatRoom: (room: string) => ws.join(roomKey(GAME_CHAT_DOMAIN, room)),
    broadcastNewMessage: (room: string, payload: ...) =>
      ws.broadcast(roomKey(GAME_CHAT_DOMAIN, room), { domain: GAME_CHAT_DOMAIN, type: 'new-message', payload: { room, ...payload } }),
  };
}
```

## Outcome

- Cleaner architecture with fewer layers and clearer names.
- Explicit, testable domain handlers; effects remain focused and authoritative for outbound scoping.
- DI-friendly manager that can swap routers/dispatchers easily.
- Backend build remains green with updated types.

