# V2 Refactor - Post-Activation Loose Ends Investigation

**Date:** 2025-10-31
**Status:** Investigation complete - Ready for implementation
**Priority:** Identify remaining work after v2 system activation

**Related Docs:**
- `10-30-[1]-critical-path-v2-system-activation.md` - System activation plan (completed)
- `10-27-[1]-room-join-leave-lifecycle.md` - Room lifecycle questions
- `10-29-[1]-game-gameplay-backend-integration-plan.md` - Gameplay deferred work
- `[PROGRESS].md` - Epic progress tracker
- `[TODOS].md` - Active work items

---

## Purpose

Systematically identify remaining work items after v2 system activation (commits 9068370, 2b0786b, 99c97d3, d332088). Distinguish critical gaps from intentional deferrals and general cleanup.

---

## Investigation Method

**What Was Checked:**
- Commit history (last 20 commits)
- Code TODO/FIXME/NOTE patterns (apps + packages)
- Tactical doc deferred work sections (last ~10 docs)
- Runtime validation (backend server startup)
- Frontend typecheck

**Limitations:**
- Static code analysis only
- No end-to-end testing performed
- Frontend runtime not tested (build/connection not verified)

---

## Executive Summary

**✅ What Works:**
- Backend server starts successfully (port 3131)
- Backend typechecks pass
- Frontend typechecks pass
- v2 infrastructure fully wired per `10-30-[1]` plan

**🔴 High Priority Gaps:**
- Room join/leave lifecycle unclear (may or may not be blocking)
- Chat username population not implemented

**🟡 Medium Priority:**
- System domain frontend integration (room-status-update stub)
- Matchmaking navigation polish

**✅ Confirmed Deferrals:**
- Games/gameplay architectural improvements (well-documented)
- System domain persistence & heartbeat
- Infrastructure polish (ws-lib TODOs)
- Package-level cleanup

---

## Findings by Priority

### HIGH PRIORITY - Requires Investigation

#### Finding 1: Room Join/Leave Lifecycle Status Unclear

**Confidence:** 🟡 Medium (TODOs exist but may be stale)

**Evidence:**
- Tactical doc `10-27-[1]-room-join-leave-lifecycle.md` (Oct 27) states "WIP - Not yet scoped"
- Code TODOs at:
  - `apps/frontend/src/domains/chat/components/game-chat.tsx:11` - "TODO: Figure out where to join/leave the chat room"
  - `apps/frontend/src/pages/gameplay/gameplay-page.tsx:49` - "TODO: figure out when we should be joining the 'room' for this gameId..."
  - `apps/frontend/src/domains/matchmaking/actions.ts:16,28` - Calls exist but marked "TODO: does this belong here?"
- Listed in `10-30-[1]` deferred work section (line 445)

**The Problem:**
System domain provides `systemWsEffects.joinRoom/leaveRoom` but integration is unclear:
- **Chat**: No explicit room joining implemented
- **Gameplay**: No explicit room joining implemented
- **Matchmaking**: Has calls but marked with TODOs questioning placement

**Why This Matters:**
WebSocket rooms typically require explicit join to receive broadcasts. Without joining:
- Chat messages might not be received
- Game state updates might not arrive
- Matchmaking status updates might fail

**Critical Unknown:**
Does backend auto-join users to rooms, or is frontend explicit joining required?

**Next Steps to Confirm:**
1. Search backend for auto-join logic (check `server-bootstrap.ts`, handlers, RoomManager)
2. Read `ws-lib/room-manager.ts` - does `broadcast()` require explicit membership?
3. Check if GameServer/MatchmakingService auto-add connections to rooms
4. Test E2E: send chat message, verify if it arrives without explicit join

**Architectural Questions (from 10-27-[1]):**
- Backend auto-join vs frontend explicit join?
- Component-level (useEffect) vs page-level vs action-level?
- Should all domains follow same pattern?

---

#### Finding 2: Chat Username Population Not Implemented

