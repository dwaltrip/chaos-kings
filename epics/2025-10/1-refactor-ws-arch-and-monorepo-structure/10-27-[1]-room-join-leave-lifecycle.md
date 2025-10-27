# Room Join/Leave Lifecycle Integration

**Status:** WIP - Not yet scoped
**Created:** 2025-10-27

---

## Problem

System domain owns room join/leave transport (`systemWsEffects.joinRoom/leaveRoom`), but it's unclear where in the frontend UI lifecycle these should be triggered. All three domains (chat, gameplay, matchmaking) need to join/leave rooms but the integration points are undefined.

---

## Affected Domains

### Chat
- **Room format:** `chat:game-{gameId}` (via `buildChatRoomId()` helper)
- **Code location:** `apps/frontend/src/domains/chat/components/game-chat.tsx` (TODO comment)
- **Options:** Component useEffect, page-level init, or action-level helper

### Gameplay
- **Room format:** `game:{gameId}` (presumably, needs confirmation)
- **Code locations:**
  - `apps/frontend/src/pages/gameplay/gameplay-page.tsx:48`
  - `apps/frontend/src/domains/gameplay/actions/index.ts` (commented code)
- **v1 pattern:** Happened in GameplayWsHandler on websocket connection
- **Current state:** No room join happening at all

### Matchmaking
- **Room format:** `MATCHMAKING_ROOM_ID` constant
- **Code location:** `apps/frontend/src/domains/matchmaking/actions.ts` (lines 16-18, 28-30)
- **Current state:** Calling `systemWsEffects` but TODOs question if this is right place
- **Note:** v1 didn't explicitly join matchmaking room in these actions

---

## Key Questions

1. **Backend vs Frontend initiated?**
   - Should backend auto-join users to certain rooms (e.g., matchmaking room on connect)?
   - Or keep frontend-initiated pattern?

2. **Lifecycle timing:**
   - Component mount/unmount?
   - Page navigation?
   - First action that needs the room?

3. **Consistency:**
   - Should all three domains follow the same pattern?
   - Or is each domain special enough to warrant different approaches?

---

## Next Steps

- [ ] Review v1 patterns for all three domains
- [ ] Decide on backend vs frontend initiation strategy
- [ ] Define consistent lifecycle pattern (or justify differences)
- [ ] Implement and document the pattern

---

## Related

- See [TODOS].md for other v1 integration work
- System domain implementation: `10-20-[3]-system-domain-implementation-plan.md`
