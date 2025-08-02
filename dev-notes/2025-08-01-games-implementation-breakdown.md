# Games Feature Implementation - Step-by-Step Breakdown

## Overview
This document breaks down the games feature implementation into 9 logical chunks that can be tackled incrementally. Each step builds on the previous ones and includes specific implementation details.

## Implementation Order

### Step 1: Backend - Create Game Types and Repository Structure
**Files to create/modify:**
- `backend/src/game/types.ts` (new)
- `backend/src/game/game-repository.ts` (new)

**Details:**
- Create `GameStatus` enum: `'not_started' | 'in_progress' | 'complete'`
- Define `Game` interface matching database schema
- Create `GameRepository` class following `UserRepository` pattern
- Include methods: `create()`, `findAll()`, `findById()`
- Use Kysely for database queries

### Step 2: Backend - Implement Game Actions
**Files to create:**
- `backend/src/game/actions/create-game.ts` (implement from scratch)
- `backend/src/game/actions/list-games.ts` (new)
- `backend/src/game/actions/get-game.ts` (new)

**Details:**
- **create-game.ts**: Creates new game with `not_started` status and empty `game_state: {}`
- **list-games.ts**: Returns all games using GameRepository
- **get-game.ts**: Returns single game by ID, handles not found cases
- Follow existing action patterns in codebase

### Step 3: Backend - Create Game Routes with API Endpoints
**Files to create:**
- `backend/src/game/game-routes.ts` (new)

**Details:**
- `POST /api/games` - Create new game (returns full game object)
- `GET /api/games` - List all games (returns array of games)
- `GET /api/games/:id` - Get game by ID (returns single game, 404 if not found)
- Basic error handling and validation
- Use Fastify route patterns from existing code

### Step 4: Backend - Register Game Routes
**Files to modify:**
- `backend/src/server.ts`

**Details:**
- Import game routes
- Register with prefix: `fastify.register(gameRoutes, { prefix: '/api' })`
- Follow existing route registration patterns

### Step 5: Shared - Create Common Game Types
**Files to create:**
- `common/types/games.ts` (new)

**Details:**
- Export `GameStatus` enum for frontend/backend sharing
- Define API response types for all endpoints
- Create interfaces that match backend Game type
- Ensure type consistency across codebase

### Step 6: Frontend - Create GameListPage Component
**Files to create:**
- `frontend/src/pages/games/game-list-page.tsx` (new)

**Details:**
- Shows list of all games with fields: id, status, created_at, updated_at
- "Create Game" button that calls POST /api/games
- Simple list layout with Tailwind styling
- Navigate to individual games via `/games/:id`
- Handle loading and error states
- Use fetch or existing HTTP client patterns

### Step 7: Frontend - Update GamePage for Real Data
**Files to modify:**
- `frontend/src/pages/game/game-page.tsx`

**Details:**
- Replace static content with API call to `GET /api/games/:id`
- Display actual game data (id, status, created_at, updated_at)
- Handle loading states and 404 errors
- Use useEffect for data fetching
- Follow existing page patterns

### Step 8: Frontend - Add Routing and Navigation
**Files to modify:**
- `frontend/src/App.tsx`

**Details:**
- Add `/games` route for GameListPage
- Keep existing `/games/:gameId` route for GamePage
- Add "Games" navigation link to navbar
- Ensure proper route ordering (specific routes before general ones)

### Step 9: Manual Testing and Validation
**Testing checklist:**
- [ ] `POST /api/games` creates game successfully
- [ ] `GET /api/games` returns list of games
- [ ] `GET /api/games/:id` returns single game
- [ ] `GET /api/games/:id` returns 404 for non-existent game
- [ ] GameListPage displays games and create button works
- [ ] GamePage fetches and displays real game data
- [ ] Navigation between list and individual game pages works
- [ ] "Games" nav link works in App.tsx
- [ ] TypeScript builds without errors on both frontend and backend

## Key Implementation Notes

### Database Considerations
- Use existing `varchar(50)` status column (no migration needed)
- Initialize `game_state` as empty object `{}` for new games
- Keep database schema flexible for future game logic

### Code Patterns to Follow
- Repository pattern for data access (like UserRepository)
- Action files for business logic
- Shared types between frontend/backend
- Minimal error handling (prototype mode)
- Basic Tailwind styling

### Dependencies Between Steps
- Steps 1-4 can be done in order for backend foundation
- Step 5 should be done early as it's used by both frontend and backend
- Steps 6-8 depend on backend being complete
- Step 9 requires all previous steps

## Success Criteria
- Users can create games via the UI
- Users can see a list of all games
- Users can view individual game details
- All API endpoints work correctly
- Navigation flows work as expected
- TypeScript compilation succeeds