# Generals v2 - Project Overview

This project is in early prototype phase.

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
- **State**: Zustand (see chat demo store structure)
- **WebSockets**: `WebSocketService` abstraction working in chat demo

### Shared (`/common`)
- Shared TypeScript types between frontend/backend

## Development Commands

### Backend
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JS (Use this to check for TS errors)
- `npm run start` - Run built JS server

### Frontend  
- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production (Use this to check for TS errors)

## Code Conventions and Style

### Frontend Pages
- Each page gets own directory: `frontend/src/pages/$page_name/`
- Page-specific components and CSS stored in page directory
- Reusable components in shared UI components dir outside `/pages`

### Import Patterns
- Use `@/path/to/file` for all local imports (both FE and BE)
- Prefer kebab-casing for filenames

## Comments

- **Comments**: Use very sparingly. NEVER explain what code does - only WHY or crucial context a senior dev couldn't infer
- **NO** verbose/JSDoc style comments. Prefer short, single-line comments.