**UPDATE (2025-10-31):** ✅ Already implemented in commit e020b53 (Oct 28). UserRepository lookup working correctly.

**Confidence:** 🟡 Medium (TODO exists, user lookup infrastructure may exist elsewhere)

**Evidence:**
- `apps/backend/src/domains/chat/actions/create-chat-message.ts:12-21`:
  ```typescript
  // TODO: [DB] Get message ID from database after insert
  // TODO: timestamp should come from DB
  // Need user lookup service/context to populate username
  ```

**The Problem:**
Chat action currently returns placeholder ChatMessageEntity without populating username field.

**Impact:**
Chat messages will display as "Unknown" or with no username in UI.

**Next Steps to Confirm:**
1. Search for existing user lookup infrastructure (`grep -r "UserRepository|UsersService|findUser"`)
2. Check `app-handler-context.ts` - does HandlerContext provide user info?
3. Review chat protocol - does client send username, or should backend look it up?
4. Check if `req.currentUser` from auth plugin includes username

**Possible Solutions:**
- If UserRepository exists: call it in chat action
- If username in HandlerContext: use it directly
- If in `req.currentUser`: pass through from handler to action

---

### MEDIUM PRIORITY - Check/Verify

#### Finding 3: System Domain Frontend Integration

**Confidence:** 🟢 High (directly observed in code)

**Status:**
- `system:room-status-update` handler exists but is **just a stub**
- Logs to console, no state integration
- From `apps/frontend/src/domains/system/handlers.ts:10`

**Assessment:**
Low priority unless core functionality breaks without it. Listed in tactical doc `10-20-[3]` as intentional deferral ("until WS client pub/sub pattern stabilizes").

**Action:** Verify during E2E testing if this blocks anything.

---

#### Finding 4: Backend Server Startup Follow-ups

**Confidence:** 🟢 High (server tested, starts successfully)

**Verified:**
- ✅ Server starts on port 3131
- ✅ GameCoordinator initializes
- ✅ No module resolution errors
- ✅ All imports resolve correctly

**Not Yet Verified:**
- WebSocket connections actually work
- Auth flow functions correctly
- Messages route through handlers
- Frontend can connect

**Next Steps:**
Test E2E flow to verify full stack integration.

---

#### Finding 5: ws-lib Infrastructure TODOs

**Confidence:** 🟢 High (directly observed)

**TODOs Found:**
- `ws-lib/server.ts:6` - Replace connection ID generator with UUID library
- `ws-lib/server.ts:104` - Send error messages back to client
- `ws-lib/room-manager.ts:3` - Use branded RoomId instead of raw string
- `app-handler-context.ts:3` - Review userId primitive vs branded type

**Assessment:**
Quality/polish issues, not functional blockers. Can defer until after v2 is proven working.

---

### LOW PRIORITY - Defer or Fix Later

#### Finding 6: Matchmaking Navigation Issues

**Evidence:**
- `matchmaking/actions.ts:58` - Uses `window.location.href` instead of React Router
- `matchmaking/actions.ts:49` - TODO about clearing matchmaking state

**Assessment:**
UX polish, not a functional blocker. Listed in `10-30-[1]` deferred work.

---

#### Finding 7: Dev Script Broken

**Evidence:**
Running `npm run dev` fails with: `Error: Unknown or unexpected option: --watch`

**Impact:**
Cannot use dev mode with file watching. Must restart server manually.

**Workaround:**
Use `npm start` instead (no watch mode).

**Fix Options:**
- Update ts-node to version supporting --watch
- Replace with nodemon
- Use different watch flag syntax

---

### CONFIRMED DEFERRALS - Document for Later

#### Finding 8: Games/Gameplay Architectural Improvements

**Source:** Tactical docs `10-29-[1]` and `10-29-[2]`

**Deferred Items:**
1. **User ↔ Game Lookup** - Currently in-memory `Map<UserId, GameId>`, single-process limitation
2. **GameCoordinator/GameServer Refactor** - Large stateful classes, future: isolate timers/persistence/broadcast
3. **HTTP Route Alignment** - Still uses v1 router structure

