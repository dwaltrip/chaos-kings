# Backend Integration Plan – Games & Gameplay Domains

**Status:** Draft tactical plan  
**Created:** 2025-10-29  
**Related Docs:**  
- [STRATEGY].md  
- [PROGRESS].md  
- [TODOS].md  
- 10-28-[1]-backend-domain-integration-notes.md

---

## Objective

Migrate the remaining v1 backend logic for the **games** and **gameplay** domains into the v2 architecture without undertaking large-scale refactors. We want to align with the integration patterns used for user/chat/matchmaking while acknowledging gameplay’s heavier stateful flow. The goal is to wire all critical functionality into the new handler → action → ws-effect pipeline, delete obsolete v1 glue, and leave deeper structural cleanups (better user↔game tracking, GameServer redesigns) for follow-up work once the migration is complete.

---

## Current State Recap

- **Games domain (`apps/backend/src/domains/games/`)**
  - Repository (`game-repository.ts`) handles all DB access but still imports through legacy aliases (`@/game/...`).
  - Actions provide `createGame`, `getGame`, `listGames`, `endGame` but are structured for v1 call sites.
  - HTTP routes (`game-routes.ts`) still live under v1 Fastify setup.

- **Gameplay domain (`apps/backend/src/domains/gameplay/`)**
  - `actions.ts` is only a TODO scaffold; all real logic lives in `actions-v0.1/`, `gameplay-ws-api.ts`, and `GameServer`.
  - Handlers convert payloads to branded IDs but lack the ability to resolve `GameId` (hard-coded `-1`).
  - `GameCoordinator` + `GameServer` still rely on the legacy `globalWebSocketManager`.
  - Matchmaking spawn logic imports gameplay internals (`addUserToGame`, etc.).

---

## Plan Overview

We’ll execute in three layered passes—**Easy**, **Medium**, **Harder / Deferred**—to keep the migration moving while deferring riskier refactors.

### 1. Easy Wins (Unblock v2 wiring)

1. **Finalize handlers & delete stubs**
   - Replace temporary logic in `apps/backend/src/domains/gameplay/handlers.ts` so each handler derives the proper `GameId` and calls real actions.
   - Remove legacy `gameplay-ws-api.ts`, `ws-effects-v0.1.ts`, and `actions-v0.1/` once v2 equivalents are in place.
   - Fix imports in the games domain to point at `@/domains/games/...` so TypeScript resolves after we move code.

   ```ts
   const gameplayHandlers = {
     'gameplay:move-request': ({ sourceCoord, direction }, ctx) => {
       const gameId = gameplayActions.resolveUserGame(UserId(ctx.userId));
       if (!gameId) return; // TODO: add telemetry
       gameplayActions.queueMove(sourceCoord, direction, gameId, UserId(ctx.userId));
     },
     // ...
   } satisfies HandlerMapWithCtx<GameplayClientMessage, AppHandlerContext>;
   ```

2. **Adopt v2 ws-effects**
   - Swap direct `getGlobalWebSocketManager().serverBroadcastToRoom(...)` calls with the new `gameplayWsEffects` helpers.
   - Broadcast signatures already align with protocol creators, so this is largely a rename + branded ID conversion.

   ```ts
   gameplayWsEffects.broadcastGameState(roomId, tick, boardState, this.getPlayerQueues());
   gameplayWsEffects.broadcastGameStarted(roomId, this.gameId, mapping, boardState, game);
   ```

### 2. Medium Integration Work (Minimal behavior change)

1. **Expose gameplay actions that wrap coordinator/server**
   - Move v1 logic from `actions-v0.1` into named functions under `apps/backend/src/domains/gameplay/actions/`.
   - Each action should use branded IDs, call into `GameCoordinator`, and rely on `gameplayWsEffects` for outbound messages.
   - Provide helper(s) for matchmaking to call instead of reaching into gameplay internals.

   ```ts
   async function queueMove(
     userId: UserId,
     source: Coord,
     direction: Direction,
   ): Promise<void> {
     const gameServer = gameCoordinator.requireGame(resolveUserGame(userId));
     gameServer.queueMove(idToNumber(userId), source, direction);
   }
   ```

2. **Integrate room lifecycle with system actions**
   - Wire `systemActions.joinRoom/leaveRoom` into gameplay join/leave flows.
   - Ensure `GameServer.onPlayerJoinedRoom` continues to run so countdown behavior remains intact.

