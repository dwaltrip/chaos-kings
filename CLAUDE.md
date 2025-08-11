# Generals v2 - Project Overview

Hey Claude! My name is Daniel and I'm excited to build with you :)

## Background / Current Status
* Multiplayer web game w/ soft realtime gampelay (a few moves a second)
* This project is in early prototype phase.

### Game Design - (Generals.io Style Game)
* **Territory Expansion**: Players start with a general and expand by capturing neutral tiles and enemy territory
* **Army Movement**: Move armies between adjacent tiles to attack/defend; larger armies defeat smaller ones
* **Fog of War**: Players only see tiles they own or are adjacent to; enemy movements hidden until revealed
* **Army Growth**: Cities and the general produce additional troops over time (every ~0.5-1 seconds)
* **Victory**: Win by capturing the enemy general or controlling the most territory when time runs out
* **Gameplay Flow**: Real-time with moves executed at regular intervals; currently targeting 1v1 matches

## Architecture

### Backend (`/backend`)
- Node.js with TypeScript
- **Database**: PostgreSQL with Kysely as SQL builder/query library
- **Cache/State**: Redis for transient state (e.g., active players in game rooms)
- **WebSockets**: Generic WebSocket manager + "message-api" abstraction (see chat demo)
- **REST API**: Not implemented yet; may be skipped for longer

### Frontend (`/frontend`)
- React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4
- **Routing**: React Router v7
- **State**: Zustand (see game-chat store structure)
- **WebSockets**: `WebSocketService` abstraction working in chat demo

### Core (`/core`)
- Pure game domain logic (board state, game rules, etc.)
- Separate from shared utilities and types
- Has its own Jest test suite for game logic validation

### Shared (`/common`)  
- Shared TypeScript types and utilities between frontend/backend
- Validation, constants, and cross-cutting concerns

## Development Commands

### Backend
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JS (Use this to check for TS errors)
- `npm run start` - Run built JS server
- `npm test` / `npm run test:watch` - Run Jest tests
- `npm run migrate:latest` - Run database migrations

### Frontend  
- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production (Use this to check for TS errors)

### Core
- `npm test` / `npm run test:watch` - Run Jest tests for game logic
- `npm run build` - Build TypeScript to JS

## Code Conventions and Style

### General
- All Javascript and Typescript should use 2-space indentation.
- **ALWAYS** use kebab-case for filenames (e.g., `game-page.tsx`, not `GamePage.tsx`)
- Files should **ALWAYS** have a single blank line at the end.

### Frontend Pages
- Each page gets own directory: `frontend/src/pages/$page_name/`
- Page-specific components and CSS stored in page directory
- Reusable components in shared UI components dir outside `/pages`

### Import/Export Patterns
- Use `@/path/to/file` for all local imports (both FE and BE)
- **ALWAYS** place all exports at the end of files using named export syntax: `export { ... }`

## Comments

- **Comments**: Use very sparingly. NEVER explain what code does - only WHY or crucial context a senior dev couldn't infer
- **NO** verbose/JSDoc style comments. Prefer short, single-line comments.
