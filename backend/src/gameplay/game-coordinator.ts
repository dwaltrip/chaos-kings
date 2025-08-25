import { GameServer } from './game-server';
import { TICK_RATE_MS } from '@core/game-timing-config';

class GameCoordinator {
  private games: Map<number, GameServer> = new Map();
  private tickInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startGlobalTick();
  }

  private startGlobalTick(): void {
    if (this.tickInterval) {
      console.warn('[GameCoordinator] Global tick already running');
      return;
    }

    console.log(
      `[GameCoordinator] Starting global tick system at ${TICK_RATE_MS}ms intervals`,
    );
    this.tickInterval = setInterval(() => {
      this.tick();
    }, TICK_RATE_MS);
  }

  private async tick(): Promise<void> {
    if (this.games.size === 0) return;

    for (const [gameId, gameServer] of this.games) {
      try {
        const gameEnded = await gameServer.tick();
        if (gameEnded) {
          console.log(
            `[GameCoordinator] Game ${gameId} ended, removing from registry`,
          );
          this.removeGame(gameId);
        }
      } catch (error) {
        console.error(
          `[GameCoordinator] Error processing game ${gameId}:`,
          error,
        );
        this.removeGame(gameId);
      }
    }
  }

  addGame(gameId: number): void {
    if (this.games.has(gameId)) {
      console.warn(
        `[GameCoordinator] Game ${gameId} already exists in registry`,
      );
      return;
    }

    console.log(`[GameCoordinator] Adding game ${gameId} to registry`);
    const gameServer = new GameServer(gameId);
    this.games.set(gameId, gameServer);
  }

  removeGame(gameId: number): void {
    const gameServer = this.games.get(gameId);
    if (!gameServer) {
      console.warn(
        `[GameCoordinator] Attempted to remove non-existent game ${gameId}`,
      );
      return;
    }

    console.log(`[GameCoordinator] Removing game ${gameId} from registry`);
    gameServer.cleanup();
    this.games.delete(gameId);
  }

  getGame(gameId: number): GameServer | undefined {
    return this.games.get(gameId);
  }

  getActiveGameCount(): number {
    return this.games.size;
  }

  shutdown(): void {
    console.log('[GameCoordinator] Shutting down game coordinator');

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    for (const [gameId, gameServer] of this.games) {
      console.log(
        `[GameCoordinator] Cleaning up game ${gameId} during shutdown`,
      );
      gameServer.cleanup();
    }

    this.games.clear();
  }
}

let gameCoordinator: GameCoordinator | null = null;

export function getGameCoordinator(): GameCoordinator {
  if (!gameCoordinator) {
    gameCoordinator = new GameCoordinator();
  }
  return gameCoordinator;
}

export function initializeGameCoordinator(): GameCoordinator {
  if (gameCoordinator) {
    console.warn('[GameCoordinator] Already initialized');
    return gameCoordinator;
  }

  console.log('[GameCoordinator] Initializing global game coordinator');
  gameCoordinator = new GameCoordinator();
  return gameCoordinator;
}

export { GameCoordinator };
