# tRPC Shared Package Plan

## Overview

Restructure tRPC from backend-only to a shared package (`packages/trpc/`). This eliminates cross-project path alias issues while maintaining full type safety.

**Key pattern:** Context-based dependency injection - routers define what services they need via interfaces, backend provides implementations.

## Architecture

```
packages/trpc/              # Shared - types, schemas, router definitions
├── trpc.ts                 # tRPC instance, context type, procedures
├── router.ts               # Main appRouter, AppRouter type export
└── domains/
    └── puzzle/
        ├── types.ts        # PuzzleService interface
        └── router.ts       # puzzleRouter (uses ctx.services)

apps/backend/src/trpc/      # Backend - implementations only
├── context.ts              # Creates context with real service implementations
└── fastify-plugin.ts       # Fastify integration

apps/frontend/              # Frontend - type imports only
└── src/services/
    └── trpc-client.ts      # Imports AppRouter from @trpc/*
```

**Dependency flow:**
```
packages/trpc/
    ↓ imports types from
@protocol, @kernel
    ↓ imported by
apps/backend (implementations)
apps/frontend (types only)
```

**Critical constraint:** `packages/trpc/` must NEVER import from `apps/backend/`.

---

## Service Interface Pattern

### 1. Define service interface (shared package)

```typescript
// packages/trpc/domains/puzzle/types.ts
import type { UserPuzzleStats } from '@protocol/domains/puzzles/api-types';

interface PuzzleService {
  getUserStats(userId: number): Promise<UserPuzzleStats>;
}

export type { PuzzleService };
```

### 2. Router uses service via context (shared package)

```typescript
// packages/trpc/domains/puzzle/router.ts
import { router, protectedProcedure } from '../../trpc';

const puzzleRouter = router({
  getStats: protectedProcedure.query(async ({ ctx }) => {
    return ctx.services.puzzle.getUserStats(ctx.user.id);
  }),
});

export { puzzleRouter };
```

### 3. Context type includes services (shared package)

```typescript
// packages/trpc/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server';
import type { PuzzleService } from './domains/puzzle/types';

interface Services {
  puzzle: PuzzleService;
}

interface TRPCContext {
  user: { id: number; username: string } | null;
  services: Services;
}

const t = initTRPC.context<TRPCContext>().create();

const router = t.router;
const publicProcedure = t.procedure;

const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export type { TRPCContext, Services };
export { router, publicProcedure, protectedProcedure };
```

### 4. Backend wires up implementations

```typescript
// apps/backend/src/trpc/context.ts
import type { FastifyRequest } from 'fastify';
import type { TRPCContext, Services } from '@trpc/trpc';
import { puzzleAttemptRepository } from '@/domains/puzzles/puzzle-attempt-repository';

function createServices(): Services {
  return {
    puzzle: {
      getUserStats: (userId) => puzzleAttemptRepository.getUserStats(userId),
    },
  };
}

function createContext(request: FastifyRequest): TRPCContext {
  const user = request.currentUser;
  return {
    user: user ? { id: user.id, username: user.username } : null,
    services: createServices(),
  };
}

export { createContext };
```

---

## Implementation Steps

### Phase 1: Create Package

1. Create `packages/trpc/` directory
2. Create `package.json` with peer dependencies (@trpc/server, zod)
3. Create `tsconfig.json` with path aliases (@protocol, @kernel, etc.)

### Phase 2: Move tRPC Core

4. Create `packages/trpc/domains/puzzle/types.ts` - PuzzleService interface
5. Create `packages/trpc/trpc.ts` - tRPC instance, context type with services
6. Create `packages/trpc/domains/puzzle/router.ts` - puzzleRouter using ctx.services
7. Create `packages/trpc/router.ts` - appRouter, AppRouter type export

### Phase 3: Update Backend

8. Update `apps/backend/src/trpc/context.ts` - createServices with implementations
9. Update `apps/backend/src/trpc/fastify-plugin.ts` - import appRouter from @trpc
10. Delete moved files: `trpc.ts`, `router.ts`, `domains/puzzles/api.ts`
11. Add `@trpc/*` path alias to backend tsconfig

### Phase 4: Update Frontend

12. Update `tsconfig.app.json`:
    - Add `@trpc/*` path
    - Remove `@backend/*` path
    - Fix `@/*` to only map to `src/*`
13. Update `vite.config.ts`:
    - Add `@trpc` alias
    - Remove `@backend` alias
14. Update `trpc-client.ts` - import from `@trpc/router`

### Phase 5: Verify

15. Run `bash tools/build-all.sh`
16. Run `bash tools/test-all.sh`
17. Manual test puzzle stats endpoint

---

## Adding Future Routers

When adding a new domain (e.g., `user`):

1. **Define interface:** `packages/trpc/domains/user/types.ts`
   ```typescript
   interface UserService {
     getMe(userId: number): Promise<UserProfile>;
   }
   ```

2. **Add to Services:** `packages/trpc/trpc.ts`
   ```typescript
   interface Services {
     puzzle: PuzzleService;
     user: UserService;
   }
   ```

3. **Create router:** `packages/trpc/domains/user/router.ts`

4. **Add to appRouter:** `packages/trpc/router.ts`

5. **Wire implementation:** `apps/backend/src/trpc/context.ts`

---

## Config Files

### packages/trpc/package.json

```json
{
  "name": "@trpc",
  "version": "1.0.0",
  "peerDependencies": {
    "@trpc/server": "^11.x",
    "zod": "^3.x"
  }
}
```

### packages/trpc/tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@protocol/*": ["../protocol/*"],
      "@kernel/*": ["../kernel/*"]
    }
  }
}
```

---

## Trade-offs

**Pros:**
- Clean dependency boundaries
- Type safety preserved
- Testable (mock services)
- Follows tRPC best practices

**Cons:**
- Extra indirection layer
- Boilerplate for service interfaces
- All services loaded per request (can optimize later)

---

## Open Questions

1. **Service granularity** - 1:1 with repository methods, or higher-level? Start 1:1, refactor if needed.

2. **Input validation schemas** - Keep in `packages/trpc/` alongside routers (not in protocol).

3. **Error handling** - Services throw domain errors; routers convert to tRPC errors.
