# Project Status Refresher — March 6, 2026

## What This Project Is

A revamp of **generals.io** — a real-time strategy web game with territory expansion, fog of war, and army movement. Monorepo with React frontend, Node/Fastify backend, PostgreSQL, Redis, and WebSockets.

---

## Development Themes (loosely chronological) 

* Monorepo scaffolding, WebSocket infra, branded types, domain structure
* v1 migration into v2 structure, domain integration (chat, matchmaking, gameplay)
* Core game engine refactoring, replay store, player stats
* Puzzle mode (Best Start), tRPC for REST, puzzle persistence
* Sandbox mode, `TimelineEngine` in `@core` (TDD, 43 tests)
* Game UI Lab, Zustand stack overflow crash, BoardStore design + implementation

---

## Current Focus: Game State Refactor

**Branch:** `game-state-v2`

### The Problem

A "Maximum call stack size exceeded" crash during gameplay revealed deep Zustand brittleness:
- Cross-store sync subscriptions causing cascading re-renders
- `Object.is` failures with new object references (Sets, arrays)
- Bulk synchronous `set()` on hundreds of per-tile Zustand stores
- `useShallow` with Sets not working as expected
- Six specific failure modes documented in `dev-notes/2026-03/3-01-[4]`

### The Solution: BoardStore

A framework-agnostic plain JS class replacing all Zustand board state. Key architecture:

- **Three state buckets:** `BoardSourceState` (server data), `UIState` (selection), `DerivedState` (computed visibility)
- **Single frame array:** `TileData[]` updated in-place with per-tile diffing
- **Subscriber system:** Per-tile and board-level callbacks — only changed tiles notify
- **React bridge:** `useSyncExternalStore` hooks (`useTileData`, `useBoardSourceState`, `BoardTile`)
- **Snapshot stability:** `tileDataCache` ensures `getTileData()` returns stable references

### What Was Built (complete)

```
apps/frontend/src/domains/games/board-store/
├── types.ts              — BoardSourceState, UIState, DerivedState, TileData, FrameDiff
├── tile-data.ts          — computeTileData, tilesEqual, toTileRendererProps
├── frame-computation.ts  — computeDerivedState, computeFrameAndDiff
├── board-store.ts        — BoardStore class + module singleton
├── react-bridge.tsx      — useTileData, useBoardSourceState, BoardTile
└── __tests__/board-store.test.ts — 40 tests, all passing
```

### What It Replaces (not yet wired)

| Old (Zustand) | New (BoardStore) |
|---|---|
| `board-session-store.ts` — flat state with setters | `BoardStore.source` + `BoardStore.ui` |
| `tile-store-registry.ts` — one Zustand store per tile | `BoardStore.frame[]` + `tileDataCache` |
| `tile-orchestrator.ts` — pushes state to tile stores | `computeFrameAndDiff` (single-pass diff) |

### What's NOT Done Yet

- **No integration with any page** (gameplay, sandbox, puzzles)
- **Old Zustand stores still active** — all gameplay actions still use them
- **No removal of old code** — coexistence for now
- **No backend changes**

---

## Other Recent Work

### Game UI Lab (`domains/game-ui-lab/`)

A frontend-only page at `/game-ui-lab` for iterating on board visuals. Renders pre-generated game states frame-by-frame with fog of war and CSS variant switching. Proved that boards render fine without Zustand. Generator script at `tools/generate-ui-lab-data.ts`.

---

## Next Steps

The session prompt (`3-01-[12]`) scopes Part 1 as core + tests only. Follow-up sessions will:
1. Wire `BoardStore` into gameplay page (replace old Zustand flow)
2. Wire into sandbox and puzzle pages
3. Remove old Zustand stores (`board-session-store`, `tile-store-registry`, `tile-orchestrator`)
4. Remove old per-tile subscription hooks and selectors

---

## File Index: Dev Notes (March 2026)

| File | Topic |
|---|---|
| `3-01-[1]` | Game UI Lab spec |
| `3-01-[2]` | Game UI Lab implementation plan |
| `3-01-[3]` | Game UI Lab summary |
| `3-01-[4]` | Zustand crash analysis — 6 failure modes |
| `3-01-[5]` | Refactor session prompt |
| `3-01-[6]` | Research compilation (8 months of notes) |
| `3-01-[7]` | Current game state code survey |
| `3-01-[8]` | Design decisions for new state layer |
| `3-01-[9]` | BoardStore design doc (source of truth) |
| `3-01-[10]` | Design review session prompt |
| `3-01-[11]` | Design review findings |
| `3-01-[12]` | Implementation part 1 prompt (this session) |
| `3-01-[13]` | Implementation part 1 plan |
