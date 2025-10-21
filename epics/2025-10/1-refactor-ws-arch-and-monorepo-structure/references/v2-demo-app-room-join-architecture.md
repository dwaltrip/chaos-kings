# Room Join/Leave Architecture Summary

## Core Concept

The **System domain** owns all room membership state via `RoomManager` (backend/src/ws/room-manager.ts), which tracks a `Map<string, Set<string>>` of rooms and their members. Non-system domains (chat, timer) depend on this infrastructure to broadcast messages only to members of specific rooms.

---

## Room Join Flow

1. **Client initiates**: `chatActions.joinGeneralRoom()` → `systemWsEffects.joinRoom('general')` → sends `system:room-join` message
2. **Server processes**: `systemHandlers` → `systemActions.joinRoom()` → calls `wsBridge.rooms.join(roomId, userId)`
3. **RoomManager updates**: Adds userId to room's member Set, creates room if needed
4. **Server broadcasts snapshot**: Fetches all room members, builds `RoomUsersSnapshot`, calls `wsBridge.broadcastToRoom(roomId, 'system:users-for-room')`
5. **All room members receive**: `system:users-for-room` with complete user list → updates `systemStore.usersByRoom[roomId]`

**Key file**: backend/src/domains/system/actions.ts:35 handles join logic and triggers broadcast

---

## How Non-System Domains Use Rooms

### Chat Domain (backend/src/domains/chat/)

**Message sending** (handlers.ts:11):
- Client sends `chat:send` with `{ roomId, text }`
- Server stores message, then calls `chatWsEffects.broadcastNewMessage()`
- Uses `wsBridge.broadcastToRoom(message.roomId, ...)` to send only to that room's members

**Typing indicators** (actions.ts:30):
- Tracks typing state per `roomId` in `Map<ChatRoomId, Set<UserId>>`
- Broadcasts `chat:typing-broadcast` via `wsBridge.broadcastToRoom(roomId, ..., { excludeUserId })`

### Timer Domain (backend/src/domains/timer/)

**Timer state** (actions.ts:18):
- Maintains per-room timer state in `Map<TimerRoomId, TimerState>`
- Every timer action (`start`, `pause`, `resume`, `reset`) includes `roomId` parameter
- State changes broadcast via `timerWsEffects.broadcastStateChange()` → `wsBridge.broadcastToRoom(roomId, ...)`

**Pattern**: Both domains receive `roomId` in their incoming messages and use `wsBridge.broadcastToRoom(roomId)` to scope outgoing broadcasts—**they never touch RoomManager directly**.

---

## Leave & Disconnect

**Explicit leave** (system/actions.ts:69):
- Client sends `system:room-leave` → server calls `wsBridge.rooms.leave(roomId, userId)`
- RoomManager removes user, auto-deletes empty rooms
- **Note**: Currently does NOT broadcast to remaining members

**Auto-cleanup on disconnect** (ws/server.ts:139):
- When WebSocket closes, server calls `roomManager.getRoomsForUser(userId)` and removes user from all rooms
- Also cleans up user store and game domain state

---

## Key Abstractions

1. **RoomManager** (`ws/room-manager.ts`): Pure membership tracking—join, leave, getMembers, cleanup
2. **WsBridge** (`ws/bridge.ts`): Abstract transport facade—`broadcastToRoom()`, `sendToUser()`—hides WebSocket details from domains
3. **System Domain**: Only domain that directly mutates RoomManager; broadcasts membership snapshots
4. **Other Domains**: Include `roomId` in messages, use `wsBridge.broadcastToRoom()` for scoped delivery, remain unaware of WebSocket internals

This architecture lets you add new domains (e.g., `whiteboards`, `audio`) without touching room logic—just parameterize by `roomId` and call `wsBridge.broadcastToRoom()`.

---

## Detailed Flow Diagrams

### JOIN FLOW (Client → Server → Client)

