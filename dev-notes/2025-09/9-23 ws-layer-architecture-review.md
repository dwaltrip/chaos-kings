**user**

This feels like a good time to pause and do a quick pass reivew over the entire WebsocketManager + WebSocketAPI + DomainAPI + WsActions, etc code. How are these abstractions looking? How can we improve them?

- WsActions feels a little clunky / not fully thought out
- The chain of calls that happen starting in `ws.on('message', {})`. e.g. "handleWebSocketMessage -> websocketAPI.handleMessage -> domainAPI.handleMessage -> actual handler" chain feels a bit convoluted...
- any additionally learnings / insifghts from the new "ws effects" that we can consider?
- are the abstraction names + structure clear?

Please carefully look over all of this and lets disucss your findings. Prefer ``` code blocks w/ well formatted whitespace over inline code snippets (very brief blocks are fine).

--------------------------------------

**codex**

Here’s a quick health check + concrete ways to tighten the WS layer, with small,
 focused code sketches.

Observations
- Clarity: Directional envelopes + domain effects are working well. The per-doma
in inbound unions removed casts and make handlers safer.
- Naming/roles: Two broadcast paths exist (client-context vs server-originated).
 Naming and signatures could be clearer.
- Layering: The Manager → WebSocketAPI → DomainAPI → handler chain is a bit indi
rect for the value it adds.
- WsActions: Mixed responsibilities (join/leave + “broadcast from client context
” + “reply to client”). Feels under-specified as an interface boundary.
- Effects: Great abstraction point. We can lean into them more (own domain + roo
mKey; optionally expose typed sends).

Improvements

1) Clarify broadcast semantics (client vs server)
- Keep two distinct operations; name them distinctly everywhere.

```ts
// backend/src/websocket/types.ts
type RoomId = string;

interface ClientWsActions {
  join(roomId: RoomId): void;
  leave(roomId: RoomId): void;

  // Broadcast initiated while handling a client message (uses client log context)
  broadcast(roomId: RoomId, data: WsServerOutbound): void;

  // Respond only to the sender
  reply(data: WsServerOutbound): void;
}

// Server-originated broadcasts (outside a client handler)
interface ServerWsActions {
  broadcast(roomId: RoomId, data: WsServerOutbound): void;
  sendToUser(userId: string, data: WsServerOutbound): void;
  removeUserFromRoom(userId: string, roomId: RoomId): void;
}
```

```ts
// backend/src/websocket/manager.ts (rename + wire methods clearly)
private broadcastFromClient(roomId: string, data: WsServerOutbound, from: WsClient) { ... }
public  serverBroadcast(roomId: string, data: WsServerOutbound) { ... }
```

2) Rename WsActions methods for consistency
- Current names mix manager internals and public intent. Prefer short, consistent verbs.

```ts
// Rename within ClientWsActions provided to handlers
join   -> join
leave  -> leave
broadcastToRoom -> broadcast
sendToSelf      -> reply
```

3) Collapse WebSocketAPI + DomainAPI into a single typed router
- Keep a thin “router” layer with one job: route by domain + type to a strongly-typed handler.
- Benefits: less indirection, simpler mental model, easy to scan.

```ts
// common: use existing inbound unions
type InboundByDomain = {
  'game-chat': GameChatServerInbound;
  'gameplay':  GameplayServerInbound;
  'game-matchmaking': GameMatchmakingServerInbound;
};

type Handler<D extends keyof InboundByDomain> =
  (data: InboundByDomain[D], actions: ClientWsActions) => void;

type DomainHandlers<D extends keyof InboundByDomain> = {
  [T in InboundByDomain[D]['type']]:
    (data: Extract<InboundByDomain[D], { type: T }>, actions: ClientWsActions) => void;
};

class WsRouter {
  private domains = new Map<keyof InboundByDomain, DomainHandlers<any>>();

  register<D extends keyof InboundByDomain>(domain: D, handlers: DomainHandlers<D>) {
    this.domains.set(domain, handlers);
  }

