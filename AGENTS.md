# Chaos Kings - Project Overview (WORK IN PROGRESS)

Hey AI coding agent! My name is Daniel and I'm excited to build with you :)

This project is a revamp + extension of the web-based real time strategy game, **generals.io**.

**⚠️ NOTE: This codebase is undergoing a major refactor. Architecture and conventions are in flux.**

See `epics/2025-10/1-refactor-ws-arch-and-monorepo-structure/` for current refactor status and decisions.

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

## File Naming

- Use **kebab-case** for all filenames: `game-board.tsx`, `matchmaking-service.ts`
- Files end with a **single blank line**

---

## Development Notes

- See `CLAUDE-OLD.md` for historical v1 conventions (may be outdated)
- See refactor epic docs for current architecture decisions
- This file will be expanded as v2 patterns stabilize
