# tRPC Integration Plan

## Overview

This plan outlines how to integrate tRPC (vanilla, without TanStack Query) into the Chaos Kings codebase to provide compile-time type safety for REST API calls. The proof-of-concept will migrate the puzzle stats endpoint.

## Goals

1. Add tRPC to backend as a Fastify plugin
2. Create typed tRPC client for frontend
3. Share `AppRouter` type between apps via path alias
4. Migrate `GET /api/puzzles/stats` as proof-of-concept
5. Maintain coexistence with existing Fastify routes

## Non-Goals (for this integration)

- Full migration of all REST endpoints
- TanStack Query integration (using vanilla tRPC)
- Subscriptions (WebSocket already handles real-time)

---

## Dependencies

### Backend (`apps/backend`)

```bash
npm install @trpc/server zod
```

### Frontend (`apps/frontend`)

```bash
npm install @trpc/client
```

---

## Architecture Decisions

### 1. Where to Export AppRouter Type

**Decision:** Export `AppRouter` type from backend, import via `@backend/*` path alias in frontend.

**Rationale:**
- `typeof appRouter` is the true source of type - inferred from actual implementation
- Type-only imports have no runtime cost
- Simpler than duplicating types in protocol package

### 2. Router Organization

```
apps/backend/src/trpc/
├── trpc.ts             # tRPC instance, procedures (router, publicProcedure, protectedProcedure)
├── context.ts          # Context creation from Fastify request
├── router.ts           # Main appRouter, exports AppRouter type
└── fastify-plugin.ts   # Fastify plugin registration

apps/backend/src/domains/puzzles/
├── api.ts              # tRPC procedures (the standard for typed JSON APIs)
└── routes.ts           # Fastify HTTP routes (only when needed for non-JSON responses)
```

**Naming convention:**
- `api.ts` - tRPC procedures (typed JSON API) - most domains will have this
- `routes.ts` - Fastify routes (raw HTTP) - only for file downloads, redirects, webhooks, etc.

### 3. Auth Context Flow

The existing auth plugin sets `request.currentUser` via a `preHandler` hook. The tRPC adapter will:
1. Run after the auth plugin (Fastify hook ordering via `dependencies: ['auth']`)
2. Extract `currentUser` from the request
3. Pass it to tRPC context

### 4. Mount Path

**Decision:** Mount tRPC at `/trpc` alongside existing `/api` routes.

---

## Implementation Steps

### Step 1: Install Dependencies

```bash
cd apps/backend && npm install @trpc/server zod
cd apps/frontend && npm install @trpc/client
```

### Step 2: Backend tRPC Setup

**Create `apps/backend/src/trpc/trpc.ts`:**

```typescript
import { initTRPC, TRPCError } from '@trpc/server';

interface TRPCContext {
  user: { id: number; username: string } | null;
}

const t = initTRPC.context<TRPCContext>().create();

const router = t.router;
const publicProcedure = t.procedure;

const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: { ...ctx, user: ctx.user },
  });
});

export type { TRPCContext };
export { router, publicProcedure, protectedProcedure };
```

**Create `apps/backend/src/trpc/context.ts`:**

```typescript
import type { FastifyRequest } from 'fastify';

import type { TRPCContext } from './trpc';

function createContext(request: FastifyRequest): TRPCContext {
  return {
    user: request.currentUser ?? null,
  };
}

export { createContext };
```

### Step 3: Create Puzzle API

**Create `apps/backend/src/domains/puzzles/api.ts`:**

```typescript
import { router, protectedProcedure } from '@/trpc/trpc';
import { puzzleAttemptRepository } from '@/domains/puzzles/puzzle-attempt-repository';

const puzzleRouter = router({
  getStats: protectedProcedure.query(async ({ ctx }) => {
    return puzzleAttemptRepository.getUserStats(ctx.user.id);
  }),
});

export { puzzleRouter };
```

### Step 4: Create Main App Router

**Create `apps/backend/src/trpc/router.ts`:**

```typescript
import { router } from '@/trpc/trpc';
import { puzzleRouter } from '@/domains/puzzles/api';

const appRouter = router({
  puzzle: puzzleRouter,
});

type AppRouter = typeof appRouter;

export { appRouter };
export type { AppRouter };
```

### Step 5: Create Fastify Plugin

**Create `apps/backend/src/trpc/fastify-plugin.ts`:**

```typescript
import type { FastifyPluginAsync } from 'fastify';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import fp from 'fastify-plugin';

import { appRouter } from '@/trpc/router';
import { createContext } from '@/trpc/context';

const trpcPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext: ({ req }) => createContext(req),
    },
  });
};

export default fp(trpcPlugin, {
  name: 'trpc',
  dependencies: ['auth'],
});
```