  dispatch(data: WsServerInbound, actions: ClientWsActions) {
    const handlers = this.domains.get(data.domain as keyof InboundByDomain);
    if (!handlers) return;

    const h = (handlers as any)[data.type];
    if (h) h(data as any, actions);
  }
}
```

- Manager usage:

```ts
// backend/src/websocket/manager.ts
ws.on('message', (raw) => {
  const envelope = validateClientEnvelope(JSON.parse(raw.toString()));
  const inbound: WsServerInbound = { ...envelope, user: client.user! };
  this.router.dispatch(inbound, this.actionsForClient(client));
});
```

- Handlers keep their per-type Extract<> signatures, so payloads stay typed with
out casts.

4) WsEffects own outbound scoping (fully)
- Now that DomainAPI no longer injects domain, codify that effects are the only place that:
  - Compose `roomKey(domain, room)`
  - Set `domain` on server outbound
- This is already true in your effects; just ensure there are no exceptions.

```ts
// backend/src/game-chat/ws-effects.ts (already like this)
function createGameChatEffects(ws: ClientWsActions) {
  return {
    join: (room: string) => ws.join(roomKey(GAME_CHAT_DOMAIN, room)),
    leave: (room: string) => ws.leave(roomKey(GAME_CHAT_DOMAIN, room)),
    broadcastNewMessage: (room: string, payload: ...) =>
      ws.broadcast(roomKey(GAME_CHAT_DOMAIN, room), {
        domain: GAME_CHAT_DOMAIN,
        type: 'new-message',
        payload: { room, ...payload },
      }),
  };
}
```

5) Optional: pass effects to handlers directly
- Avoid repeating `createEffects(wsActions)` in each case by standardizing the h
andler signature to receive effects. This is taste—current approach is fine, but
 this tightens ergonomics.

```ts
type GameChatHandlers = {
  'post-message': (
    data: Extract<GameChatServerInbound, { type: 'post-message' }>,
    fx: ReturnType<typeof createGameChatEffects>
  ) => Promise<void>;
  'join-room': (
    data: Extract<GameChatServerInbound, { type: 'join-room' }>,
    fx: ReturnType<typeof createGameChatEffects>
  ) => void;
  // ...
};
```

Router would create effects once per dispatch and pass them in.

6) Tighten validation and error reporting (small QoL)
- Leverage inbound discriminants to select a zod schema per `type` before calling the handler.
- For dev: log a clear validation error; for prod: consider quiet drop + metric.

```ts
const schemas = {
  'post-message': z.object({ payload: z.object({ room: z.string(), content: z.st
ring() }) }),
  // ...
};

const schema = (schemas as any)[data.type];
if (schema) {
  const parsed = schema.safeParse(data);
  if (!parsed.success) { log.warn(...); return; }
}
```

7) Naming polish
- Consider aligning terms for clarity:
  - WebSocketManager → WsHub (or keep Manager)
  - WebSocketAPI → WsRouter (single layer)
  - DomainAPI → remove in favor of typed DomainHandlers map
  - WsActions → ClientWsActions / ServerWsActions (split roles)

8) Minimal docs in code (short “why”lines)
- Add 1–2 line comments at each abstraction boundary:
  - Manager: “Transport + connection + rooms; no domain specifics”
  - Router: “Routes by domain + type; no mutations; no domain knowledge”
  - Effects: “Domain-scoped network ops; own domain + roomKey”
  - Handlers: “Pure domain behavior; typed inbound; call actions/effects”

What to change now vs later
- Now:
  - Rename ClientWsActions methods (join/leave/broadcast/reply) for clarity.
  - Rename manager internals to `broadcastFromClient` and keep `serverBroadcast`
 as-is.
  - Replace WebSocketAPI + DomainAPI with a single WsRouter (or keep DomainAPI b
ut simplify into typed domain-specific handler maps).
- Later:
  - Add zod validation keyed by inbound `type`.
  - Optional server “effects” wrapper for symmetry.
  - FE send queue + leave-room on cleanup (already in next steps list).

Net result
- Fewer layers, clearer naming, and typed dispatch reduce mental overhead.
- Effects remain the single outward-facing place to touch the network for a doma
in.
- Router becomes the obvious single hop from Manager to domain logic.

If you’re aligned, I can take the small renames + consolidate WebSocketAPI/Domai
nAPI into a single `WsRouter` in a follow-up PR, or we can do a lighter step fir
st (rename actions and manager broadcast methods) and stop there.

--------------------------------------

**user**
lets talk more about simplifying WebsocketAPI and DomainAPI, and the concept of a "router".

also what do you think of the current setup for how DomainAPI is concretely used? e.g:
```ts
const GameChatWsAPI = new DomainAPI<GameChatClientMessageType>(
  GAME_CHAT_DOMAIN,
  { 'post-message': ..., }
);
```

We are manually calling the `createGameChatEffects` fn for each handler... hmmm

Lots of different things to look at it! Overall the code is definitely a lot better than how it was before

--------------------------------------

**codex**
Totally agree — the new shape is much cleaner. Here’s how we can simplify the WebSocketAPI/DomainAPI into a small, typed “router”, and remove the repetition around creating effects in every handler.

Router Concept (typed, single hop)
- Replace WebSocketAPI + DomainAPI with a single WsRouter.
- Route by domain + type to a strongly-typed handler (no casts).
- Build effects once per dispatch and pass them to the handler.

```ts
// common (conceptual)
type InboundByDomain = {
  'game-chat': GameChatServerInbound;
  'gameplay': GameplayServerInbound;
  'game-matchmaking': GameMatchmakingServerInbound;
};

