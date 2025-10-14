# Codebase Folder Structure

## Proposed Monorepo Layout

```
/packages
  /core          # core game mechanics, logic, rules (pure domain)
  /kernel        # key, minimal primitives such as branded IDs
  /platform      # everything around the game (pure domains)
    /social      # (example domain) chat/comments, moderation policies
    /lobby       # (example domain) matchmaking, rooms policies
    /profile     # (example domain) identity/preferences
    /stats       # (example domain) leaderboards, aggregates
  /protocol      # wire DTOs/schemas/codecs; only import kernel
  /utils         # helper functions only

/apps
  /backend
    /domains/social    # adapters: repos, handlers, mappers for social
    /domains/lobby     # adapters for lobby
    ...                # DTO↔domain and persistence↔domain live here
  /frontend
    /domains/social    # hooks, view models, WS client usage
    /domains/lobby
    ...
```

## Responsibilities

- **kernel**: Branded IDs, other minimal primitives such as`UnixMs`, `IsoDate` as branded type
- **core**: Gameplay-only pure domain (entities, VOs, services, events). No IO, no protocol.
- **platform/**: Non-gameplay pure domains (social, lobby, curation, profile, stats). No IO. Only for aspects of the domains / features that are shared between backend and frontend.
- **protocol**: Websocket message definitions. DTOs, discriminated unions, and simple message creators. May import *only* kernel primitives.
- **utils**: Generic helpers; no business shapes.
- **apps/backend**: Infra & application (database, api, WS server, game server, source of truth for game state, schedulers, etc)
- **apps/frontend**: Game UI, adapters (hooks, Zustand stores/selectors, WS client)

## Dependency Rules

- Apps (`/apps/*`) may import: `@core`, `@platform/*`, `@kernel`, `@protocol`, `@utils`.
- `@protocol` may import **only** `@kernel`.
- `@core` and `@platform/*` may import `@kernel`, `@utils`; **never** `@protocol`.
- No cross-imports between platform subdomains; promote shared bits to `@kernel`.

## TL;DR

- **core** = gameplay-only, pure.
- **platform/** = non-gameplay pure domains per context.
- **protocol** = stable wire; depends only on **kernel**.
- **kernel** = tiny primitives.
- **apps** = where everythiing comes together; glue code, adapters, persistence, user interfaces, etc.
