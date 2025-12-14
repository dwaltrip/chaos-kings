# Player index/mapping data flow — current state and refactor paths

## Purpose
Document how player identity data flows today (DB → backend → WS → frontend stores → UI) and sketch refactor targets that reduce `playerIndex` exposure and duplication.

---

## Current state — data shapes and flow

### Database / platform type
```ts
// packages/platform/domains/games/types.ts
interface Player {
  id: number;
  game_id: number;
  user_id: number;      // numeric DB ID
  status: string;
  player_index: number; // engine-facing
  data: object | null;
}

interface GameWithPlayers extends Game {
  players: Player[];
}
```

### Backend runtime (GameServer)
```ts
// apps/backend/src/domains/gameplay/game-server.ts
private playerMapping: Map<UserId, PlayerIndex>; // userId -> index
private playerQueues: Map<PlayerIndex, QueuedMove[]>;

// broadcastGameStarted payload
MsgCreators.createGameStartedMessage(
  gameId: number,
  playerMapping: { playerId: string; playerIndex: number }[], // string userIds
  boardState: BoardState,                                     // grid uses playerIndex
  game: GameWithPlayers,                                      // includes player_index
);

// broadcastGameState payload (every tick)
MsgCreators.createStateUpdateMessage(
  tick,
  boardState,
  playerQueues?: Record<PlayerIndex, Movement[]>,
  playerStats: Array<{ playerIndex: number; armyCount: number; landCount: number }>,
);
```

### Protocol (server → client)
```ts
// packages/core/src/types.ts
type PlayerMapping = { playerId: string; playerIndex: number }[];

// packages/platform/domains/gameplay/types.ts
type PlayerStats = {
  playerIndex: number;
  armyCount: number;
  landCount: number;
};

// packages/protocol/domains/gameplay/server-messages.ts
type GameplayServerPayloadMap = {
  'gameplay:game-started': {
    gameId: number;
    playerMapping: PlayerMapping; // string ids
    boardState: BoardState;
    game: GameWithPlayers;        // has player_index per player
  };
  'gameplay:state-update': {
    tick: number;
    boardState: BoardState;
    playerQueues?: Record<number, Movement[]>;
    playerStats: PlayerStats[];
  };
  'gameplay:game-ended': {
    winner: PlayerIndex;
    finalBoardState: BoardState;
  };
};
```

### Frontend ingestion (handlers → actions)
```ts
// apps/frontend/src/domains/gameplay/handlers.ts
'gameplay:game-started': ({ game, boardState, playerMapping }) =>
  updateForGameStart(game, boardState, playerMapping);

'gameplay:state-update': ({ tick, boardState, playerQueues, playerStats }) =>
  updateGameplayState(tick, boardState, playerQueues, playerStats);
```

### Frontend stores (current)
```ts
// gameMetadataStore
state: {
  game: GameWithPlayers | null;
  playerMapping: { playerId: string; playerIndex: number }[] | null;
  winner: number | null;
  countdownActive: boolean;
}
actions: setGame, setPlayerMapping, setWinner, ...

// gameplay-store-v2
state: {
  user: User | null;
  game: GameWithPlayers | null;              // synced from metadata store
  boardState: BoardState | null;             // grid uses playerIndex
  playerStats: PlayerStats[];                // indexed by playerIndex
  queuedMoves: Movement[];
  visibleSquares: Set<string>;
}
derived:
  currentPlayerIndex(): number | null {      // recomputed each call
    return game && user ? getCurrentPlayerIndex(game, user.id) : null;
  }
```

### UI consumers (current)
```tsx
// GameplayArmyInfo
buildPlayerRows(
  playerMapping,          // string ids + playerIndex
  playerStats,            // indexed by playerIndex
  game.players,           // has user_id + player_index + maybe username
  currentUser,            // for "You" fallback
)
// parseInt(playerId) to match game.players.user_id
// name fallback: username or current user or "Player N"

// PlayerColors
const mapping = playerMapping?.find(m => m.playerId === player.user_id.toString());
const playerIndex = mapping?.playerIndex ?? player.player_index;
const color = getPlayerColor(playerIndex);

// GameplayStatusInfo
const winnerMapping = playerMapping.find(p => p.playerIndex === winner);
const winnerPlayer = winnerMapping
  ? game.players.find(p => p.user_id.toString() === winnerMapping.playerId)
  : null;

// TileRenderer (colors)
color = getPlayerColor(playerSquare.playerIndex); // direct from board square
```

