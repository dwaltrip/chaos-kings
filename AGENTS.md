# Chaos Kings - Project Overview

Hey AI coding agent! My name is Daniel and I'm excited to build with you :)

This project is a revamp + extension of the web-based real time strategy game, **generals.io**.

**Architecture:** This codebase recently completed a major WebSocket architecture and monorepo refactor (v2, October 2025). The architecture is now stable with clear patterns and conventions.

**📚 Key Documentation:**
- **docs/architecture.md** - Complete architecture guide (start here for understanding the system)
- **docs/open-questions.md** - Known loose ends, future work, architectural decisions needed
- **AGENTS.md** (this file) - Coding conventions and patterns

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

**2. Shared packages** (in this order: utils → protocol → platform)
```ts
import { formatDate } from '@utils/date-helpers';
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
import { Button } from '@/components/ui/button';                // FE UI (generic)
import { GameBoard } from '@/pages/game/components/game-board'; // FE UI (page-specific)
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

*If there are type exports, then export those in a second export statement before the othe one (see the example above).*

### Handling Existing Code

- **Existing code may violate these rules** - 
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
- `handlers.ts` - Updates stores/state from incoming messages
- `actions.ts` - Domain operations (user interactions, UI logic)
- `stores/` - Zustand stores for domain state
- `components/` - Reusable domain components (used across pages)

**See docs/architecture.md for complete details on domain organization.**

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

## File Naming

- Use **kebab-case** for all filenames: `game-board.tsx`, `matchmaking-service.ts`
- Files end with a **single blank line**

---

## Development Notes

- See `CLAUDE-OLD.md` for historical v1 conventions (may be outdated)
- See `docs/architecture.md` for complete architecture guide
- See `docs/open-questions.md` for known loose ends and future work
