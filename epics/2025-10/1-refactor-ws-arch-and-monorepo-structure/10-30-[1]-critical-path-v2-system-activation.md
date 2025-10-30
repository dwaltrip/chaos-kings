# Critical Path: v2 System Activation

**Date:** 2025-10-30
**Status:** Ready for implementation
**Priority:** 🔴 CRITICAL - System currently non-functional

**Related Docs:**
- `10-27-[2]-frontend-ws-init-reconciliation.md` - Frontend WS init analysis
- `10-19-[2]-ws-infra-backend-implementation.md` - Backend WS infrastructure design
- `10-19-[3]-ws-infra-frontend-implementation.md` - Frontend WS infrastructure design
- `10-28-[1]-backend-domain-integration-notes.md` - Backend domain patterns
- `10-29-[2]-games-gameplay-integration-session-notes.md` - Latest domain integration

---

## Purpose

Complete the "last mile" infrastructure wiring to activate the v2 WebSocket system. All domain logic has been migrated (backend handlers, actions, ws-effects; frontend handlers, actions, stores), but the v2 WebSocket infrastructure is not connected. The system cannot currently start or function.

This tactical focuses exclusively on the **three critical blockers** preventing the system from running. All other improvements (TODOs, refactors, polish) are explicitly deferred.

---

## Current State

### What's Complete ✅

**Backend:**
- All domain handlers implemented (chat, matchmaking, gameplay, games, users, system)
- All domain actions migrated with branded types
- Domain ws-effects ready to broadcast
- `setupWebSocketV2()` fully implemented in `ws/server-bootstrap.ts`
- `wsBridge` singleton ready
- Auth plugin working (`plugins/auth.ts` sets `req.currentUser`)

**Frontend:**
- All domain handlers implemented
- Domain ws-effects using `wsBridge` (chat, matchmaking, gameplay, system)
- `useInitializeWsApp()` ready in `ws/client-bootstrap.ts`
- `wsBridge` singleton ready
- User store with `initializeUser()` action

### Critical Blockers 🔴

**Backend:**
1. **No server entry point** - `src/server.ts` doesn't exist, backend cannot start
2. **v2 WS server not wired** - `setupWebSocketV2()` exists but never called
3. **Old v1 infrastructure still in use** - `websocket-v0.1/` and `server-v0.1.ts`

**Frontend:**
1. **Wrong WS initialization** - Using v1 `useUserWebSocketInit()` instead of v2 `useInitializeWsApp()`
2. **Bridge never initialized** - `wsBridge.init()` never called, domain ws-effects likely failing
3. **Old v1 service still present** - `websocket-service.ts` creates duplicate connection

---

## Implementation Plan

### Phase 1: Backend Server Entry Point

**Goal:** Create working `server.ts` that starts Fastify and wires v2 WebSocket infrastructure.

**File:** `apps/backend/src/server.ts` (create new)

**Implementation:**

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import websocket from '@fastify/websocket';

import { databasePlugin } from '@/plugins/database';
import authPlugin from '@/plugins/auth';
import { setupWebSocketV2 } from '@/ws/server-bootstrap';
import { initializeGameCoordinator } from '@/domains/gameplay/game-coordinator';
import { logger, fastifyLoggerConfig } from '@/utils/logger';

// Import HTTP routes
import { systemRoutes } from '@/domains/system/system-routes';
import { userRoutes } from '@/domains/users/user-routes';
import { gameRoutes } from '@/domains/games/game-routes';

const PORT = Number(process.env.PORT) || 3131;

const fastify = Fastify({
  logger: fastifyLoggerConfig,
});

// Register plugins
fastify.register(cors, {
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
    : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
});

fastify.register(fastifyCookie);
fastify.register(websocket);
fastify.register(databasePlugin);
fastify.register(authPlugin); // CRITICAL: Sets req.currentUser for WS upgrade

// Register HTTP routes
fastify.register(systemRoutes, { prefix: '/api' });
fastify.register(userRoutes, { prefix: '/api' });
fastify.register(gameRoutes, { prefix: '/api' });

// Initialize v2 WebSocket server
const wsServer = setupWebSocketV2();

// Initialize game coordinator
initializeGameCoordinator();

