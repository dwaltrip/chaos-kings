# Player Identity Refactor - Implementation Plan

**Date:** 2025-12-13
**Status:** Ready for implementation

## Problem Summary

Player identity data flows through the system with unnecessary complexity:
- `playerMapping` in protocol is redundant with `game.players`
- `Player` type missing `username` (data is fetched, just not typed)
- String/number ID conversions at UI layer
- Per-component joins to resolve player names/colors
- `currentPlayerIndex` recomputed repeatedly instead of stored once
- `calculatePlayerStats` uses brittle `expectedPlayerCount` instead of actual player data

## Solution

Recognize that `game.players` already has everything we need. Fix the types, remove redundant `playerMapping`, and process player identity once at game load time.

---

## Implementation Steps

### Phase 1: Backend Type & Data Fixes

#### 1.1 Fix `Player` type
**File:** `packages/platform/domains/games/types.ts`

Add `username` field:
```ts
interface Player {
  id: number;
  game_id: number;
  user_id: number;
  joined_at: Date | string | undefined;
  status: string;
  player_index: PlayerIndex;
  data: object | null;
  username: string;  // ADD THIS
}
```

#### 1.2 Add `loadGame` action with invariant
**File:** `apps/backend/src/domains/games/actions/load-game.ts` (new)

```ts
import { invariant } from '@utils/assertions/invariant';
import { GameId } from '@kernel/ids';
import type { GameWithPlayers, Player } from '@platform/domains/games/types';
import { gameRepository } from '@/domains/games/game-repository';

class GameNotFoundError extends Error {
  constructor(gameId: GameId) {
    super(`Game not found: ${gameId}`);
  }
}

async function loadGame(gameId: GameId): Promise<GameWithPlayers> {
  const game = await gameRepository.findByIdWithPlayers(gameId);
  if (!game) throw new GameNotFoundError(gameId);

  validatePlayerIndices(game.players);
  return game;
}

function validatePlayerIndices(players: Player[]): void {
  const indices = players.map(p => p.player_index).sort((a, b) => a - b);
  const expected = players.map((_, i) => i);

  invariant(
    indices.every((idx, i) => idx === expected[i]),
    `Player indices must be contiguous starting from 0. Got: [${indices.join(', ')}]`
  );
}

export { loadGame, GameNotFoundError };
```

#### 1.3 Fix `GameServer` constructor
**File:** `apps/backend/src/domains/gameplay/game-server.ts`

Change from forEach index to actual `player_index`:
```ts
// Before
game.players.forEach((player, playerIndex) => {
  this.playerMapping.set(UserId(player.user_id), playerIndex);
  this.playerQueues.set(playerIndex, []);
});

// After
for (const player of game.players) {
  this.playerMapping.set(UserId(player.user_id), player.player_index);
  this.playerQueues.set(player.player_index, []);
}
```

#### 1.4 Fix `calculatePlayerStats`
**File:** `apps/backend/src/domains/gameplay/game-server.ts`

Build from `game.players` instead of `expectedPlayerCount`:
```ts
private calculatePlayerStats(board: BoardState): PlayerStats[] {
  const stats: PlayerStats[] = this.game.players.map(p => ({
    playerIndex: p.player_index,
    armyCount: 0,
    landCount: 0,
  }));

  for (const row of board.grid) {
    for (const square of row) {
      if (!isPlayerSquare(square)) continue;
      const playerStat = stats[square.playerIndex];
      if (playerStat) {
        playerStat.armyCount += square.units;
        playerStat.landCount += 1;
      }
    }
  }

  return stats;
}
```

Remove `expectedPlayerCount` field - use `this.game.players.length` where needed.

#### 1.5 Remove `getPlayerMapping()` method
**File:** `apps/backend/src/domains/gameplay/game-server.ts`

Delete the method entirely - no longer needed.

---

### Phase 2: Protocol Changes

#### 2.1 Remove `playerMapping` from game-started
**File:** `packages/protocol/domains/gameplay/server-messages.ts`

```ts
// Before
'gameplay:game-started': {
  gameId: number;
  playerMapping: PlayerMapping;  // REMOVE
  boardState: BoardState;
  game: GameWithPlayers;
};

// After
'gameplay:game-started': {
  gameId: number;
  boardState: BoardState;
  game: GameWithPlayers;
};
```

