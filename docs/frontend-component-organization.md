# Frontend Component Organization

## Status

**Experimental pattern** - December 2025

This document describes a new organizational pattern for frontend code. It emerged from reviewing the replay MVP implementation and questioning the `src/pages/` vs `src/domains/` split.

- **New code** should follow this pattern
- **Existing code** should be migrated opportunistically (when you're already touching it)
- **Don't bulk migrate** - update as you work

---

## Core Principle

**Domains own their full vertical slice** - pages, UI, state, and actions all live together.

There is no separate top-level `src/pages/` directory. Each domain contains its own page entry points.

---

## Directory Structure

### Top-level `src/` layout

```
src/
  domains/           # business feature modules (bulk of the code)
  lib/               # generic utilities, hooks (non-UI)
  ui/                # generic UI components (no business logic)
  services/          # app-wide services (websocket, api)
  App.tsx            # routing configuration
```

### Anatomy of a domain

```
domains/
  replay/
    pages/
      replay-page.tsx          # route entry point
      replay-controls.tsx      # page-specific component
      replay-controls.css      # page-specific styles
      use-replay-keyboard.ts   # page-specific hook
    ui/
      replay-board.tsx         # reusable component
      replay-tile.tsx
    stores/
      replay-store.ts
    actions/
      index.ts
      load-replay.ts
      playback-controls.ts
    hooks/
      use-replay-frame.ts      # reusable hook
    handlers.ts                # WebSocket message handlers
    ws-effects.ts              # outbound WebSocket effects
```

---

## Where Things Go

### Pages (`domains/*/pages/`)

Route entry points and everything specific to that page.

**What goes here:**
- Page component (`*-page.tsx`) - the route entry point
- Page-specific components - siblings to the page file
- Page-specific hooks - siblings to the page file
- Page-specific CSS - siblings to the page file

**Key rule:** If it's only used by this one page, it lives in `pages/` as a sibling file.

```
pages/
  replay-page.tsx           # entry point
  replay-controls.tsx       # only used by replay-page
  replay-header.tsx         # only used by replay-page
  use-replay-keyboard.ts    # only used by replay-page
```

### Reusable UI (`domains/*/ui/`)

Components that are used by multiple pages within the domain, or imported by other domains.

**What goes here:**
- Components with multiple consumers
- Components likely to be reused (with concrete expectation, not speculative)
- Components imported by other domains

**Promotion path:** Start in `pages/`. Move to `ui/` when a second consumer appears.

```
ui/
  replay-board.tsx          # used by replay-page, could be used by game-list thumbnails
  replay-tile.tsx           # wraps TileRenderer, reusable
```

### Other domain folders

These follow existing patterns (unchanged):

- `stores/` - Zustand stores
- `actions/` - Business logic, organized by responsibility
- `hooks/` - Reusable hooks (domain-specific)
- `handlers.ts` - WebSocket message handlers
- `ws-effects.ts` - Outbound WebSocket effects

### Generic shared code

**`src/lib/`** - Generic utilities with no domain affiliation
- Helper functions
- Generic hooks (`use-render-counter.ts`, `use-resize-observer.ts`)
- Not UI components

**`src/ui/`** - Generic UI components with no business logic
- Buttons, modals, inputs, cards
- Design system primitives
- No domain-specific knowledge

---

## Cross-Domain Imports

Cross-domain imports are allowed and expected.

```tsx
// domains/replay/ui/replay-tile.tsx
import { TileRenderer } from '@/domains/gameplay/ui/tile-renderer';
```

**Guidelines:**
- Import UI components from other domains when it avoids duplication
- Import hooks/utilities from other domains when appropriate
- Avoid circular dependencies - if A imports from B, B shouldn't import from A
- When circular risk exists, extract shared code to a third domain or `src/lib/`

---

## Routing

Routes remain centralized in `App.tsx`.

```tsx
// App.tsx
import { ReplayPage } from '@/domains/replay/pages/replay-page';
import { GameplayPage } from '@/domains/gameplay/pages/gameplay-page';

<Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/games/:gameId" element={<GameplayPage />} />
  <Route path="/replay/:gameId" element={<ReplayPage />} />
</Routes>
```

This keeps the full route structure visible in one place.

---

## Migration Guide

**Don't bulk migrate.** Update code as you touch it for other reasons.

### Moving a page from `src/pages/` to domain

1. Move `src/pages/foo/foo-page.tsx` to `src/domains/foo/pages/foo-page.tsx`
2. Move `src/pages/foo/components/*` to `src/domains/foo/pages/` (flatten)
3. Update import in `App.tsx`
4. Delete empty `src/pages/foo/` directory

### Deciding pages/ vs ui/

Ask: "Is this used by more than one page, or imported by another domain?"
- **No** → `pages/` (sibling to page file)
- **Yes** → `ui/`
- **Not sure** → Start in `pages/`, promote later

---

## Examples

### Replay Domain (target state)

```
domains/replay/
  pages/
    replay-page.tsx
    replay-controls.tsx
    replay-board.tsx
    replay-tile.tsx
  stores/
    replay-store.ts
  actions/
    index.ts
    load-replay.ts
    jump-to-step.ts
    playback-controls.ts
```

Note: All replay UI is in `pages/` since nothing is reused yet. If a second consumer appears (e.g., mini replay thumbnails on games list), promote to `ui/`.

### Gameplay Domain (target state)

```
domains/gameplay/
  pages/
    gameplay-page.tsx
    gameplay-header.tsx
    gameplay-countdown.tsx
    gameplay-status-info.tsx
    player-colors.tsx
  ui/
    game-board.tsx
    game-board.css
    game-tile.tsx
    game-tile.css
    tile-renderer.tsx       # shared with replay domain
    game-ui.tsx
    move-arrow.tsx
  stores/
    gameplay-store-v2.ts
    game-metadata-store.ts
    tile-orchestrator.ts
  actions/
    index.ts
    join-gameplay.ts
    queue-move.ts
    ...
  hooks/
    use-grid-layout.ts      # used by gameplay and replay
    use-keyboard-controls.ts
    use-tile-store-state.ts
    use-visibility.ts
  handlers.ts
  ws-effects.ts
```

---

## Open Questions

None currently - will add as they arise during adoption.