// handlers receive a specific inbound variant ('type' narrowed via Extract)
type DomainHandlers<D extends keyof InboundByDomain> = {
  [T in InboundByDomain[D]['type']]:
    (ctx: {
      data: Extract<InboundByDomain[D], { type: T }>;
      actions: ClientWsActions;
      effects: unknown; // domain-specific effects type will be injected
    }) => void | Promise<void>;
};

class WsRouter {
  private domains = new Map<
    string, { handle: (data: WsServerInbound, actions: ClientWsActions) => void; }
  >();

  register<D extends keyof InboundByDomain, E>(
    domain: D,
    createEffects: (actions: ClientWsActions) => E,
    handlers: DomainHandlers<D> & Record<string, any>,
  ) {
    this.domains.set(domain, {
      handle: (data, actions) => {
        const fx = createEffects(actions);
        const h = handlers[data.type];
        if (h) h({ data: data as any, actions, effects: fx });
      },
    });
  }

  dispatch(data: WsServerInbound, actions: ClientWsActions) {
    const d = this.domains.get(data.domain);
    if (d) d.handle(data, actions);
  }
}
```

Manager integration (one clear hop)
```ts
// backend/src/websocket/manager.ts
ws.on('message', (raw) => {
  const env = validateClientEnvelope(JSON.parse(raw.toString()));
  if (!client.user) return;
  const inbound: WsServerInbound = { ...env, user: client.user };
  router.dispatch(inbound, this.actionsForClient(client));
});
```

Cleaner WsActions
- Rename for clarity and split client vs server operations (names match intent).
- This removes the clunky feel and clarifies when a broadcast is “from a client 
handler” vs “server-originated”.

```ts
// backend/src/websocket/types.ts
type RoomId = string;

interface ClientWsActions {
  join(roomId: RoomId): void;
  leave(roomId: RoomId): void;
  broadcast(roomId: RoomId, msg: WsServerOutbound): void; // from a handler
  reply(msg: WsServerOutbound): void;                      // to the sender
}

interface ServerWsActions {
  broadcast(roomId: RoomId, msg: WsServerOutbound): void; // server-originated
  sendToUser(userId: string, msg: WsServerOutbound): void;
  removeUserFromRoom(userId: string, roomId: RoomId): void;
}
```

Domain registration (no repeated createEffects calls)
- The router provides effects to each handler via ctx.effects, so handlers don’t
 need to construct them.

```ts
// backend/src/game-chat/register.ts
router.register('game-chat', createGameChatEffects, {
  'join-room': ({ data, effects }) => {
    effects.joinChatRoom(data.payload.room);
  },
  'leave-room': ({ data, effects }) => {
    effects.leaveChatRoom(data.payload.room);
  },
  'post-message': async ({ data, effects }) => {
    const { user } = data;
    if (!user) return;
    const { room, content } = data.payload;
    await postMessage(Number(user.id), user.username, room, content, effects);
  },
});
```

Effects remain single source of outbound truth
- They own `domain` + `roomKey` composition; handlers stay transport-agnostic.

```ts
// backend/src/game-chat/ws-effects.ts
function createGameChatEffects(ws: ClientWsActions) {
  return {
    joinChatRoom: (room: string) => ws.join(roomKey(GAME_CHAT_DOMAIN, room)),
    leaveChatRoom: (room: string) => ws.leave(roomKey(GAME_CHAT_DOMAIN, room)),
    broadcastNewMessage: (room: string, payload: { content: string; userId: numb
er; username: string; timestamp: number; }) =>
      ws.broadcast(roomKey(GAME_CHAT_DOMAIN, room), {
        domain: GAME_CHAT_DOMAIN,
        type: 'new-message',
        payload: { room, ...payload },
      }),
  };
}
```

How this improves the current DomainAPI usage
- Today:
  - We instantiate `new DomainAPI(name, handlers)` and manually call `createGame