```
1. Client: ChatContainer mounts
   ↓
2. Client: useEffect triggers joinGeneralRoom() if currentRoom is null
   ↓
3. Client: chatActions.joinGeneralRoom()
   - Calls systemWsEffects.joinRoom('general')
   - Updates chatStore.currentRoom
   ↓
4. Client: systemWsEffects.joinRoom() sends message:
   { type: 'system:room-join', payload: { roomId: 'general' } }
   ↓
5. Server: systemHandlers['system:room-join'] receives message
   - Extracts roomId and userId from context
   - Calls systemActions.joinRoom('general', { userId })
   ↓
6. Server: systemActions.joinRoom()
   - Validates roomId (normalizes, checks non-empty)
   - Calls wsBridge.rooms.join(roomId, userId)
   - RoomManager updates Map: rooms.get('general').add(userId)
   - Fetches all current members from RoomManager
   - Gets User info for each member from userStore
   - Calls systemWsEffects.broadcastUsersForRoom(roomId, users)
   ↓
7. Server: systemWsEffects.broadcastUsersForRoom()
   - Creates RoomUsersSnapshot: { roomId, users: User[] }
   - Calls wsBridge.broadcastToRoom(roomId, message)
   ↓
8. Server: broadcastToRoom()
   - Calls roomManager.requireMembers(roomId) to get all member sockets
   - Encodes message as JSON
   - Sends to each member's WebSocket: socket.send(data)
   ↓
9. Client: Receives broadcast message
   { type: 'system:users-for-room', payload: { roomId, users } }
   ↓
10. Client: systemHandlers['system:users-for-room'] processes message
    - Calls systemActions.setUsersForRoom(roomId, users)
    ↓
11. Client: systemActions.setUsersForRoom()
    - Updates useSystemStore via Zustand
    - usersByRoom['general'] = users
    ↓
12. Client: ChatContainer selector re-renders
    - selectUsersInRoom('general') returns updated users
    - Users list displays in sidebar
```

### LEAVE FLOW

```
1. Client: Calls systemWsEffects.leaveRoom(roomId)
   ↓
2. Client: Sends message:
   { type: 'system:room-leave', payload: { roomId } }
   ↓
3. Server: systemHandlers['system:room-leave'] receives message
   - Calls systemActions.leaveRoom(roomId, { userId })
   ↓
4. Server: systemActions.leaveRoom()
   - Validates roomId
   - Calls wsBridge.rooms.leave(roomId, userId)
   - RoomManager updates: rooms.get(roomId).delete(userId)
   - If room is now empty: rooms.delete(roomId)
   - Note: Currently does NOT broadcast to remaining members
   ↓
5. Client: (No response to leave message)
   - Client should update its local state separately
```

### DISCONNECT FLOW

```
1. Client: WebSocket connection closes
   ↓
2. Server: wss.on('close') handler triggered
   ↓
3. Server: Gets all rooms user was in
   - Calls roomManager.getRoomsForUser(userId)
   ↓
4. Server: For each room:
   - Calls roomManager.leave(roomId, userId)
   - Cleans up room membership
   ↓
5. Server: Calls onDisconnect(userId)
   - Calls removeUser(userId) to clean up user store
   - Calls gameActions.leaveGame(userId) for game domain cleanup
```

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     WEBSOCKET LAYER                         │
│  createWSServer() manages clients Map, RoomManager,         │
│  and routing to domain handlers                             │
└────────────────┬────────────────────────────────────────────┘
                 │
         ┌───────┴────────┐
         │                │
┌────────▼──────┐   ┌─────▼──────────┐
│ System Domain │   │ Other Domains  │
│   (room mgmt) │   │ (chat, timer)  │
└────────┬──────┘   └─────┬──────────┘
         │                │
         └────────┬───────┘
                  │
         ┌────────▼────────────────┐
         │  wsBridge.broadcastToRoom()  │
         │  (routes via RoomManager)    │
         └────────┬────────────────┘
                  │
         ┌────────▼──────────┐
         │ RoomManager       │
         │ (tracks members)  │
         └─────────┬─────────┘
                   │
          ┌────────▼────────────┐
          │ Client WebSockets   │
          │ (send to members)   │
          └─────────────────────┘