**Refactor-Specific Technical Debt:**
- **ConnectionId in gameplay actions** - Architectural smell (transport concern leaking into domain logic)
- Documented with TODO in `gameplay/actions/on-player-joined.ts:13` and `on-player-left.ts:12`
- From session notes `10-29-[2]:94`: "Acceptable for now, but may revisit with middleware/orchestration layer"

**Note:** Items #1-3 existed before refactor. ConnectionId issue is new technical debt from v2 migration worth tracking.

---

#### Finding 9: System Domain Backend Deferrals

**Source:** Tactical docs `10-20-[3]`, `10-30-[1]`

**Intentionally Deferred:**
- **Membership Persistence** - Redis vs in-memory (currently in-memory, volatile)
- **Heartbeat & Lifecycle** - Connection health monitoring (out of scope until WS infra stabilizes)

**Rationale:** "Defer until real consumers materialize" and "Once infrastructure settles"

---

#### Finding 10: Package-Level TODOs

**Evidence:**
100+ TODOs across packages, but focused check on new packages shows:

**kernel/:**
- Migration TODO: Encourage callers to import from `@kernel/ids` for consistency

**protocol/:**
- Consider relocating room-id helper to platform package
- Rename message-helpers type (polish)
- Update rest of app to match new chat message names
- Empty TODO comment at `chat/client-messages.ts:15`

**Assessment:**
All minor cleanup items - naming, migrations, relocating helpers. Nothing blocking.

---

## Priority Summary

### **Must Investigate Before Launch**
1. **Room join/leave lifecycle** - Determine if backend auto-joins or if frontend implementation needed
2. **Chat username population** - Find user lookup infrastructure and implement

### **Should Verify During E2E Testing**
3. Backend startup follow-ups (WS connection, auth, message routing)
4. System domain frontend integration (room-status-update)
5. ws-lib TODOs (double-check for hidden blockers)

### **Refactor-Specific Technical Debt to Track**
6. ConnectionId in gameplay actions - Architectural smell introduced during migration

### **Low Priority / Fix Later**
7. Matchmaking navigation polish
8. Dev script (--watch flag)
9. Package-level TODOs
10. System domain deferrals (heartbeat, persistence)
11. Games/gameplay architectural improvements

---

## Recommended Next Steps

### Phase 1: Critical Path Validation
1. **Investigate room join/leave:**
   - Search backend for auto-join patterns
   - Read RoomManager implementation
   - Determine if frontend implementation needed
   - If needed: implement for chat, gameplay, matchmaking

2. **Fix chat username:**
   - Find user lookup infrastructure (UserRepository, HandlerContext)
   - Implement username population in chat action
   - Verify in UI

### Phase 2: End-to-End Testing
3. Start frontend, verify connection
4. Test matchmaking → game spawn → chat message flow
5. Verify each domain receives expected messages
6. Check for runtime errors not caught by typecheck

### Phase 3: Documentation & Cleanup
7. Update `[PROGRESS].md` with current status
8. Update `[TODOS].md` with remaining work
9. Document architectural decisions made (room lifecycle pattern)
10. Create follow-up tasks for deferred work

---

## Open Questions

1. **Does backend auto-join users to rooms?** (Highest priority to answer)
2. **Where does username lookup happen?** (Chat-specific)
3. **Is room-status-update actually needed?** (Test during E2E)
4. **Should connectionId in gameplay actions be refactored?** (Post-v2 decision)

---

## Success Criteria

**v2 Refactor Complete When:**
- [ ] Room lifecycle implementation complete (or confirmed unnecessary)
- [ ] Chat displays usernames correctly
- [ ] End-to-end flow works: matchmaking → game → chat
- [ ] No critical errors in browser/server console
- [ ] Documentation updated to reflect current state

**Future Work Tracked:**
- [ ] Refactor-specific technical debt documented
- [ ] Intentional deferrals listed with rationale
- [ ] Package TODOs catalogued for cleanup phase