### Step 6: Register Plugin in Server

**Modify `apps/backend/src/server.ts`:**

```typescript
// Add import
import trpcPlugin from '@/trpc/fastify-plugin';

// Register after auth plugin (add after line 33)
fastify.register(trpcPlugin);
```

### Step 7: Add Frontend Path Alias

**Modify `apps/frontend/tsconfig.app.json`** - add to `paths`:

```json
"@backend/*": ["../backend/src/*"]
```

**Modify `apps/frontend/vite.config.ts`** - add to `resolve.alias`:

```typescript
'@backend': path.resolve(__dirname, '../backend/src'),
```

### Step 8: Create Frontend tRPC Client

**Create `apps/frontend/src/services/trpc-client.ts`:**

```typescript
import { createTRPCClient, httpLink } from '@trpc/client';

import type { AppRouter } from '@backend/trpc/router';

const getBaseUrl = () => {
  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL;
  return envUrl ?? '';
};

// TODO: Investigate httpBatchLink for batching concurrent requests
const trpc = createTRPCClient<AppRouter>({
  links: [
    httpLink({
      url: `${getBaseUrl()}/trpc`,
      fetch: (url, options) =>
        fetch(url, { ...options, credentials: 'include' }),
    }),
  ],
});

export { trpc };
```

### Step 9: Update Frontend Puzzle API

**Modify `apps/frontend/src/domains/puzzles/api.ts`:**

```typescript
import type { UserPuzzleStats } from '@protocol/domains/puzzles/api-types';

import { trpc } from '@/services/trpc-client';

async function fetchUserStats(): Promise<UserPuzzleStats> {
  return trpc.puzzle.getStats.query();
}

export { fetchUserStats };
```

---

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `apps/backend/src/trpc/trpc.ts` | tRPC instance, procedures |
| `apps/backend/src/trpc/context.ts` | Context creation from Fastify request |
| `apps/backend/src/trpc/router.ts` | Main app router, exports AppRouter type |
| `apps/backend/src/trpc/fastify-plugin.ts` | Fastify integration plugin |
| `apps/backend/src/domains/puzzles/api.ts` | Puzzle domain tRPC procedures |
| `apps/frontend/src/services/trpc-client.ts` | Typed tRPC client |

### Modified Files

| File | Change |
|------|--------|
| `apps/backend/package.json` | Add @trpc/server, zod |
| `apps/frontend/package.json` | Add @trpc/client |
| `apps/backend/src/server.ts` | Register tRPC plugin |
| `apps/frontend/tsconfig.app.json` | Add @backend path alias |
| `apps/frontend/vite.config.ts` | Add @backend resolve alias |
| `apps/frontend/src/domains/puzzles/api.ts` | Use tRPC client |

---

## Type Safety Flow

```
[Backend: puzzleRouter.getStats return type inferred]
        ↓
[Backend: appRouter = router({ puzzle: puzzleRouter })]
        ↓
[Backend: export type AppRouter = typeof appRouter]
        ↓
[Frontend: import type { AppRouter } from '@backend/trpc/router']
        ↓
[Frontend: createTRPCClient<AppRouter>(...)]
        ↓
[Frontend: trpc.puzzle.getStats.query()] // Fully typed!
```

---

## Testing

### Manual Testing

1. Start backend: `cd apps/backend && npm run start`
2. Start frontend: `cd apps/frontend && npm run dev`
3. Open browser devtools Network tab
4. Navigate to puzzle page
5. Verify request to `/trpc/puzzle.getStats` succeeds
6. Verify TypeScript provides autocomplete for `trpc.puzzle.getStats`

### Build Verification

```bash
bash tools/build-all.sh
```

---

## Future Migration Path

Once verified, migrate other endpoints:

1. `GET /api/users/me` → `trpc.user.me.query()`
2. `POST /api/users/auto-create` → `trpc.user.autoCreate.mutate()`
3. `PUT /api/users/me/username` → `trpc.user.updateUsername.mutate()`
4. `GET /api/games/:id` → `trpc.game.getById.query()`
5. `GET /api/games` → `trpc.game.list.query()`

---

## Open Questions

1. **Keep old routes?** Should we remove `puzzle-routes.ts` after migration, or keep for backwards compatibility?

2. **Error handling:** tRPC errors have different shape. Do we need a utility to normalize errors? (Discuss after initial implementation)

## TODOs

1. **Investigate `httpBatchLink`:** We're starting with `httpLink` (one request per call). tRPC also offers `httpBatchLink` which batches concurrent requests into a single HTTP call. Worth investigating for performance once basic integration is working.
