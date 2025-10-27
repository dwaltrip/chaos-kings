# Frontend WS Init Reconciliation

**Date:** 2025-10-27
**Status:** Blocked - Revisit during / after Backend Integration of v1 app logic
**Related Work:** Phase 2 WebSocket Infrastructure (frontend), v1 → v2 app integration

---

## Purpose

We recently imported the v1 React app into the v2 frontend codebase. The app still assumes the legacy `WebSocketService` singleton is responsible for standing up the socket, while the new v2 infrastructure expects `useInitializeWsApp()` to run once at startup and seed the `wsBridge`.

The primary challenge is ensuring newly created WebSocket connections can be linked to their users on the backend (via `req.currentUser`). In v1, this was achieved by calling `/api/users/me` before initializing the WebSocket connection to establish a session. This document explains the current discrepancies and captures the dependency on backend integration that blocks migration work.

---

## Dependencies

**Dependent on / coupled to:** Backend v1/v2 integration and auth pattern clarification

In v1, the frontend initialization sequence was coupled so that newly created WebSocket connections could be linked with the corresponding `req.currentUser`:

1. Frontend calls `/api/users/me` (HTTP) → backend auth plugin runs → session created/validated
2. Session cookie set in browser
3. Frontend receives user data back
4. **THEN** WebSocket connection initiated → upgrade request includes session cookie
5. Backend can identify the user for this WS connection via `req.currentUser`

The `useUserWebSocketInit` hook enforced this ordering to guarantee the session existed before the WS connection attempt. We cannot finalize the frontend init flow until we understand:

- How the v2 backend WS server links connections to users during connection upgrade
- Whether the auth plugin can/should run on WS upgrade requests to set `req.currentUser`
- What the proper initialization sequence should be for v2

Once backend integration clarifies the user identification pattern, this tactical can be unblocked.

---

## Current Situation

- `App.tsx` calls `useUserWebSocketInit()`, a v1-era hook that:
  1. Hydrates the user store by calling `userStore.actions.initializeUser()`, which makes an HTTP request to `/api/users/me` to establish the session.
  2. Lazily creates the legacy `WebSocketService` singleton via `getWebSocketService()`.
  3. Resolves once `WebSocketService.onReadyOrNow()` completes.

- During Phase 3.1 frontend migration work, most components were already migrated away from the legacy service. Only 3 files still import `getWebSocketService()`:
  - `hooks/use-user-websocket-init.ts` (the init hook itself)
  - `services/websocket-service.ts` (the service definition)
  - `hooks/use-websocket.ts` (a wrapper hook that's barely used)

- The v2 stack (`apps/frontend/src/ws/**`) is already in place. Domain ws-effects send messages through `wsBridge`, and typed handler maps are ready to receive server traffic. However, `useInitializeWsApp()` is never called, so the bridge is never initialized.

- The user store (`domains/users/user-store.ts`) is still needed for v1 UI flows (username prompts, matchmaking forms, gameplay ownership) and currently receives its initial load signal from `useUserWebSocketInit`.

**Migration Surface:** Smaller than initially thought. The main work is rewiring the init sequence in `App.tsx` and removing the legacy service files.

---

## Goals

1. **One Boot Path:** `useInitializeWsApp()` should execute exactly once at app startup and replace every usage of `getWebSocketService`.
2. **Explicit User Bootstrap:** The user store should be initialized independently (no hidden coupling inside websocket hooks).
3. **Legacy Surface Removal:** Delete `WebSocketService`, `getWebSocketService`, `wsStore`, and `useWebsocket` once replacements exist.
4. **Clear Sequencing:** Document the proper initialization order based on v2 backend auth requirements.
5. **Observable State:** Ensure the UI can still surface connection readiness using `useWsConnectionStore`.

---

## Recommended Migration Sequence

**NOTE:** These steps are deferred until backend integration clarifies the auth pattern. The sequence below assumes we'll follow a similar pattern to v1 (user init before WS connection), but this may change.

### 1. Wire the New Hook in `App`

- Replace the legacy hook with the v2 hook.
- Call `userStore.actions.initializeUser()` in a separate effect so the responsibilities remain distinct.
- Determine proper sequencing based on backend auth requirements.
- Example sketch (may need adjustment):

```tsx
function App() {
  const { initialized: wsInitialized } = useInitializeWsApp();
  const [userReady, setUserReady] = useState(false);

  useEffect(() => {
    userStore.getState().actions
      .initializeUser()
      .finally(() => setUserReady(true));
  }, []);

  if (!wsInitialized || !userReady) {
    return <LoadingScreen />;
  }

  return <Routes>{/* ... */}</Routes>;
}
```

### 2. Excise the Legacy Service

- Remove `apps/frontend/src/services/websocket-service.ts`, `ws-store.ts`, and the `useUserWebSocketInit` hook entirely.
- Remove `hooks/use-websocket.ts` (barely used, v2 uses static handler maps).
- Update imports to fail fast so we can track any remaining consumers.

### 3. Connection Indicators

- Replace any UI that referenced `wsStore` with selectors from `useWsConnectionStore`.
- Example:

```ts
const isConnected = useWsConnectionStore((state) => state.isConnected);
```

### 4. Room Join Sequencing

- Audit any remaining places that call `joinRoom`/`leaveRoom` on the old service (should be minimal/none based on Phase 3.1 work).
- Ensure all room joins use system domain ws-effects (`systemWsEffects.joinRoom`).

---

## Open Questions

1. **User Identification for WebSocket Connections:** How does v2 backend link WebSocket connections to their users (e.g., `req.currentUser`)? Do we need to preserve the v1 pattern of calling `/api/users/me` before WS init to establish the session, or is there a different approach? This determines whether we must enforce user-first initialization or can run them in parallel.

---

## Next Actions

**Deferred until backend integration:**

1. Clarify how v2 backend identifies users for WebSocket connections (session-based vs post-connection identification vs other)
2. Document the required initialization sequence based on backend requirements
3. Update `App.tsx` to call `useInitializeWsApp()` with proper sequencing
4. Delete legacy service files once migration is complete

This work should be revisited during the backend v1/v2 integration phase when the user identification pattern is established.

Tracking these tasks here will keep the frontend aligned with the architecture decisions made in `10-19-[3]-ws-infra-frontend-implementation.md` and prevent regressions while we continue integrating v1 and v2 codebases.