Update `MsgCreators.createGameStartedMessage` to remove `playerMapping` parameter.

#### 2.2 Update ws-effects
**File:** `apps/backend/src/domains/gameplay/ws-effects.ts`

Stop passing `playerMapping` to message creator.

#### 2.3 Clean up PlayerMapping type
**File:** `packages/core/src/types.ts`

Remove or deprecate `PlayerMapping` type if no longer used.

---

### Phase 3: Frontend Store Changes

#### 3.1 Update `gameplay-store-v2`
**File:** `apps/frontend/src/domains/gameplay/stores/gameplay-store-v2.ts`

Add player identity state:
```ts
interface GameplayStateV2 {
  // ... existing fields ...

  // Player identity (set once at game load)
  players: Player[];
  playersByIndex: Map<PlayerIndex, Player>;
  playersByUserId: Map<number, Player>;
  currentPlayerIndex: PlayerIndex | null;
  currentPlayer: Player | null;
}
```

Remove the derived `currentPlayerIndex()` getter.

Add action to set player data:
```ts
setPlayerData: (players: Player[], currentUserId: number | null) => {
  const playersByIndex = new Map(players.map(p => [p.player_index, p]));
  const playersByUserId = new Map(players.map(p => [p.user_id, p]));
  const currentPlayer = currentUserId ? playersByUserId.get(currentUserId) ?? null : null;

  set({
    players,
    playersByIndex,
    playersByUserId,
    currentPlayer,
    currentPlayerIndex: currentPlayer?.player_index ?? null,
  });
}
```

#### 3.2 Update `game-metadata-store`
**File:** `apps/frontend/src/domains/gameplay/stores/game-metadata-store.ts`

- Remove `playerMapping` field
- Remove `setPlayerMapping` action
- Extract `loadGame` logic to a proper action (see 3.3)

#### 3.3 Create `loadGame` action
**File:** `apps/frontend/src/domains/gameplay/actions/load-game.ts` (new)

```ts
import { gameMetadataStore } from '@/domains/gameplay/stores/game-metadata-store';
import { gameplayActions } from '@/domains/gameplay/stores/gameplay-store-v2';
import { userStore } from '@/domains/users/user-store';
import { loadGame as apiLoadGame } from '@/domains/games/games-api';

async function loadGame(gameId: string): Promise<void> {
  const { setGame, setCountdownActive } = gameMetadataStore.getState().actions;
  const { setPlayerData } = gameplayActions();
  const currentUser = userStore.getState().user;

  const game = await apiLoadGame(gameId);

  // Set game in metadata store
  setGame(game);

  // Process and store player identity data
  setPlayerData(game.players, currentUser?.id ?? null);

  // Initialize countdown if needed
  if (game.status === 'not_started') {
    setCountdownActive(true);
  }
}

export { loadGame };
```

#### 3.4 Simplify `game-started` handler
**File:** `apps/frontend/src/domains/gameplay/handlers.ts`

Update to not expect `playerMapping`:
```ts
'gameplay:game-started': ({ game, boardState }) => {
  updateForGameStart(game, boardState);
}
```

#### 3.5 Simplify `updateForGameStart`
**File:** `apps/frontend/src/domains/gameplay/actions/update-for-game-start.ts`

Just update board and status - player data already set:
```ts
function updateForGameStart(game: GameWithPlayers, boardState: BoardState) {
  const { setCountdownActive, setGame } = gameMetadataStore.getState().actions;
  const { updateBoard } = gameplayActions();

  setCountdownActive(false);
  setGame(game);  // Update with latest game state
  updateBoard(boardState);
}
```

---

### Phase 4: UI Component Updates

#### 4.1 Update `army-info.tsx`
**File:** `apps/frontend/src/domains/gameplay/pages/gameplay/army-info.tsx`

