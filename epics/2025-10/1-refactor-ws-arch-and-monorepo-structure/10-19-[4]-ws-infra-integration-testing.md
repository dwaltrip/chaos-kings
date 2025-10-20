# WS Infrastructure Integration & Testing

**Date:** 2025-10-19
**Phase:** Phase 2.3 - Integration & Testing
**Status:** Ready for Implementation

---

## Context & Goal

**Where we are:** Backend and frontend WS infrastructure are both complete and individually working. Now we need to verify everything works together end-to-end.

**What we're testing:** The complete WebSocket flow across all domains:
- Messages route correctly from client → backend → domain handlers
- Backend can send messages → frontend handlers receive them
- Multi-client scenarios work (multiple browser windows)
- Connection resilience (reconnection, message queuing)
- UI integration (connection state visible to components)

**Planning reference:** See `10-19-[1]-ws-infra-planning.md` for full context and success criteria.

---

## Dependencies

Both backend (Phase 2.1) and frontend (Phase 2.2) implementations must be complete.

---

## Scope

### What We're Testing

**Infrastructure verification:**
- Message routing (client → server → handlers, server → client → handlers)
- Multi-connection support (multiple tabs per user)
- Room operations (join, leave, broadcast to room)
- Reconnection after disconnect
- Message queuing when offline
- Connection state reflected in UI

**Per-domain verification:**
- Chat domain: Send message, receive broadcast
- Matchmaking domain: Join queue, receive updates
- Gameplay domain: Join game room, receive state updates
- System domain: Connection lifecycle, room operations

**Important:** We're testing WS infrastructure only. Domain actions are stubbed - this is expected!

### What's NOT in Scope
- Business logic testing (actions are stubbed)
- Full end-to-end user flows (requires unstubbed actions)
- Performance/load testing
- Production deployment
- Removing v1 code

---

## Test Scenarios

### Scenario 1: Basic Message Routing

**Goal:** Verify messages route correctly in both directions.

**Setup:**
1. Backend running with v2 WS server
2. Frontend app running with v2 client
3. User authenticated and connected

**Test Steps:**

1. **Client → Server:**
   - Frontend sends `chat:send-message` via wsBridge
   - Backend chat handler receives message with typed payload
   - Backend stubbed action is called
   - Verify in backend logs: "Chat handler called" (or similar)

2. **Server → Client:**
   - Backend sends message via `wsBridge.broadcast()` (trigger manually or via handler)
   - Frontend chat handler receives message with typed payload
   - Frontend stubbed action is called
   - Verify in browser console: "Chat message received" (or similar)

**Expected Results:**
- ✅ Messages reach correct domain handlers (both directions)
- ✅ Handlers receive properly typed payloads
- ✅ Stubbed actions are called (proves routing works)
- ✅ No type errors, no runtime errors

**Validation:**
- Check backend logs for handler calls
- Check browser console for handler calls
- Inspect network tab for message format

---

### Scenario 2: Multi-Connection Support

**Goal:** Verify multiple tabs per user work correctly.

**Setup:**
1. Open 2 browser windows with same authenticated user
2. Both connect to backend

**Test Steps:**

1. **Verify separate connections:**
   - Check backend logs: should see 2 distinct connectionIds
   - Each window can send messages independently

2. **Broadcast to all:**
   - Tab 1 sends message that triggers `wsBridge.broadcast()`
   - Both Tab 1 and Tab 2 receive the broadcast
   - Verify in both browser consoles

3. **Broadcast excluding sender:**
   - Tab 1 sends message that triggers `wsBridge.broadcast(msg, { excludeConnectionId })`
   - Only Tab 2 receives the message
   - Tab 1 does NOT receive it
   - Verify in both browser consoles