3. **Adjust matchmaking spawn boundaries**
   - Replace the `import { addUserToGame } from '@/domains/gameplay/gameplay-ws-api'` pattern with a public gameplay action (e.g., `gameplayActions.registerPlayersForGame(gameId, players)`).
   - Keep logic mostly identical, but ensure the exported API lives under the gameplay domain instead of leaking helper modules.

4. **Update games domain imports**
   - Move `GameRepository`, `GamePlayersRepository`, and action files into the `@/domains/games/...` namespace so future consumers don’t rely on v1 path aliases.
   - No major logic changes—just align with the module boundaries established during other domain migrations.

### 3. Harder / Deferred Items (Track as follow-ups)

1. **User ↔ game lookup**
   - Current pattern: `actions-v0.1/user-game-mapping.ts` maintains an in-memory `Map<UserId, GameId>`.
   - Near-term approach: wrap this map in a branded helper under gameplay actions and document limitations (single node, no persistence).
   - Deferred work: design a durable lookup tied to DB state or the system domain membership tracker.

2. **GameCoordinator & GameServer refactor**
   - For the migration, keep these classes mostly untouched—only inject new dependencies (ws bridge, branded IDs) as needed.
   - Future phase: evaluate isolating timers, persistence, and broadcast logic into smaller services, similar to the plan for MatchmakingService.

3. **Fastify route alignment**
   - The `game-routes.ts` file still matches the v1 router structure. Defer adapting it to the new plugin system until after websocket integration to avoid blocking gameplay work.

---

## Implementation Notes & Sequencing

1. **Stabilize public APIs**
   - Define a single entry point for gameplay actions (`apps/backend/src/domains/gameplay/actions/index.ts`) that exports join/leave/queue/cancel/undo helpers.
   - Update consumers (handlers, matchmaking spawn) to import from this barrel.

2. **Matchmaking → gameplay handshake**
   - Introduce a method like `gameplayActions.prepareGameInstance(gameId, players)` that encapsulates:
     - Coordinator registration (`gameCoordinator.addGame`).
     - User ↔ game registration (temporary map for now).
   - `spawnGameInstance` then becomes a thin delegator.

   ```ts
   import { gameplayActions } from '@/domains/gameplay/actions';
   // ...
   await gameplayActions.prepareGameInstance(GameId(game.gameId), game.players);
   ```

3. **Replace legacy broadcasts incrementally**
   - Modify `GameServer` methods to call `gameplayWsEffects` while leaving method bodies otherwise unchanged.
   - Keep the existing countdown/tick flow intact during the migration.

4. **Remove old files only after new path is wired**
   - Stage deletions once handlers/actions reference the new modules and tests (manual or automated) confirm message flow continues.
   - Record deletions in commit notes for easy rollback if needed.

5. **Document follow-ups**
   - Add TODOs inline where we knowingly defer improvements (e.g., “// TODO: replace in-memory mapping with persistent lookup”).
   - Mirror those tasks in [TODOS].md so they stay visible for the post-migration refactor phase.

---

## Risks & Mitigations

- **Race conditions in countdown/start logic:** Keeping GameServer logic untouched minimizes behavioral drift. Any new adapters should be thin wrappers.
- **Cross-domain coupling:** Giving matchmaking a formal gameplay action to call keeps boundaries clearer and aligns with the backlog note about spawn logic sharing.
- **State tracking gaps:** Document limitations of the temporary user↔game map (single process, volatile). Mitigate by encapsulating access and providing safe fallbacks (logging, early return) when lookups fail.
- **Import alias churn:** Plan a single pass across the games/gameplay modules to update paths; running TypeScript checks after each batch will help catch typos early.

---

## Acceptance Criteria

- Gameplay handlers call branded, fully implemented actions (no `TODO` placeholders in runtime paths).
- Matchmaking actions no longer import gameplay internals directly; they call gameplay’s public API.
- Legacy v1 websocket glue (`gameplay-ws-api.ts`, `ws-effects-v0.1.ts`, `actions-v0.1/`) is removed once replacements are live.
- Game broadcasts go through `gameplayWsEffects` and the shared `wsBridge`.
- Documentation (this tactical doc + inline TODOs + [TODOS].md) reflects remaining deferred work: persistent user↔game lookup, GameServer cleanup, HTTP route realignment.

---

## Next Steps

1. Implement Easy wins (handlers, ws-effects replacement, import cleanup).
2. Port gameplay actions and adjust matchmaking spawn integration.
3. Remove legacy files and validate end-to-end message flow.
4. Log deferred items in [TODOS].md and schedule follow-up refactor work post-migration.

