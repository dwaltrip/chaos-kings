# Games Feature Implementation Plan - 2025-08-01 (UPDATED)

## Background
User Stories:
* Can create a new game
* Can see list of games
* Can see basic info for game in gamepage (mostly a stub for now)

## Current State Analysis
- Games table exists with: `id`, `game_state`, `status`, `created_at`, `updated_at`
- GamePage exists at route `/games/:gameId` but only shows static info
- Following user system patterns for API structure
- Current `create-game.ts` action is empty - implement from scratch
- Database `status` column is `varchar(50)` - keep as-is, use TS enum in code

## 1. Backend Implementation

### File Structure
```
backend/src/game/
├── types.ts (GameStatus enum + shared types)
├── game-repository.ts (following UserRepository pattern)
├── game-routes.ts
└── actions/
    ├── create-game.ts (implement from scratch)
    ├── list-games.ts 
    └── get-game.ts
```

### Database & Types
- **GameStatus enum**: `'not_started' | 'in_progress' | 'complete'` in `backend/src/game/types.ts`
- **DB schema**: Keep existing `varchar(50)` for status column (no migration needed)
- **game_state field**: Initialize as empty object `{}` for new games
- **Repository pattern**: Create `GameRepository` class following `UserRepository` structure

### Actions (in `backend/src/game/actions/`)
- **create-game.ts** - Creates new game with `not_started` status and empty game_state
- **list-games.ts** - Returns all games using repository
- **get-game.ts** - Returns single game by ID using repository

### API Routes (in `backend/src/game/game-routes.ts`)
- `POST /api/games` - Create new game (returns full game object)
- `GET /api/games` - List all games (returns array of games)  
- `GET /api/games/:id` - Get game by ID (returns single game, 404 if not found)
- **Error handling**: Basic 404 responses, minimal validation

### Integration
- Register game routes in `server.ts`: `fastify.register(gameRoutes, { prefix: '/api' })`

## 2. Frontend Implementation

### GameListPage
- **Location**: `frontend/src/pages/games/game-list-page.tsx`
- **Route**: `/games` (add to App.tsx routing)
- **Features**:
  - Shows list of all games with all fields (id, status, created_at, updated_at)
  - "Create Game" button
  - Simple list layout for prototyping
  - Navigate to individual games via `/games/:id`

### GamePage Updates
- Modify existing `frontend/src/pages/game/game-page.tsx`
- Fetch actual game data via `GET /api/games/:id` API
- Display game info instead of just static text

### Routing Updates (App.tsx)
- Add `/games` route for GameListPage
- Keep existing `/games/:gameId` route for GamePage
- Add "Games" navigation link to navbar

### Shared Types
- **Location**: `common/types/games.ts`
- Export GameStatus enum and API response types
- Import in both frontend and backend

## 3. Implementation Guidelines
- **Prototype mode**: No tests, minimal error handling
- **Follow user system patterns**: Repository class, action files, route structure
- **Simple UI**: Basic styling with Tailwind, no fancy features
- **Empty game_state**: Initialize as `{}`, implement game logic later
- **Type safety**: Use TypeScript enums, but keep DB flexible

## 4. Current App.tsx Routing Reference
```tsx
<Routes>
  <Route index element={<HomePage />} />
  <Route path="games/:gameId" element={<GamePage />} />
  {/* Add: <Route path="games" element={<GameListPage />} /> */}
</Routes>
```

## 5. Manual Testing Items
- [ ] `POST /api/games` creates game successfully
- [ ] `GET /api/games` returns list of games
- [ ] `GET /api/games/:id` returns single game
- [ ] GameListPage displays games and create button works
- [ ] GamePage fetches and displays real game data
- [ ] Navigation between list and individual game pages works
- [ ] "Games" nav link works in App.tsx