```tsx
function GameplayArmyInfo() {
  const players = useGameplayStoreV2(state => state.players);
  const playersByIndex = useGameplayStoreV2(state => state.playersByIndex);
  const playerStats = useGameplayStoreV2(state => state.playerStats);
  const currentPlayerIndex = useGameplayStoreV2(state => state.currentPlayerIndex);

  if (!players.length || !playerStats.length) {
    return null;
  }

  return (
    <div className="mb-4 rounded border border-gray-200 bg-white/80 p-3 shadow-sm">
      <div className="mb-2 grid grid-cols-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
        <span>Player</span>
        <span className="text-right">Army</span>
        <span className="text-right">Land</span>
      </div>
      <div className="space-y-2">
        {playerStats.map((stat) => {
          const player = playersByIndex.get(stat.playerIndex)!;
          const isCurrentPlayer = player.player_index === currentPlayerIndex;
          return (
            <ArmyInfoRow
              key={player.id}
              name={isCurrentPlayer ? 'You' : player.username}
              color={getPlayerColor(player.player_index)}
              armyCount={stat.armyCount}
              landCount={stat.landCount}
            />
          );
        })}
      </div>
    </div>
  );
}
```

#### 4.2 Update `player-colors.tsx`
**File:** `apps/frontend/src/pages/gameplay/components/player-colors.tsx`

```tsx
interface PlayerColorsProps {
  players: Player[];
  currentPlayerIndex: PlayerIndex | null;
}

function PlayerColors({ players, currentPlayerIndex }: PlayerColorsProps) {
  if (!players.length) return null;

  return (
    <div className="flex gap-3 items-center">
      <span className="font-medium">Players:</span>
      <div className="flex gap-2">
        {players.map((player) => {
          const isCurrentPlayer = player.player_index === currentPlayerIndex;
          return (
            <div key={player.id} className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded border border-gray-400"
                style={{ backgroundColor: getPlayerColor(player.player_index) }}
              />
              <span className={`text-xs ${isCurrentPlayer ? 'font-bold' : ''}`}>
                {isCurrentPlayer ? 'You' : player.username}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

#### 4.3 Update `gameplay-status-info.tsx`
**File:** `apps/frontend/src/pages/gameplay/components/gameplay-status-info.tsx`

```tsx
interface GameStatusInfoProps {
  game: GameWithPlayers;
  isGameEnded: boolean;
  winner: PlayerIndex | null;
  playersByIndex: Map<PlayerIndex, Player>;
}

function GameStatusInfo({ game, isGameEnded, winner, playersByIndex }: Props) {
  const winnerPlayer = winner !== null ? playersByIndex.get(winner) : null;

  return (
    <>
      <span>
        <strong>Status:</strong> {isGameEnded ? 'COMPLETED' : game.status}
      </span>
      {winnerPlayer && (
        <span>
          <strong>Winner:</strong> {winnerPlayer.username}
        </span>
      )}
    </>
  );
}
```

#### 4.4 Update parent components
Update `gameplay-page.tsx` and other parent components to pass the new props from the store instead of `playerMapping`.

---

## Migration Notes

- This is a breaking protocol change - frontend and backend must be deployed together
- No database migration needed
- Replay system uses its own player structure - can be updated later if needed

## Testing Checklist

- [ ] Game loads correctly, player names/colors display
- [ ] Game start works, board renders
- [ ] Player stats update each tick
- [ ] Winner displays correctly at game end
- [ ] Multiple players see correct "You" label
- [ ] Build passes (frontend + backend)
- [ ] Existing tests pass

## Files Changed

**Backend:**
- `packages/platform/domains/games/types.ts`
- `apps/backend/src/domains/games/actions/load-game.ts` (new)
- `apps/backend/src/domains/gameplay/game-server.ts`
- `apps/backend/src/domains/gameplay/ws-effects.ts`
- `packages/protocol/domains/gameplay/server-messages.ts`
- `packages/core/src/types.ts`

**Frontend:**
- `apps/frontend/src/domains/gameplay/stores/gameplay-store-v2.ts`
- `apps/frontend/src/domains/gameplay/stores/game-metadata-store.ts`
- `apps/frontend/src/domains/gameplay/actions/load-game.ts` (new)
- `apps/frontend/src/domains/gameplay/actions/update-for-game-start.ts`
- `apps/frontend/src/domains/gameplay/handlers.ts`
- `apps/frontend/src/domains/gameplay/pages/gameplay/army-info.tsx`
- `apps/frontend/src/pages/gameplay/components/player-colors.tsx`
- `apps/frontend/src/pages/gameplay/components/gameplay-status-info.tsx`
- `apps/frontend/src/pages/gameplay/gameplay-page.tsx`