// WebSocket route - CRITICAL AUTH FLOW
fastify.register(async function (fastify) {
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    // Auth plugin has already run on preHandler hook
    // req.currentUser is set if user has valid session cookie

    if (!req.currentUser) {
      connection.socket.close(1008, 'Unauthorized');
      logger.warn('[WS] Rejected unauthorized connection attempt');
      return;
    }

    // Pass authenticated user to v2 WS server
    // Server will generate connectionId and create handler context
    wsServer.handleConnection(connection.socket, req.currentUser);
  });
});

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    logger.info(`🚀 v2 Server running on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
```

**Key points:**

1. **Auth flow preserved:** The `authPlugin` runs on `preHandler` hook for ALL requests including WebSocket upgrades. It reads session cookies and sets `req.currentUser`.

2. **Connection handoff:** `wsServer.handleConnection(ws, req.currentUser)` passes the `User` object as "connection context". The v2 server internally:
   - Generates `connectionId`
   - Calls `createContext(user, connectionId)` to make handler context
   - Stores `getUserKey(user)` for `sendToUser()` calls

3. **Why this works:** From `ws-lib/server.ts:64-76`:
   ```typescript
   function handleConnection(ws: WebSocket, connectionContext: TConnectionContext) {
     const connectionId = generateConnectionId();
     const client: WsClient = {
       id: connectionId,
       userKey: getUserKey(connectionContext), // String(user.id)
       ws,
     };
     const context = createContext(connectionContext, connectionId); // { userId, connectionId }
   ```

**Reference files:**
- `apps/backend/src/server-v0.1.ts` - Working v1 reference (copy structure)
- `apps/backend/src/main.ts` - Stub showing intended pattern
- `apps/backend/src/ws/server-bootstrap.ts:25-50` - The `setupWebSocketV2()` function
- `apps/backend/src/ws-lib/server.ts:64-121` - Connection handling internals
- `apps/backend/src/plugins/auth.ts` - Auth plugin that sets `req.currentUser`

**Testing:**
```bash
cd apps/backend
npm run dev
# Should see: "🚀 v2 Server running on port 3131"
# Should NOT see any module errors
```

---

### Phase 2: Frontend v2 Client Initialization

**Goal:** Replace v1 WebSocket initialization with v2, maintaining auth flow sequencing.

**File:** `apps/frontend/src/App.tsx`

**Current (BROKEN):**
```typescript
import { useUserWebSocketInit } from '@/hooks/use-user-websocket-init';

function App() {
  const { isReady } = useUserWebSocketInit(); // ❌ v1 hook
  // ...
}
```

**Replace with (v2):**
```typescript
import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router';

import { HomePage } from '@/pages/home/home-page';
import { GameplayPage } from '@/pages/gameplay/gameplay-page';
import { GameListPage } from '@/pages/games-list/game-list-page';
import { JoinGamePage } from '@/pages/join-game/join-game-page';
import { useInitializeWsApp } from '@/ws'; // ✅ v2 hook
import { userStore } from '@/stores/user-store';

function App() {
  const { initialized: wsInitialized } = useInitializeWsApp(); // ✅ v2
  const [userReady, setUserReady] = useState(false);
  const location = useLocation();

  // Initialize user FIRST (establishes session cookie)
  useEffect(() => {
    userStore
      .getState()
      .actions.initializeUser()
      .finally(() => setUserReady(true));
  }, []);

  // Wait for BOTH user session AND websocket
  if (!wsInitialized || !userReady) {
    return <div className="p-5 text-center">Loading...</div>;
  }

  const isGamePage = location.pathname.match(/^\/games\/[^/]+$/);

  return (
    <div className="app">
      {!isGamePage && (
        <nav className="p-5 border-b border-gray-300 mb-5">
          <NavLink to="/" className="mr-5">
            Home
          </NavLink>
          <NavLink to="/games" className="mr-5">
            Games
          </NavLink>
          <NavLink to="/join-game" className="mr-5">
            Find Game
          </NavLink>
        </nav>
      )}

      <Routes>
        <Route index element={<HomePage />} />
        <Route path="games" element={<GameListPage />} />
        <Route path="games/:gameId" element={<GameplayPage />} />
        <Route path="join-game" element={<JoinGamePage />} />
      </Routes>
    </div>
  );
}

export { App };
```

**Critical sequencing explanation:**

From `10-27-[2]-frontend-ws-init-reconciliation.md`:

> In v1, the frontend initialization sequence was coupled so that newly created WebSocket connections could be linked with the corresponding `req.currentUser`:
>
> 1. Frontend calls `/api/users/me` (HTTP) → backend auth plugin runs → session created/validated
> 2. Session cookie set in browser
> 3. Frontend receives user data back
> 4. **THEN** WebSocket connection initiated → upgrade request includes session cookie
> 5. Backend can identify the user for this WS connection via `req.currentUser`

**Why this still works for v2:**

The auth plugin runs on `preHandler` hook for ALL requests (HTTP and WebSocket). When the WebSocket upgrade request arrives with the session cookie, the plugin:
1. Reads `SESSION_COOKIE_NAME` from cookies
2. Looks up session in SessionStore
3. Sets `req.currentUser` with user data
4. WS route handler can access `req.currentUser`

So the initialization order MUST be:
1. `userStore.actions.initializeUser()` runs (HTTP call to `/api/users/me`)
2. Session cookie is set in browser
3. `useInitializeWsApp()` creates WebSocket connection (includes session cookie)
4. Backend auth plugin reads cookie and sets `req.currentUser`
5. WS route handler passes `req.currentUser` to `wsServer.handleConnection()`

**Note:** Both effects run concurrently in the code above because React batches them. The important part is we wait for BOTH to complete before rendering the app. The `useInitializeWsApp` hook internally waits for connection to be established, which happens after the HTTP roundtrip.

**Reference files:**
- `apps/frontend/src/ws/client-bootstrap.ts:68-81` - `useInitializeWsApp()` implementation
- `apps/frontend/src/ws/client-bootstrap.ts:35-61` - `initializeWsClient()` function
- `apps/frontend/src/ws-lib/client.ts` - WSClient implementation
- `apps/frontend/src/stores/user-store.ts` - User store with `initializeUser()` action

---

### Phase 3: Cleanup Old v1 Infrastructure

**Goal:** Remove legacy WebSocket code to prevent confusion and bugs.

**Backend files to delete:**
- `apps/backend/src/websocket-v0.1/` (entire directory)
- `apps/backend/src/server-v0.1.ts`

**Frontend files to delete:**
- `apps/frontend/src/services/websocket-service.ts`
- `apps/frontend/src/services/ws-store.ts`
- `apps/frontend/src/hooks/use-user-websocket-init.ts`
- `apps/frontend/src/hooks/use-websocket.ts`

**Why safe to delete:**

Backend:
- `server-v0.1.ts` is replaced by new `server.ts`
- `websocket-v0.1/` is replaced by `ws/` + `ws-lib/`
- All domain handlers use v2 infrastructure

Frontend:
- `useUserWebSocketInit` is replaced by `useInitializeWsApp`
- `websocket-service.ts` is replaced by `ws/client-bootstrap.ts` + `ws-lib/client.ts`
- Domain ws-effects already use `wsBridge` from v2

**Verification before deletion:**
```bash
# Backend: Ensure no imports of old files
grep -r "websocket-v0.1\|server-v0.1" apps/backend/src --include="*.ts" | grep -v "node_modules"

# Frontend: Ensure no imports of old files
grep -r "use-user-websocket-init\|websocket-service\|ws-store" apps/frontend/src --include="*.ts" --include="*.tsx" | grep -v "node_modules"
```

If any imports found, update them to use v2 equivalents before deleting.

---

## Testing & Validation

### Backend Validation

**1. Server starts successfully:**
```bash
cd apps/backend
npm run dev
# Should see: "🚀 v2 Server running on port 3131"
# Should see: "[WS] Client connected: client-..." when frontend connects
```

**2. WebSocket connections authenticated:**
```bash
# Watch logs for:
# "[auth-plugin] User authenticated: <userId> Session ID: <sessionId>"
# "[WS] Client connected: client-..."
# Should NOT see "Rejected unauthorized connection attempt"
```

**3. Messages flow through handlers:**
Add temporary logging to a handler to verify:
```typescript
// apps/backend/src/domains/matchmaking/handlers.ts
'matchmaking:join-queue': (payload, ctx) => {
  console.log('[DEBUG] Join queue handler called:', ctx.userId); // ← Add this
  joinQueue(UserId(ctx.userId));
}
```

### Frontend Validation

**1. App loads without errors:**
```bash
cd apps/frontend
npm run dev
# Open browser console
# Should NOT see any wsBridge errors
# Should see: "[ws-service] connection established to ws://..."
```

**2. Domain actions work:**
Test a simple flow like joining matchmaking queue:
- Click "Find Game"
- Check browser console for outbound message
- Check backend logs for handler execution
- Verify state updates in UI

**3. Connection state observable:**
Add temporary UI to verify:
```typescript
import { useWsConnectionStore } from '@/ws-lib/connection-store';

const isConnected = useWsConnectionStore((state) => state.isConnected);
console.log('WS Connected:', isConnected); // Should be true after init
```

### End-to-End Smoke Test

**Matchmaking flow:**
1. Open browser → App loads (user initialized, WS connected)
2. Navigate to "Find Game" → Click join queue
3. Backend receives `matchmaking:join-queue` message
4. Backend broadcasts `matchmaking:status-update` back
5. Frontend handler updates matchmaking store
6. UI shows "In Queue" state

If this flow completes, the v2 system is functional.

---

## Acceptance Criteria

### Phase 1 (Backend)
- [ ] `apps/backend/src/server.ts` exists and follows the pattern above
- [ ] `npm run dev` starts server successfully on port 3131
- [ ] No module resolution errors in logs
- [ ] WebSocket route registered at `/ws`

### Phase 2 (Frontend)
- [ ] `App.tsx` uses `useInitializeWsApp()` instead of `useUserWebSocketInit()`
- [ ] User initialization runs before rendering app
- [ ] Frontend connects to backend WebSocket successfully
- [ ] No errors in browser console related to wsBridge

### Phase 3 (Cleanup)
- [ ] Old `websocket-v0.1/` directory deleted from backend
- [ ] Old `server-v0.1.ts` deleted from backend
- [ ] Old `websocket-service.ts`, `ws-store.ts`, `use-user-websocket-init.ts`, `use-websocket.ts` deleted from frontend
- [ ] No remaining imports of deleted files (verified with grep)

### System Functional
- [ ] Backend starts and accepts WebSocket connections
- [ ] Frontend connects with authenticated session
- [ ] Messages flow bidirectionally (client → server → client)
- [ ] At least one domain flow works end-to-end (e.g., matchmaking)
- [ ] Connection state observable in UI via `useWsConnectionStore`

---

## Known Limitations & Deferred Work

This tactical intentionally defers non-critical work to focus on system activation:

**Deferred to future sessions:**
- GameServer.onPlayerLeftRoom implementation (gameplay/actions/on-player-left.ts:15)
- User↔Game persistent lookup (currently in-memory Map, single-process limitation)
- Connection ID in gameplay actions (architectural smell noted in session notes)
- Chat room join/leave call sites (TODO in chat/components/game-chat.tsx:11)
- Matchmaking navigation improvements (replace window.location.href with React Router)
- Various state management refactors (gameplay store duplication, countdown setup)
- Database integration improvements (temp IDs, missing timestamps)
- Type improvements and polish

**Why deferred:**
These items don't block basic system functionality. Once the three critical path items are complete, the system can run and we can iterate on improvements.

---

## Risks & Mitigations

**Risk:** Auth flow doesn't work as expected for WebSocket upgrades
- **Mitigation:** Auth plugin is already tested in v1 (`server-v0.1.ts`). Pattern is proven. Add extra logging in Phase 1 to verify `req.currentUser` is set.

**Risk:** Timing issue between user init and WS connection
- **Mitigation:** `useInitializeWsApp` waits for connection open event. User init returns promise. Both must resolve before rendering app. Pattern is safe.

**Risk:** Breaking changes when deleting v1 infrastructure
- **Mitigation:** Grep for imports before deletion. Run full type check (`npm run typecheck`) after deletion. Keep v1 files in git history for easy rollback.

**Risk:** Domain handlers have bugs not caught until now
- **Mitigation:** Start with simple smoke test (matchmaking). Fix issues incrementally. Most handler logic was already tested during domain integration.

---

## Next Steps

1. **Implement Phase 1** - Create `server.ts`, verify backend starts
2. **Implement Phase 2** - Update `App.tsx`, verify frontend connects
3. **Smoke test** - Run matchmaking flow end-to-end
4. **Implement Phase 3** - Delete old infrastructure once smoke test passes
5. **Update epic docs** - Mark this work complete in `[PROGRESS].md`

After completion, the v2 system will be fully functional and we can focus on polish, features, and deferred improvements.

---

## References

**Tactical docs:**
- `10-27-[2]-frontend-ws-init-reconciliation.md` - Detailed auth flow analysis
- `10-19-[2]-ws-infra-backend-implementation.md` - Backend WS design
- `10-19-[3]-ws-infra-frontend-implementation.md` - Frontend WS design
- `10-28-[1]-backend-domain-integration-notes.md` - Domain integration patterns
- `10-29-[2]-games-gameplay-integration-session-notes.md` - Latest integration work

**Key implementation files:**
- Backend: `ws/server-bootstrap.ts`, `ws-lib/server.ts`, `plugins/auth.ts`
- Frontend: `ws/client-bootstrap.ts`, `ws-lib/client.ts`, `App.tsx`
- Reference: `server-v0.1.ts` (working v1 pattern), `main.ts` (v2 stub)

**Protocol & types:**
- `packages/protocol/` - Message definitions
- `packages/kernel/ids.ts` - Branded type definitions
- `apps/backend/src/ws/message-types.ts` - Backend message unions
- `apps/frontend/src/ws/message-types.ts` - Frontend message unions
