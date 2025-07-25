# Generals v2 - Project Overview

This project is in early prototype phase.

## Architecture

### Backend
- Node backend with TypeScript
- Redis is set up (can be used for transient state, e.g., active player list in game room)
- PostgreSQL DB is set up, using Kysely as the SQL library
- Generic WebSocket manager + "message-api" abstraction implemented and used in chat demo
- JSON API not implemented yet; we may skip implementing this for a bit longer

### Frontend
- React + TypeScript
- Tailwind CSS is set up
- React Router is set up with dummy pages
- Zustand is used for state management; chat demo has a working store structure we can reuse
- A `WebSocketService` abstraction is implemented and working in the chat demo
- Frontend page file structure: pages each get their own directory in `frontend/src/pages/$page_name`. Page-specific components and CSS can be stored in that directory as well.
- Reusable components can be stored in shared UI components dir outside of /pages

## Development Conventions

- Use "@/path/to/file" for all local imports (both FE and BE)
- Prefer kebab-casing for filenames
- DO NOT use verbose / JS doc style comments
- Comments should be used very sparingly, and NEVER as simple re-explaining what a line of code does. ONLY use for crucial insight / context that a senior developer would be unable to infer / or confused by if they just looked at the raw codebase.