### Narrative flow (today)
1) DB row → `GameWithPlayers` has `player_index` and `user_id` (number).
2) GameServer stores `Map<UserId, PlayerIndex>` and sends:
   - `gameplay:game-started` with `playerMapping` (string ids) + `game` (includes `player_index`) + `boardState`.
   - `state-update` tick messages with `playerStats` indexed by `playerIndex`.
3) Frontend handlers dispatch to actions.
4) `updateForGameStart` stores `game` and `playerMapping` in `gameMetadataStore`; updates board in `gameplay-store-v2`.
5) `updateGameplayState` recomputes `currentPlayerIndex` each tick from `game + user`; uses it to update visible squares and queue state.
6) UI components join `playerMapping` ↔ `game.players` ↔ `playerStats` on the fly (string/number parsing), and derive names/colors per component.

### Pain points / architectural smells
- Dual sources for identity: `playerMapping` (string ids) and `game.players` (numeric `user_id` + `player_index`) must stay in sync; divergence yields inconsistent UI.
- String/number churn: Protocol exposes `playerId` as string; UI parses to number to match `game.players.user_id`; branded IDs are not enforced at the edge.
- Per-component joins and fallbacks: Each UI builds its own join to find name/color/index, leading to duplicated logic and inconsistent labeling (e.g., “You” vs username vs “Player N”).
- Current player index fragility: `updateGameplayState` throws if `currentPlayerIndex` is null; it recomputes each tick based on game/user sync rather than using the mapping we already have.
- Stats indexing by bare index: `PlayerStats` is an array keyed by `playerIndex`, forcing callers to manage indexes manually instead of a map keyed by identity.
- Leakage of engine detail: `playerIndex` (an engine/board detail) bleeds into UI flows instead of being resolved once to a richer identity object.
- Missing canonical identity DTO: The server sends only raw mapping + game; the client must enrich (username/color/self) repeatedly instead of consuming a stable DTO.

---

## Refactor paths (effort vs. benefit)

### Path A — modest, faster cleanup
- **Protocol**: keep `playerMapping` but switch to numeric/branded `userId: UserId`.
- **Server**: optionally add a lean identity list to `game-started`:
  ```ts
  type PlayerIdentity = {
    playerIndex: PlayerIndex;
    userId: UserId;
    username?: string;
    status?: string;
  };
  ```
- **Frontend**:
  - On `game-started`, build `playerIdentities` map: `byIndex`, `byUserId`, `ordered`, `currentPlayerIndex`.
  - Store it in `gameplay-store-v2` (single source of truth for identity + currentPlayerIndex).
  - Remove `playerMapping` from `gameMetadataStore`.
  - Update UI components to consume `{ player: PlayerIdentity, stats }` (no parseInt or per-component joins).
  - Keep `playerIndex` only for board/tile lookups and stats indexing.
- **Outcome**: eliminates string/number churn, duplicated joins, and `currentPlayerIndex` null throws; minimal protocol change.

### Path B — more aggressive, long-term clarity
- **Protocol**:
  - Replace `playerMapping` with `playerIdentities: PlayerIdentityDto[]` sent on `game-started` and `state-update`.
  - `PlayerIdentityDto` includes color and `isSelf` for convenience:
    ```ts
    type PlayerIdentityDto = {
      playerIndex: PlayerIndex; // transport-only
      userId: UserId;
      username: string;
      status: string;
      color: string;
      isSelf?: boolean;
    };
    ```
  - Consider dropping `player_index` from the `game` object in gameplay payloads (keep it in DB/engine only).
- **Server**: compute identity DTO once from `game.players` and the `playerMapping` Map; attach to gameplay messages.
- **Frontend**:
  - Store the DTO as-is in `gameplay-store-v2`; `currentPlayerIndex` comes from `dto.find(p => p.isSelf)?.playerIndex`.
  - `PlayerStats` stays indexed by `playerIndex`, but all UI resolution is via the DTO map.
  - UIs become pure DTO consumers (no local joins, no color lookup logic).
- **Outcome**: `playerIndex` is an implementation detail of board/grid; UI works with enriched player objects; payloads are clearer and smaller for UI logic.

### Path C — object-graph heavy (likely not worth it now)
- Send full object graphs (game → players → user) in gameplay messages and build rich domain objects on the client.
- Downsides: larger payloads, potential cycles, still need a stable index-to-player map for board squares; more work for limited gain.

---

## Notes on sweet spot
- Path A is the quickest win: normalize client-side, fix ID types, and purge per-component joins without large protocol churn.
- Path B gives longer-term clarity: one DTO from the server, no client joins, hides `playerIndex` from UI, and simplifies reconnection/state-refresh flows.
- Path C is probably overkill for gameplay payloads; better to keep DTOs flat and lean.