ChatEffects(wsActions)` inside each handler.
  - The chain (Manager → WebSocketAPI → DomainAPI → handler) adds hops without a
dding meaningful capability.
- With the router:
  - One hop: Manager → router → handler.
  - Effects creation happens once per dispatch, passed to handlers — no repetiti
on.
  - Per-type handler signatures remain fully typed via `Extract<... , { type: '.
..' }>`.

Optional ergonomic refinements
- Context object: If helpful, handlers can receive a richer `ctx`:

```ts
type HandlerCtx<D, T, E> = {
  data: Extract<D, { type: T }>;
  actions: ClientWsActions;
  effects: E;
  log?: ScopedLogger;
};
```

- Server effects for gameplay broadcasts (symmetry):

```ts
function createGameplayServerEffects(ws: ServerWsActions, room: string) {
  return {
    broadcastState: (p: GameplayServer.GameStateUpdate['payload']) =>
      ws.broadcast(room, { domain: GAMEPLAY_DOMAIN, type: 'game-state-update', p
ayload: p }),
  };
}
```

Summary
- Replace WebSocketAPI + DomainAPI with a single typed WsRouter to reduce hops a
nd improve clarity.
- Rename WsActions to client/server flavored interfaces with clear verbs.
- Build effects once per message and pass them to handlers to eliminate repetiti
on.
- Effects remain the single place that composes `domain` + `roomKey`.

If you like this direction, I can draft the WsRouter + minimal adapter so we can
 migrate domain-by-domain without big bang changes.

--------------------------------------

**user**

This looks like it could be good. I might just need another cup of coffee, but I find the TS stuff for DomainHandlers a bit confusing

--------------------------------------

**codex**

Makes sense — the generic DomainHandlers can feel heavy. Here are simpler altern
atives, from “least clever + most readable” to “typed but ergonomic,” with pros/
cons and small code sketches.

Option 1: Simple Router + Per‑Domain “handle” (no generics in the router)
- Router only routes by domain; each domain owns its switch and typing.
- Easiest to read; types live in the domain file where context is clear.

```ts
// backend/src/websocket/ws-router.ts
class WsRouter {
  private domains = new Map<string, (data: WsServerInbound, actions: ClientWsActions) => void>();

  register(domain: string, handle: (data: WsServerInbound, actions: ClientWsActions) => void) {
    this.domains.set(domain, handle);
  }

  dispatch(data: WsServerInbound, actions: ClientWsActions) {
    const handle = this.domains.get(data.domain);
    if (handle) {
      handle(data, actions);
    }
  }
}
```

```ts
// backend/src/game-chat/ws-register.ts
import { GameChatServerInbound } from '@common/types/game-chat';

function registerGameChat(router: WsRouter) {
  router.register('game-chat', (data, actions) => {
    const fx = createGameChatEffects(actions);
    const msg = data as GameChatServerInbound;

    switch (msg.type) {
      case 'join-room':
        fx.joinChatRoom(msg.payload.room);
        break;
      case 'leave-room':
        fx.leaveChatRoom(msg.payload.room);
        break;
      case 'post-message': 
        if (!msg.user) return;
        postMessage(
          Number(msg.user.id),
          msg.user.username,
          msg.payload.room,
          msg.payload.content,
          fx,
        );
        break;
    }
  });
}
```

Pros
- Minimal indirection; super readable.
- Types are close to the domain logic.
- No head-scratching generics.

Cons
- “Typed enough” but not fully constrained by the router.
- You can accidentally switch on a wrong `type` without compiler help.

Option 2: Light “Ctx” helper + Per‑Domain Handlers map
- Keep domain typing local; use a tiny Ctx helper so handlers get a nice payload
 type without heavy generics.
- Router still stays simple; it just calls into a domain dispatcher.

```ts
// backend/src/websocket/ctx.ts
type Ctx<I, T extends I extends { type: infer K } ? K : never, E> = {
  data: Extract<I, { type: T }>;
  actions: ClientWsActions;
  effects: E;
};
```

```ts
// backend/src/game-chat/ws-register.ts
type Inbound = GameChatServerInbound;
type Fx = ReturnType<typeof createGameChatEffects>;

const handlers = {
  'join-room': ({ data, effects }: Ctx<Inbound, 'join-room', Fx>) => {
    effects.joinChatRoom(data.payload.room);
  },
  'leave-room': ({ data, effects }: Ctx<Inbound, 'leave-room', Fx>) => {
    effects.leaveChatRoom(data.payload.room);
  },
  'post-message': async ({ data, effects }: Ctx<Inbound, 'post-message', Fx>) => {
    if (!data.user) return;
    const { room, content } = data.payload;
    await postMessage(Number(data.user.id), data.user.username, room, content, effects);
  },
};

function registerGameChat(router: WsRouter) {
  router.register('game-chat', (data, actions) => {
    const fx = createGameChatEffects(actions);
    const msg = data as Inbound;
    const h = (handlers as any)[msg.type];
    if (h) h({ data: msg, actions, effects: fx });
  });
}
```

Pros
- Handlers are typed per `type` via Ctx; no casts inside cases.
- Router remains simple; effects created once per dispatch.
- Generics exist, but hidden in a tiny reusable helper.

Cons
- One local `as any` where we index handler by `msg.type` (typical TS tradeoff).

Option 3: Fully Typed Router (the “DomainHandlers” approach)
- The most type-safe; router enforces that handler keys match union `type`s.
- Heavier generics; can be harder to read/maintain.

```ts
// Conceptual: register<D extends keyof InboundByDomain>(domain: D, handlers: Do
mainHandlers<D>)
router.register('game-chat', createGameChatEffects, {
  'post-message': ({ data, effects }) => { ... },
  'join-room':    ({ data, effects }) => { ... },
  'leave-room':   ({ data, effects }) => { ... },
});
```

Pros
- Maximum compile-time safety across the board.

Cons
- Generic signatures can feel confusing in everyday use.
- Harder for new contributors.

Recommendation
- Choose Option 1 or 2 for readability. Option 2 gives you nice typed payloads w
ithout router complexity.
- Keep these additional simplifications (independent of router choice):
  - Rename `WsActions` → `ClientWsActions` with verbs: `join`, `leave`, `broadca
st`, `reply`.
  - Keep `serverBroadcastToRoom` for server-originated sends (optionally wrap in
 server effects later).
  - Effects are the single source of outbound truth (compose `roomKey` + set `do
main`).

Small, incremental step (good first change)
- Switch to Option 1 now (simple router; domain switch owns typing).
- If we want a bit more ergonomics, add the tiny `Ctx<>` helper (Option 2) in ea
ch domain module.

Example (Option 1 + renamed actions)
```ts
// backend/src/websocket/types.ts
interface ClientWsActions {
  join(roomId: string): void;
  leave(roomId: string): void;
  broadcast(roomId: string, msg: WsServerOutbound): void;
  reply(msg: WsServerOutbound): void;
}
```

```ts
// backend/src/websocket/manager.ts (method names match)
private broadcastFromClient(roomId: string, data: WsServerOutbound, from: WsClie
nt) { ... }
public  serverBroadcast(roomId: string, data: WsServerOutbound) { ... }
```

```ts
// backend/src/game-chat/ws-effects.ts
function createGameChatEffects(ws: ClientWsActions) {
  return {
    joinChatRoom: (room: string) => ws.join(roomKey(GAME_CHAT_DOMAIN, room)),
    leaveChatRoom: (room: string) => ws.leave(roomKey(GAME_CHAT_DOMAIN, room)),
    broadcastNewMessage: (room: string, payload: ...) =>
      ws.broadcast(roomKey(GAME_CHAT_DOMAIN, room), {
        domain: GAME_CHAT_DOMAIN,
        type: 'new-message',
        payload: { room, ...payload },
      }),
  };
}
```

If you want, I can implement Option 1 (simple WsRouter + domain-level register f
unctions) so we can feel it in code. If it reads well, we keep it; if we want a 
touch more type help, we add the small `Ctx<>` helper (Option 2).

