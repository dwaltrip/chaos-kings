# MVP Core Implementation Progress

**Branch:** `spike/mvp-core`  
**Started:** 2025-07-25  
**Goal:** Implement the 5 core user stories for basic multiplayer game room functionality

---

## User Stories Overview

### ✅ User Story #1: Username Management
**Status:** COMPLETED (Commit: 2156bac)  
**Files:** `username-store.ts`, `local-storage.ts`, `username-form.tsx`, updated `home-page.tsx`

**Implementation:**
- Username form with validation on home page
- Global Zustand store for username state
- localStorage persistence with auto-loading
- Option to change username after setting
- Remove the dummy page "About" (we now have a 2nd page, so no need for it)

**Key Design Decisions & Why:**
- **localStorage utilities**: simpler way of storing username for this prototype spike
- **Zustand store pattern**: Followed example store structure from chat-demo
- **Page-specific components**: `username-form.tsx` lives in `/pages/home/` since it's only used there
- **Validation rules**: 2-20 chars, alphanumeric + hyphens/underscores only (prevents display issues, reasonable limits)
- **Auto-load on init**: Username loads immediately when store is created, avoiding loading states in components

### ✅ User Story #2: Game Room Routing  
**Status:** COMPLETED  
**Target Files:** `game-page.tsx`, update `App.tsx` routing

**Requirements:**
- Route: `/games/:gameId`  
- Check for username, redirect to home if missing
- Display "You are in game room {gameId} as {username}"
- Extract gameId from URL params

### ⏳ User Story #3: Manual Game Creation
**Status:** PENDING  
**Scope:** Basic game room validation (hardcoded list or simple URL pattern)

##### Notes
- Backend: Create simple game room validation (hardcoded list or URL pattern)
- Backend: Add game room API endpoints for basic room info
- Common: Define game room types

### ⏳ User Story #4: Game Room Chat
**Status:** PENDING  
**Scope:** Adapt existing chat-demo for game room context, page-specific chat components

##### Notes
- Frontend: Adapt existing chat-demo components for game rooms
- Frontend: Create game-room-specific chat store and actions
- Backend: Adapt existing game-chat WebSocket API for room-scoped messaging
- Backend: Modify WebSocket manager to handle game room contexts

### ⏳ User Story #5: Connected Players List
**Status:** PENDING  
**Scope:** Real-time player presence, WebSocket-based updates

##### Notes
- Backend: Add player presence tracking in WebSocket manager
- Backend: Broadcast player join/leave events to rooms
- Frontend: Add player list component to game room page
- Frontend: Handle real-time player list updates via WebSocket

---

## Architecture Decisions

### File Structure Convention
```
frontend/src/pages/[page_name]/
├── [page_name]-page.tsx     # Main page component
├── component-1.tsx          # Page-specific components
└── component-2.tsx

frontend/src/stores/         # Global state stores
frontend/src/utils/          # Reusable utilities
```

### Reusable vs Page-Specific Components
- **Page-specific**: Components used only on one page (e.g., `username-form.tsx`)
- **Reusable**: Components used across multiple pages (will go in shared components dir)

### WebSocket Strategy
- Build game room features using existing WebSocket infrastructure
- Reuse chat-demo patterns but create separate game-specific implementations
- Eventually deprecate chat-demo code

---

## Technical Notes

### Current Dependencies
- Zustand for state management (following existing pattern)
- React Router for routing
- Existing WebSocket manager and message API abstraction

### Testing Approach
- Manual testing for now
- Focus on localStorage persistence, form validation, routing behavior

---

## Next Steps

1. **Complete User Story #2**: Game room routing with username requirement
2. **Iterate**: Test and refine based on feedback
3. **User Story #3**: Basic game room validation
4. **User Stories #4-5**: Chat and player presence (building on WebSocket foundation)

---

## Session Notes

### 2025-07-25 Session 1
- Completed User Story #1 username management
- Established file structure conventions
- Created reusable localStorage utilities
- Set up foundation for remaining stories
