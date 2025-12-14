# Plan B — player identity DTOs and minimized `playerIndex` exposure

Goal: Server emits a canonical `PlayerIdentityDto[]` in gameplay messages; client stores and consumes it directly. `playerIndex` stays as a transport/board detail, not a UI concern. This replaces ad-hoc joins and string/number churn.

## Target data shapes
```ts
// New shared DTO (protocol-level)
type PlayerIdentityDto = {
  playerIndex: PlayerIndex; // only needed to join with board/tile ownership and stats
  userId: UserId;           // branded number
  username: string;
  status: string;           // e.g., active/defeated
  color: string;            // server-derived from index
  isSelf?: boolean;         // optional convenience flag
};

// Gameplay messages (server -> client)
type GameplayServerPayloadMap = {
  'gameplay:game-started': {
    gameId: number;
    boardState: BoardState;
    playerIdentities: PlayerIdentityDto[];
    game: GameWithPlayers; // may drop player_index in future, but keep for now
  };
  'gameplay:state-update': {
    tick: number;
    boardState: BoardState;
    playerQueues?: PlayerQueuesMap;
    playerStats: PlayerStats[]; // still indexed by playerIndex
    playerIdentities?: PlayerIdentityDto[]; // optional but recommended for reconnect resilience
  };
  'gameplay:game-ended': { winner: PlayerIndex; finalBoardState: BoardState };
};
```

## Server-side changes
- **packages/core/src/types.ts**
  - Deprecate/remove `PlayerMapping` export if no longer used by protocol.

- **packages/protocol/domains/gameplay/server-messages.ts**
  - Replace `playerMapping` with `playerIdentities: PlayerIdentityDto[]`.
  - Add `PlayerIdentityDto` export (or import from a new shared location).

- **packages/platform/domains/gameplay/types.ts**
  - Optionally host `PlayerIdentityDto` if we want it outside protocol; otherwise keep in protocol.

- **apps/backend/src/domains/gameplay/game-server.ts**
  - Build `PlayerIdentityDto[]` from `game.players` + internal `playerMapping` Map.
  - Include `color` (derive from index) and `isSelf` if the server knows the recipient; for broadcast, omit `isSelf` or set later per connection if needed.
  - Remove old `getPlayerMapping()` usage for outbound payloads.

- **apps/backend/src/domains/gameplay/ws-effects.ts**
  - Update `broadcastGameStarted`/`broadcastGameState` signatures and message creation to use `playerIdentities`.

## Client-side changes
- **packages/protocol/domains/gameplay/server-messages.ts**
  - Consume the updated message map/types.

- **apps/frontend/src/domains/gameplay/handlers.ts**
  - Expect `playerIdentities` instead of `playerMapping`.
  - Pass through to actions.

- **apps/frontend/src/domains/gameplay/actions/update-for-game-start.ts**
  - Accept `playerIdentities: PlayerIdentityDto[]`.
  - Store in gameplay store v2 (not metadata).
  - Set `currentPlayerIndex` from identities (`find(isSelf)` or from `userId` match).

- **apps/frontend/src/domains/gameplay/actions/update-gameplay-state.ts**
  - Stop recomputing `currentPlayerIndex` per tick; use stored value.
  - Optionally refresh identities if provided on state updates.

- **apps/frontend/src/domains/gameplay/stores/gameplay-store-v2.ts**
  - Add state: `playerIdentities: PlayerIdentityDto[]`, maps (`byIndex`, `byUserId`), and a stable `currentPlayerIndex`.
  - Remove any reliance on `gameMetadataStore.playerMapping`.

- **apps/frontend/src/domains/gameplay/stores/game-metadata-store.ts**
  - Remove `playerMapping` field/actions.

- **UI components**
  - **apps/frontend/src/domains/gameplay/pages/gameplay/army-info.tsx**
    - Use `playerIdentities.byIndex` to resolve names/colors and `playerStats` by index; no string/number parsing.
  - **apps/frontend/src/pages/gameplay/components/player-colors.tsx**
    - Iterate `playerIdentities` (ordered) for colors/labels.
  - **apps/frontend/src/pages/gameplay/components/gameplay-status-info.tsx**
    - Resolve winner via `playerIdentities.byIndex[winner]`.
  - Any other component using `playerMapping` or `game.players.player_index` for UI should switch to the identity map.

- **Utilities**
  - **apps/frontend/src/utils/player-colors.ts**
    - May remain, but server now supplies `color`; UI can consume the provided value instead of recomputing.

## Behavioral notes
- Board/tile ownership still uses `playerIndex` internally; UI never manipulates it directly—only uses it to look up the `PlayerIdentityDto`.
- `PlayerStats` remains indexed by `playerIndex`; UI joins via the identity map, not via parsing IDs.
- Reconnection/resync: If `playerIdentities` is sent on every `state-update`, clients can rebuild state even if they missed `game-started`.

## Migration order (suggested)
1) Protocol/types: add `PlayerIdentityDto`, switch `game-started` to `playerIdentities`.
2) Backend: emit `playerIdentities` in `game-started`; keep `playerMapping` temporarily if needed for compatibility branch.
3) Frontend store/action updates to consume the new DTO and remove `playerMapping` reliance.
4) UI component rewrites to use identity map (army info, colors, status).
5) Optional: include `playerIdentities` on `state-update` and drop old `playerMapping` entirely once consumers are migrated.
