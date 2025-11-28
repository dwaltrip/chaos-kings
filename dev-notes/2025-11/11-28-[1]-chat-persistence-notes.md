# Chat Persistence Implementation Plan

## Background

Making game chats persistent in the database. Migration and repository skeleton already exist.

## Decisions

### 1. GameId in Message Payload
Frontend explicitly sends `gameId` in `chat:send-message` payload.

**Protocol Change:**
```typescript
// Before:
'chat:send-message': { roomId: string; content: string }

// After:
'chat:send-message': { roomId: string; gameId: number; content: string }
```

Handler converts `gameId: number` → `GameId` branded type and passes both `roomId` and `gameId` to `createChatMessage()`.

### 2. Chat History Delivery
Use REST API endpoint for fetching chat history (not WebSocket).

Create GET endpoint like `/api/games/:gameId/chat` that returns historical messages.

## Open Questions

### 3. DB Schema
- ID type: `serial` (integer) - matches existing pattern
- Add index on `game_id` for faster lookups
- `created_at` sufficient for ordering
- Messages are immutable

### 4. Frontend Chat History Loading
- Fetch immediately on game join/load
- Deduplicate when merging into store

### 5. ChatMessageId Strategy
- Keep current behavior: save to DB first, then broadcast with real DB ID
- No optimistic updates for now
- TODO: Consider optimistic message display in future

## Implementation Tasks

### Backend
- [ ] Add index on `game_id` to migration
- [ ] Update `chat:send-message` protocol to include `gameId: number`
- [ ] Update handler to extract and convert `gameId`
- [ ] Update `createChatMessage()` to accept `gameId` parameter
- [ ] Implement DB insert in `createChatMessage()` using repository
- [ ] Update `createChatMessage()` to use DB-generated ID and timestamp
- [ ] Create REST endpoint GET `/api/games/:gameId/chat`
- [ ] Implement serializers for DB ↔ Entity conversion

### Frontend
- [ ] Update chat send action to include `gameId` in message payload
- [ ] Create API client method for fetching chat history
- [ ] Fetch chat history on game join/load
- [ ] Deduplicate messages when merging history into store