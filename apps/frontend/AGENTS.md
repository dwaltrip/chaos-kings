# Frontend Patterns

## Store/Action Pattern

**Stores are thin/dumb** - ONLY state and simple setters (NO business logic).

**Handlers are thin/dumb** - ONLY route incoming messages to actions (NO business logic).

**Domain actions contain ALL logic** - validation, orchestration, ws-effects calls.

### Store Structure

Stores should only contain:
- State fields
- Simple setters that call `set()`

```ts
const useFooStore = create<FooState>((set) => ({
  // State
  status: 'idle',
  data: null,

  // Simple setters ONLY
  actions: {
    setStatus: (status) => set({ status }),
    setData: (data) => set({ data }),
    reset: () => set({ status: 'idle', data: null }),
  },
}));

export { useFooStore };
```

### Domain Action Structure

Domain actions live in `actions/` with each action in its own file.

Pull store setters out at the top using destructuring:

```ts
// actions/do-something.ts
import { useFooStore } from '@/domains/foo/stores/foo-store';
import { useBarStore } from '@/domains/bar/stores/bar-store';
import { fooWsEffects } from '@/domains/foo/ws-effects';

function doSomething(arg1: string, arg2: number): void {
  const { status, actions } = useFooStore.getState();
  const { setStatus, setData } = actions;
  const { setOtherThing } = useBarStore.getState().actions;

  if (status !== 'ready') return;

  // Business logic here
  const result = computeSomething(arg1, arg2);

  // Update stores via setters
  setStatus('processing');
  setData(result);
  setOtherThing(result.id);

  // Send WS message if needed
  fooWsEffects.sendSomething(arg1, arg2);
}

export { doSomething };
```

### File Organization

```
domains/foo/
├── actions/
│   ├── index.ts              # Re-exports all actions
│   ├── do-something.ts
│   ├── handle-update.ts      # Inbound WS handler action
│   └── start-foo.ts
├── stores/
│   └── foo-store.ts
├── handlers.ts               # Routes WS messages to actions
├── ws-effects.ts             # Outbound WS messages
├── pages/
└── ui/
```

**Reference implementations:** `domains/gameplay/`, `domains/puzzles/`

---

## Domain Files Overview

Each frontend domain typically has:
- `handlers.ts` - Routes incoming WS messages to domain actions (thin/dumb)
- `actions/` - Domain operations, each in its own file (ALL business logic here)
- `stores/` - Zustand stores (thin/dumb)
- `ws-effects.ts` - Outbound WS messages
- `pages/` - Route entry points and page-specific UI
- `ui/` - Reusable UI components

---

## Import Order

Organize imports from most generic to most specific:

**1. Third-party libraries**
```ts
import { useState } from 'react';
```

**2. Shared packages** (order: utils → kernel → protocol → platform)
```ts
import { formatDate } from '@utils/date-helpers';
import { GameId, UserId } from '@kernel/ids';
import { MsgCreators } from '@protocol/domains/chat/server-messages';
```

**3. App-level code** (generic → specific)
```ts
import { WebSocketService } from '@/services/websocket';        // Services
import { GameState } from '@/domains/game/types';               // Domain types
import { useGameStore } from '@/domains/game/stores/game-store'; // Stores
import { gameActions } from '@/domains/game/actions';           // Domain actions
import { Button } from '@/ui/button';                           // Generic UI
import { GameBoard } from '@/domains/game/ui/game-board';       // Domain UI
import { GameHeader } from '@/domains/game/pages/game-header';  // Page-specific
```

---

## Pages & Components

**Core principle:** Domains own their full vertical slice - pages, UI, state, actions all live together. No top-level `src/pages/` directory.

### pages/ vs ui/

- `pages/` - Route entry points and page-specific components (only used by that page)
- `ui/` - Components used by multiple pages or imported by other domains

**Decision rule:** Start in `pages/`. Move to `ui/` when a second consumer appears.

### Cross-Domain Imports

Cross-domain imports are allowed. Import UI/hooks from other domains when it avoids duplication.

**Keep dependencies flowing one direction.** Example: `gameplay` and `puzzles` import from `games` (shared types/utilities), but `games` never imports from `gameplay` or `puzzles`.