**Expected Results:**
- ✅ Each tab gets unique connectionId
- ✅ Both tabs can send/receive independently
- ✅ Broadcasts reach all tabs
- ✅ Exclusion works (sender tab doesn't receive own broadcast)

**Validation:**
- Backend logs show multiple connections per user
- Both browser consoles show received messages
- Sender console shows exclusion works

---

### Scenario 3: Room Operations

**Goal:** Verify room management works (join, leave, broadcast to room).

**Setup:**
1. Open 2 browser windows (can be same or different users)
2. Define a test room ID (e.g., `ROOM_123`)

**Test Steps:**

1. **Join room:**
   - Tab 1: Call `wsBridge.rooms.join('ROOM_123', connectionId)` via handler/action
   - Tab 2: Call `wsBridge.rooms.join('ROOM_123', connectionId)` via handler/action
   - Verify backend logs show both connections in room

2. **Broadcast to room:**
   - Trigger `wsBridge.broadcastToRoom('ROOM_123', message)`
   - Both Tab 1 and Tab 2 receive message
   - Open Tab 3 (not in room) - does NOT receive message
   - Verify in all browser consoles

3. **Leave room:**
   - Tab 1: Leave room via `wsBridge.rooms.leave('ROOM_123', connectionId)`
   - Broadcast to room again
   - Only Tab 2 receives message (Tab 1 no longer in room)

4. **Disconnect cleanup:**
   - Close Tab 2 (or disconnect)
   - Verify backend logs: Tab 2's connectionId removed from all rooms
   - Room should be empty or removed

**Expected Results:**
- ✅ Connections can join/leave rooms
- ✅ Room broadcasts only reach room members
- ✅ Disconnect auto-removes from all rooms
- ✅ Room cleanup works (empty rooms removed)

**Validation:**
- Backend logs show join/leave operations
- Browser consoles show selective message delivery
- Backend logs show cleanup on disconnect

---

### Scenario 4: Connection Resilience

**Goal:** Verify reconnection and message queuing work.

**Setup:**
1. Frontend connected to backend
2. Connection state indicator visible in UI

**Test Steps:**

1. **Auto-reconnection:**
   - Kill backend server (Ctrl+C)
   - Watch frontend UI: should show "Disconnected" or "Connecting..."
   - Restart backend server
   - Frontend should auto-reconnect
   - Connection state indicator should show "Connected"
   - Verify in browser console: reconnection logs

2. **Message queuing:**
   - Kill backend server
   - Frontend sends message via wsBridge (e.g., chat message)
   - Check browser console: "WebSocket not connected, queueing message"
   - Restart backend server
   - Frontend reconnects and flushes queue
   - Backend should receive the queued message
   - Verify in backend logs: message received after reconnection

3. **Exponential backoff:**
   - Keep backend down
   - Watch browser console for reconnection attempts
   - Verify delay increases: ~1s, ~2s, ~4s, ~8s, etc.
   - Max attempts reached → stops trying (after ~10 attempts)

**Expected Results:**
- ✅ Frontend auto-reconnects after disconnect
- ✅ Connection state visible in UI (connecting/connected/disconnected)
- ✅ Messages queued when offline
- ✅ Queue flushed on reconnect
- ✅ Exponential backoff delays work
- ✅ Max attempts respected

**Validation:**
- UI shows connection state changes
- Browser console shows reconnection attempts and backoff delays
- Backend receives queued messages after reconnect

---

### Scenario 5: UI Integration

**Goal:** Verify connection state is properly exposed to React components.

**Setup:**
1. Frontend app running
2. Connection status indicator visible in UI

**Test Steps:**

1. **Connection states:**
   - App starts → "Connecting..." appears in UI
   - Connection established → "Connected" appears (or indicator disappears)
   - Kill backend → "Disconnected" appears
   - Restart backend → "Connecting..." → "Connected"

2. **Component reactivity:**
   - Open React DevTools
   - Inspect zustand store state (`useWsConnectionStore`)
   - Watch `readyState`, `isConnected`, `isConnecting` values change
   - Verify components re-render on state changes

3. **Multiple consumers:**
   - If multiple components read connection state (e.g., header + sidebar)
   - All update simultaneously on state change
   - No stale state in any component

**Expected Results:**
- ✅ Connection state visible in UI
- ✅ UI updates reflect actual connection state
- ✅ Zustand store properly synced
- ✅ Components re-render on state changes
- ✅ Multiple components stay in sync

**Validation:**
- Visual inspection of UI
- React DevTools shows store updates
- No console errors about stale state

---

### Scenario 6: Per-Domain Smoke Tests

**Goal:** Verify each domain's WS flow works end-to-end (within infrastructure limits).

**Note:** Actions are stubbed, so we're only testing message routing, not business logic.

#### Chat Domain

**Test:**
- Send `chat:send-message` from frontend
- Backend handler receives it
- Backend broadcasts `chat:message-received` (stubbed)
- All connected clients receive broadcast
- Frontend handlers are called

**Validation:**
- Backend logs: "Chat handler: send-message"
- Browser console: "Chat handler: message-received"

#### Matchmaking Domain

**Test:**
- Send `matchmaking:join-queue` from frontend
- Backend handler receives it
- Backend sends `matchmaking:queue-status` (stubbed)
- Frontend handler receives it

**Validation:**
- Backend logs: "Matchmaking handler: join-queue"
- Browser console: "Matchmaking handler: queue-status"

#### Gameplay Domain

**Test:**
- Send `gameplay:join-game` from frontend
- Backend handler receives it
- Backend broadcasts `gameplay:game-state` to room (stubbed)
- Frontend handler receives it

**Validation:**
- Backend logs: "Gameplay handler: join-game"
- Browser console: "Gameplay handler: game-state"

#### System Domain

**Test:**
- Connection lifecycle messages (if any)
- Room join/leave operations (if exposed as messages)
- Verify system handlers called appropriately

**Validation:**
- Backend logs show system handler calls
- No errors in either console

---

## Testing Checklist

Use this checklist to track testing progress:

### Infrastructure Tests
- [ ] Client → Server message routing works
- [ ] Server → Client message routing works
- [ ] Handlers receive properly typed payloads
- [ ] Stubbed actions are called (proves routing works)
- [ ] No type errors in either codebase
- [ ] No runtime errors in either codebase

### Multi-Connection Tests
- [ ] Each tab gets unique connectionId
- [ ] Multiple tabs can connect with same user
- [ ] Broadcasts reach all tabs
- [ ] Broadcast exclusion works (sender doesn't receive own message)

### Room Management Tests
- [ ] Connections can join rooms
- [ ] Connections can leave rooms
- [ ] Room broadcasts only reach members
- [ ] Non-members don't receive room broadcasts
- [ ] Disconnect cleanup works (removed from all rooms)
- [ ] Empty rooms are cleaned up

### Connection Resilience Tests
- [ ] Auto-reconnection works after backend restart
- [ ] Exponential backoff works (verify delays in console)
- [ ] Max reconnect attempts respected
- [ ] Message queuing works when offline
- [ ] Queued messages flushed on reconnect
- [ ] Backend receives queued messages

### UI Integration Tests
- [ ] Connection state visible in UI
- [ ] "Connecting" state shows during connection
- [ ] "Connected" state shows when connected
- [ ] "Disconnected" state shows when disconnected
- [ ] Zustand store properly synced with client state
- [ ] Components re-render on state changes
- [ ] Multiple components stay in sync

### Domain Smoke Tests
- [ ] Chat domain: send-message and message-received work
- [ ] Matchmaking domain: join-queue and queue-status work
- [ ] Gameplay domain: join-game and game-state work
- [ ] System domain: connection lifecycle works

---

## Debugging Tips

### Common Issues & Solutions

**Issue: Frontend can't connect**
- Check WS URL in `ws-client-bootstrap.ts` matches backend port
- Verify backend is running and WS route is registered
- Check browser console for connection errors
- Check CORS/auth issues (cookie not sent, etc.)

**Issue: Messages not routing to handlers**
- Check message type format: should be `'domain:message-type'`
- Verify handler is registered in bootstrap (check merged handlers)
- Check for typos in message type strings
- Verify payload structure matches protocol types

**Issue: Multi-tab not working**
- Check backend logs: should see multiple connectionIds
- Verify RoomManager tracks by connectionId (not userId)
- Check that each connection gets unique ID on connect

**Issue: Reconnection not working**
- Check frontend config: `reconnect: true`
- Check max attempts: should be > 0
- Check browser console for reconnection logs
- Verify backend is actually reachable

**Issue: Connection state not updating in UI**
- Check zustand store: is it being imported correctly?
- Verify `onStateChange` callback is wired in bootstrap
- Check React DevTools: is store state changing?
- Verify components are subscribed to store

**Issue: Type errors**
- Check protocol types are properly imported
- Verify `satisfies HandlerMap` is used
- Check for missing handlers (should be compile error)
- Verify message payload types match protocol

---

## Acceptance Criteria

Phase 2 (WS Infrastructure) is complete when:

- [ ] All infrastructure tests pass ✅
- [ ] All multi-connection tests pass ✅
- [ ] All room management tests pass ✅
- [ ] All connection resilience tests pass ✅
- [ ] All UI integration tests pass ✅
- [ ] All domain smoke tests pass ✅
- [ ] No `any` types in WS infrastructure code
- [ ] All domain handlers use `satisfies HandlerMap<...>`
- [ ] Documentation updated (if needed)

**Critical validation:**
- Messages route correctly in both directions
- Multi-tab support works (multiple connectionIds per user)
- Reconnection and queuing work
- Connection state visible to React components

**Reminder:** Domain actions are stubbed - this is expected! Business logic migration happens in Phase 3+.

---

## What's Next

**Phase 2 Complete!** 🎉

With WS infrastructure in place, the next phase is migrating business logic:

**Phase 3+: Business Logic Migration**
- Unstub domain actions (migrate v1 logic to v2 structure)
- Implement real matchmaking logic
- Implement real gameplay logic
- Implement real chat logic
- Full end-to-end user flows working

**Also consider:**
- Core/common reorganization (move shared logic to packages)
- Performance optimization
- Production deployment prep
- V1 code removal (once v2 is fully working)

**Update progress docs:**
- Mark Phase 2 milestones complete in `[PROGRESS].md`
- Update [STRATEGY].md if needed
- Document any learnings or deviations from plan

---

## Notes

### Testing Philosophy

These tests focus on **infrastructure verification**, not business logic:
- We're testing the plumbing (routing, connections, state sync)
- We're NOT testing business rules (matchmaking algorithms, game logic, etc.)
- Stubbed actions are expected and correct at this stage

### Test Environment

Run tests in development environment:
- Backend: `npm run dev` (or however you run it)
- Frontend: `npm run dev` (or Vite dev server)
- Use real WebSocket connections (not mocks)
- Test in browser with DevTools open

### Documentation

If you discover issues with the architecture during testing:
- Document deviations in implementation docs
- Update planning doc if decisions change
- Note learnings for future phases

### Validation Mindset

**Validate the TENTATIVE decisions:**
- Handler context shape - did data-only work? Or do we need operations?
- Generic parameters - could we simplify createWSServer generics?
- Room manager design - does pure data structure work well?
- Bridge pattern - is singleton + lazy init sufficient?

If something feels awkward, document it and consider alternatives for future phases. This is a learning process!