```

---

## Message Types (Common Contracts)

### Client → Server

- `system:room-join`: `{ roomId: string }`
- `system:room-leave`: `{ roomId: string }`
- `chat:send`: `{ roomId: string, text: string }`
- `chat:typing`: `{ roomId: string, isTyping: boolean }`
- `timer:start`: `{ roomId: string, durationSeconds: number }`
- `timer:pause`: `{ roomId: string }`
- `timer:resume`: `{ roomId: string }`
- `timer:reset`: `{ roomId: string }`

### Server → Client

- `system:users-for-room`: `{ roomId: string, users: User[] }`
- `system:user-info`: `{ userId: string, username: string }`
- `chat:message-broadcast`: `{ roomId: string, message: ChatMessage }`
- `chat:typing-broadcast`: `{ roomId: string, userIds: string[] }`
- `timer:state-changed`: `{ roomId: string, status, remainingSeconds, ... }`

---

## Key Files Reference

### Backend Files

1. **`backend/src/ws/room-manager.ts`** - Core room membership tracker
   - Maintains `Map<string, Set<string>>` of rooms and members
   - Methods: `join()`, `leave()`, `getMembers()`, `isMember()`, `getRoomsForUser()`
   - Handles room creation/cleanup

2. **`backend/src/ws/bridge.ts`** - Abstract message transport interface
   - Defines `RoomMembershipAdapter` interface
   - Provides `broadcastToRoom()` and `sendToUser()` methods
   - Acts as facade to WebSocket server implementation

3. **`backend/src/ws/server.ts`** - WebSocket server implementation
   - Creates `createWSServer()` implementing `WsTransport<TMessage>`
   - `broadcastToRoom()` looks up members and sends to each socket
   - Handles connection/disconnection with automatic cleanup

4. **`backend/src/domains/system/handlers.ts`** - Message handlers for join/leave
   - Routes `system:room-join` → `systemActions.joinRoom()`
   - Routes `system:room-leave` → `systemActions.leaveRoom()`

5. **`backend/src/domains/system/actions.ts`** - Business logic for room operations
   - `joinRoom()`: Updates RoomManager, broadcasts `system:users-for-room` to room
   - `leaveRoom()`: Updates RoomManager (no broadcast yet)

6. **`backend/src/domains/system/ws-effects.ts`** - WebSocket side effects
   - `broadcastUsersForRoom()`: Sends room member snapshot to all members

### Frontend Files

1. **`frontend/src/system/ws-effects.ts`** - Client-side room join/leave triggers
   - `joinRoom(roomId)`: Sends `system:room-join` message
   - `leaveRoom(roomId)`: Sends `system:room-leave` message

2. **`frontend/src/system/handlers.ts`** - Message handlers
   - Handles `system:users-for-room` → updates system store
   - Handles `system:user-info` → updates user store

3. **`frontend/src/system/system-store.ts`** - Zustand store for room state
   - `usersByRoom: Record<ChatRoomId, User[]>` - maps rooms to members
   - `updateUsersForRoom()` - updates member list
   - `selectUsersInRoom(roomId)` - selector for room members

4. **`frontend/src/chat/actions.ts`** - Chat domain integration
   - `joinGeneralRoom()`: Calls system join + updates chat store
   - Idempotent (won't rejoin if already in room)

5. **`frontend/src/pages/chat-page/chat-container.tsx`** - UI component
   - Effect hook triggers `joinGeneralRoom()` on mount
   - Displays users from system store selector

### Common Files

1. **`common/src/system/client-messages.ts`** - Type-safe join/leave builders
   - `createRoomJoinMessage(roomId)`
   - `createRoomLeaveMessage(roomId)`

2. **`common/src/system/server-messages.ts`** - Server broadcast builders
   - `createUsersForRoomBroadcast(snapshot)`
   - `createUserInfoBroadcast(user)`

---

## Key Architectural Decisions

1. **Centralized Room Management**: System domain owns all room state via RoomManager singleton
2. **Broadcast Abstraction**: `wsBridge` abstracts room broadcasting so domains don't know WebSocket details
3. **Room-Scoped Messaging**: Every domain message includes `roomId` for scoped delivery
4. **Auto-Cleanup**: Server automatically removes disconnected clients from all rooms
5. **Snapshot-Based Updates**: System sends complete `RoomUsersSnapshot` after join (not delta)
6. **Idempotent Client Join**: Chat action prevents double-join with currentRoom check
