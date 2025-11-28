# PROMPT: Implement Chat Persistence to Database

## Task

Implement persistent storage for game chat messages in PostgreSQL, following the detailed plan in `dev-notes/2025-11/11-28-[2]-chat-persistence-detailed-plan.md`.

## Key Context Documents

**MUST READ FIRST:**
1. `dev-notes/2025-11/11-28-[2]-chat-persistence-detailed-plan.md` - Detailed implementation plan with all code examples
2. `docs/domain-object-patterns.md` - Pattern for DB → Entity → Protocol conversions (we follow the 3-layer pattern with separate serializers)
3. `docs/architecture.md` - Overall architecture, dependency rules, WebSocket patterns

**Additional helpful context:**
- `AGENTS.md` - Import/export conventions, coding style
- `apps/backend/src/domains/games/game-repository.ts` - Example repository pattern with joins and conversions
- `apps/backend/src/domains/chat/` - Existing chat domain code (handlers, actions, ws-effects)

## Pattern Decisions (from planning session)

✅ **Use separate serializers file** - `serializers.ts` for DB → Entity conversions
✅ **Join with users table** - Don't denormalize username into chat table
✅ **Frontend reuses protocol shape** - Use `ChatServerPayloadMap['chat:broadcast-message']` directly
✅ **Export ChatMessageRow type** - From serializers.ts for reuse (avoids repeating `Selectable<...> & { username }`)

## Implementation Order

Follow the phases in the detailed plan:

### Phase 1: Database & Migration
- Add index on `game_id` to existing migration (hasn't shipped yet, so edit directly)

### Phase 2: Protocol Updates
- Add `id` field to `chat:broadcast-message` server message
- Change `chat:send-message` client message: remove `roomId`, add `gameId`
- Update MsgCreators signatures

### Phase 3: Backend Chat Domain
- Create `serializers.ts` with `toEntity()` function and `ChatMessageRow` type
- Update `ChatMessageEntity` type to include `gameId` field
- Update `createChatMessage` action (simplified signature, uses serializer)
- Update `broadcastChatMessage` action (simplified signature)
- Update handler (convert primitives to branded types)
- Update ws-effects (add `id` parameter to MsgCreators call)
- Update repository (`createGameChat` and `findGameChatsByGameId` return `ChatMessageRow`)

### Phase 4: REST API Endpoint
- Create `chat-routes.ts` with GET `/api/games/:gameId/chat`
- Register routes in server
- TODO: Verify REST helpers pattern from existing routes
- TODO: Add auth check

### Phase 5: Frontend Updates
- Update chat send action (send `gameId` instead of `roomId`)
- Create API client method for fetching history
- Load chat history on game join
- Implement deduplication in store (by message `id`)
- Update frontend ChatMessage type (reuse protocol shape - Option A)

## Key Simplifications from Planning

1. **Removed `roomId` from action signatures** - Server derives it from `gameId` using `buildGameRoomId()`
2. **Repository pattern** - Returns `ChatMessageRow` (enriched DB row), serializer converts to entity
3. **No `GameChatMessageDB` type alias** - Use `Selectable<GameChatMessagesTable>` inline where needed, export `ChatMessageRow` for the joined version

## Important Notes

- Migration file `1762059440118_create_game_chat_table.ts` already exists but hasn't shipped - edit it directly
- After each phase, run builds (`bash tools/build-all.sh`) to catch type errors
- Test as you go - don't wait until the end
- The existing `ChatMessageEntity` currently doesn't have `gameId` - need to add it

## Testing Focus

- [ ] Can send chat message and it persists to DB with real ID
- [ ] Chat message broadcasts include DB-generated ID
- [ ] REST endpoint returns chat history with usernames
- [ ] Frontend deduplicates messages by ID
- [ ] Messages ordered by timestamp correctly

## Questions to Resolve During Implementation

1. **REST API helpers** - What pattern do existing routes use? (check game routes, user routes)
2. **Auth on REST endpoint** - How to verify user has access to game?
3. **Frontend chat store** - Current structure and how to add deduplication

## Getting Started

```bash
# Start with protocol changes (Phase 2) - they're straightforward
# Then backend domain (Phase 3) - most complex phase
# Then REST API (Phase 4) - verify patterns from existing routes first
# Finally frontend (Phase 5) - explore current chat implementation first
```

Read the detailed plan doc thoroughly before starting. It has all the code examples and exact file paths.
