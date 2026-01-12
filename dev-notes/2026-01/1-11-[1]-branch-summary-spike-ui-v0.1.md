# Branch: spike/ui-v0.1

**Base:** dev
**Commits:** 11
**Date:** Dec 2025
**Status:** Paused (pivoted to puzzles)

---

## Summary

First real pass at building the frontend UI beyond stubs. Previously, all UI except the GameBoard was placeholder/stub code while the game engine was being developed.

**Approach:** Minimal styling, focus on UX and layout fundamentals. Intentionally avoiding strong aesthetic/stylistic choices until the v1 vision is clearer.

---

## Why This Work Was Paused

The game is currently a near-clone of generals.io. Daniel is an active member of that community and doesn't want to:
- Launch a competing clone that could fragment the small, niche community
- Commit to long-term support before the game has meaningful differentiation

**Pivot:** Puzzles are a complementary feature - players can play real games on generals.io and do puzzles here. This is a safer, more community-friendly first release.

Work continues in the `puzzles-1st-spike` branch.

---

## Key Changes

### 1. Home Page (First Real Implementation)

**Location:** `apps/frontend/src/domains/home/pages/home/`

Created a 3-column layout:
- **Left column:** User info (username, level, join date)
- **Center column:** Server stats, play controls, games spotlight
- **Right column:** Lobby chat (commented out, incomplete)

Components created:
- `home-page-layout.tsx` - `Col`, `ColSection` layout primitives
- `user-info.tsx` - User profile summary with link to profile page
- `server-player-stats.tsx` - Placeholder for online player counts
- `play-game-controls.tsx` - Placeholder for game mode selection/queue
- `lobby-chat.tsx` - Placeholder for global chat
- `games-spotlight.tsx` - Placeholder for featured/recent games

### 2. Navigation Refactor

Extracted inline nav from `App.tsx` into reusable `AppNav` component (`ui-lib/components/app-nav.tsx`).

Each page now explicitly includes `<AppNav />`, giving pages control over their layout. Nav auto-hides on game and replay pages.

### 3. User Domain Improvements

**Problem:** Raw API responses use snake_case, but frontend domain code should use proper TypeScript types with branded IDs and native Date objects.

**Solution:**
- Added `UserDTO` type for raw API shape
- Enhanced `User` type with `UserId` branded type and `Date` for `createdAt`
- Created `data-mappers.ts` with `toUser()` conversion function
- Added selectors: `selectUser`, `selectIsLoading`

**Open question:** Where should DTO→domain mappers live? Frontend-only, or shared in `@platform`?

### 4. Profile Page Stub

Added route `/users/:userId` with placeholder `ProfilePage` component.

### 5. UI Library Additions

- `format-date.tsx` - `FmtDate` component and `fmtDate` helper for consistent date formatting

### 6. Component Organization Pattern

Renamed `domains/chat/components/` → `domains/chat/ui/` to follow the documented pattern where reusable domain components live in `domains/$domain/ui/`.

### 7. Claude Code Tooling (Meta)

Added experimental `build-fixer` agent:
- `.claude/agents/build-fixer.md` - Haiku-based agent for fixing TypeScript build errors
- `.claude/skills/build-fixer-guide.md` - Usage documentation

Purpose: Improve human+AI workflow by offloading mechanical build-fix work to a faster, cheaper model.

---

## Files Changed

```
Frontend (26 files):
  - App.tsx (simplified, nav extracted)
  - domains/home/pages/home/* (new - 10 files)
  - domains/users/* (types, data-mappers, store selectors, profile page)
  - domains/chat/components → domains/chat/ui (rename)
  - domains/replay/pages/replay-page.tsx (added AppNav)
  - pages/gameplay/gameplay-page.tsx (added AppNav)
  - pages/games-list/game-list-page.tsx (added AppNav)
  - pages/join-game/join-game-page.tsx (added AppNav)
  - ui-lib/components/app-nav.tsx (new)
  - ui-lib/components/format-date.tsx (new)

Meta (2 files):
  - .claude/agents/build-fixer.md (new)
  - .claude/skills/build-fixer-guide.md (new)
```

---

## Decisions & Patterns

1. **Minimal styling** - Defer aesthetic choices, use basic CSS/Tailwind for layout only
2. **Pages own their nav** - Each page includes `<AppNav />` rather than App.tsx wrapping everything
3. **DTO → Domain separation** - Convert API responses at the boundary, use proper types internally
4. **Domain ui/ folder** - Reusable domain components go in `domains/$domain/ui/`

---

## Future Work (When Resumed)

- Complete lobby chat integration
- Server stats (online players, active games)
- Game mode selection and queue UI
- Games spotlight / recent games list
- Settle on data-mapper location pattern
