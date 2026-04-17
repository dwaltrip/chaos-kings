# Chaos Kings - Project Overview

Hey AI coding agent! My name is Daniel and I'm excited to build with you :)

This project is a revamp + extension of the web-based real time strategy game, **generals.io**.

---

## Interaction style

* Be critical and straight-forward, not sycophantic.

* I value good conversation and warmth, but honesty and accuracy are sacred. Don't soften hard truths to be nice.

* When you change your mind or reframe an analysis, be up-front about it. Don't pretend that's what you meant originally.
    * No need to be super apologetic, but be clear and honest about the arc of your thinking — no sleight-of-hand or jarring frame shifts.
    * A small transitional phrase that briefly acknowledges the shift goes very far.

* Our work should be of the highest possible quality. If my reasoning isn't landing for you, or something seems off or missing, say so.

* If you don't have the info you need and can't close the gap with the tools, data, or docs available, let me know! A proactive check-in can save hours of circling and dead-ends.
    * When checking in, I still want to know what you're thinking of trying next. Two reasons: (1) gives me helpful context on where you're at; (2) keeps open the option to just say "thx, keep cooking".
    * You are very capable and I want to fully utilize that — but you don't always have the info and context immediately on hand.
    * Often a small, half-baked nudge from your human (that's me) — a bit of context, intuition, or domain knowledge — can get us out of a rut *or* boost us to the next level on the current task.

---

## Key Documentation

- **docs/architecture.md** - Complete architecture guide (start here for understanding the system)
- **docs/open-questions.md** - Known loose ends, future work, architectural decisions needed
- **AGENTS.md** (this file) - Coding conventions and patterns

---

## Game Design (Generals.io Style)

- **Territory Expansion**: Players start with a general and expand by capturing neutral tiles and enemy territory
- **Army Movement**: Move armies between adjacent tiles to attack/defend; larger armies defeat smaller ones
- **Fog of War**: Players only see tiles they own or are adjacent to; enemy movements hidden until revealed
- **Army Growth**: Cities and the general produce additional troops over time (every ~0.5-1 seconds)
- **Victory**: Win by capturing the enemy general or controlling the most territory when time runs out
- **Gameplay Flow**: Real-time with moves executed at regular intervals; currently targeting 1v1 matches

---

## Tech Stack

### Backend
- Node.js + TypeScript
- PostgreSQL with **Kysely** as SQL builder/query library
- Redis for transient state (active players, game rooms)
- Fastify + WebSockets

### Frontend
- React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS v4
- **Routing:** React Router v7
- **State:** Zustand
- WebSockets with auto-reconnection

### Packages
- **@core** - Pure game engine logic (board, rules, mechanics) with Jest tests
- **@protocol** - WebSocket message types and DTOs
- **@kernel** - Branded ID types and primitives
- **@platform** - Shared domain types/constants (temporary state, see docs/open-questions.md)
- **@utils** - Generic helper functions

---

## Import/Export Patterns (STABLE)

**CRITICAL: These conventions apply to ALL new code, even though existing code may violate them.**

### Import Order

Organize imports from most generic to most specific:

**1. Third-party libraries** (React, Redis, etc.)
```ts
import { useState } from 'react';
import { createClient } from 'redis';
```

**2. Shared packages** (in this order: utils → kernel → protocol → platform)
```ts
import { formatDate } from '@utils/date-helpers';
import { GameId, UserId } from '@kernel/index';
import { MsgCreators } from '@protocol/domains/chat/server-messages';
import { MATCHMAKING_ROOM_ID } from '@platform/domains/matchmaking/constants';
```

**3. App-level code** (generic → specific to current file/page)

**Frontend example:**
```ts
import { WebSocketService } from '@/services/websocket';        // FE-specific utils
import { GameState } from '@/domains/game/types';               // FE domain types
import { useGameStore } from '@/domains/game/store';            // FE stores
import { gameActions } from '@/domains/game/actions';           // FE domain actions
import { Button } from '@/ui/button';                           // FE UI (generic)
import { GameBoard } from '@/domains/game/ui/game-board';       // FE UI (domain)
import { GameHeader } from '@/domains/game/pages/game-header';  // FE UI (page-specific)
```

**Backend example:**
```ts
import { logger } from '@/utils/logger';                        // BE utils
import { HandlerContext } from '@/ws/types';                    // BE generic types
import { GameEntity } from '@/domains/game/types';              // BE domain types
import { db } from '@/db/connection';                           // BE persistence
import { RedisService } from '@/services/redis';                // BE other services
import { gameActions } from '@/domains/game/actions';           // BE domain actions
import { validateMove } from './helpers';                       // File-specific helpers
```

### Export Patterns

**ALWAYS place all exports at the END of files using named export syntax:**

```ts
// ✅ CORRECT
interface FooBaz { foo: string; baz: number; }
function myFunction() { ... }
const myConstant = 42;

export type { FooBaz }; // export types in a separate statement
export { myFunction, myConstant };
```

```ts
// ❌ WRONG - inline exports
export interface FooBaz { foo: string; baz: number; }
export function myFunction() { ... }
export const myConstant = 42;
```

*If there are type exports, then export those in a second export statement before the other one (see the example above).*

### Handling Existing Code

- **Existing code may violate these rules**
- **ALL new code MUST follow these patterns**
- **When editing existing files:** Fix import/export order if you're already touching that section
- **Don't make separate commits just to fix ordering** - fix it as you make functional changes

---

## Domain Structure

Code is organized by **business domain** in both `apps/backend/src/domains/` and `apps/frontend/src/domains/`.

**Current domains:** chat, matchmaking, gameplay, games, users, system

### Backend Domain Files

Each backend domain typically has:
- `handlers.ts` - Routes WebSocket messages to actions (thin, no business logic)
- `actions.ts` - Domain business logic (called by handlers, timers, other code)
- `ws-effects.ts` - Sends outbound WebSocket messages
- `types.ts` - Domain-specific types
- `[entity].db.ts` - Database repositories (optional)

### Frontend Domain Files

Each frontend domain typically has:
- `handlers.ts` - Routes incoming WS messages to domain actions
- `actions/` - Domain operations, each in its own file
- `stores/` - Zustand stores (thin/dumb - NO business logic)
- `ws-effects.ts` - Outbound WS messages
- `pages/` - Route entry points and page-specific UI
- `ui/` - Reusable UI components

**See `apps/frontend/AGENTS.md` for detailed frontend patterns (store/action pattern, examples).**

---

## WebSocket Message Flow

**Key pattern:** handlers → actions → ws-effects

### Incoming Messages
1. WebSocket receives message
2. `handlers.ts` routes to handler function
3. Handler converts primitives → branded types
4. Handler calls action in `actions.ts`
5. Action performs business logic

### Outgoing Messages
1. Application code calls action
2. Action performs business logic
3. Action calls `ws-effects` function
4. WS-effects converts branded types → primitives
5. WS-effects sends via WebSocket bridge

### Handler Guidelines

**Handlers should be thin routers:**
- ✅ Convert types, delegate to actions
- ❌ No business logic in handlers

**Actions are bidirectional:**
- Called by handlers (incoming messages)
- Called by app code (user clicks, timers, etc.)

**See docs/architecture.md for complete WebSocket architecture details.**

---

## Type System

### Branded Types

The codebase uses **branded types** for IDs:

```typescript
type UserId = string & { readonly __brand: 'UserId' };
type GameId = string & { readonly __brand: 'GameId' };
```

**Conversion happens at domain boundaries:**
- **Entry:** Handlers convert `string → GameId` when receiving messages
- **Exit:** WS-effects convert `GameId → string` when sending messages
- **Interior:** All domain logic uses branded types

**Helpers:**
- `toGameId(str)`, `toUserId(str)` - Create branded types
- `idToString(id)` - Convert to primitives

---

## Code Conventions & Style

### File Naming
- Use **kebab-case** for all filenames: `game-board.tsx`, `matchmaking-service.ts`
- Files end with a **single blank line**

### General
- All JavaScript and TypeScript uses **2-space indentation**
- Pre-commit hooks automatically format staged files using Prettier

### Comments
- Use **very sparingly** - NEVER explain what code does, only WHY or crucial context
- NO verbose/JSDoc style comments - prefer short, single-line comments
- Explain non-obvious decisions, not obvious code

---

## Development Workflow

### Build Verification
- **ALWAYS** check builds in frontend and backend for TS errors after making changes
- Use `tools/build-all.sh` to run both, or `npm run build` separately
- Fix any type errors before proceeding or committing changes

### Test Verification
- Run tests after finishing a set of changes
- Use `tools/test-all.sh` to run tests in both backend, frontend, and core
- Fix any test failures before committing changes

### Git Commit Strategy
- Commit after finishing a set of changes; keep messages concise.
- For complex features or difficult debugging work, commit progress frequently to save state.

---

## Development Commands

**Scripts have compact output by default.** Run them directly — no need for `2>&1` or output capturing. Pass `-v` for verbose output only when debugging a failure.

### All
- `tools/build-all.sh` - Build backend + frontend
- `tools/test-all.sh` - Run all tests
- `tools/dev-all.sh` - Start dev server (use this!)
- `tools/run-from-algos.sh <path>` - Run `npx tsx <path>` from `packages/algos` (e.g. `tools/run-from-algos.sh src/some/script.ts`)

### Backend (`apps/backend`)
- `npm run build` - Build TypeScript to JS (check for TS errors)
- `npm test` - Run Jest tests
- `npm run migrate:latest` - Run database migrations

### Frontend (`apps/frontend`)
- `npm run build` - Build for production (check for TS errors)
- `npm test` - Run tests (using vitest)

### Core (`packages/core`)
- `npm test` - Run Jest tests for game logic

---

## Debugging & Troubleshooting

- **docs/DEBUGGING-GUIDE.md** - Contains tricky patterns, gotchas, and solutions for complex issues
- **When debugging complex issues:** Check docs/DEBUGGING-GUIDE.md first - covers non-obvious patterns
- **Common issues covered:** Zustand infinite re-render loops, cross-store subscriptions, React hooks violations, performance debugging
- **When adding new patterns:** Update docs/DEBUGGING-GUIDE.md with problem/solution patterns for future reference

---

## Related Documentation

- **apps/frontend/AGENTS.md** - Frontend-specific patterns (store/action pattern, examples)
- **docs/architecture.md** - Complete architecture guide
- **docs/open-questions.md** - Known loose ends and future work
- **docs/open-questions-history.md** - Resolved questions and historical context
- **docs/DEBUGGING-GUIDE.md** - Debugging patterns and gotchas
