import { TICK_RATE_MS } from '@core/game-timing-config';
import { createScopedLogger } from '@/utils/scoped-logger';
import { GameServer } from '@/gameplay/game-server';

const moduleLogger = createScopedLogger('GameCoordinator');

class GameCoordinator {
  private games: Map<number, GameServer> = new Map();
  private tickInterval: NodeJS.Timeout | null = null;
  private log = moduleLogger;

  constructor() {
    this.startGlobalTick();
  }

  private startGlobalTick(): void {
    if (this.tickInterval) {
      this.log.info('Global tick already running');
      return;
    }

    this.log.info(`Starting global tick system at ${TICK_RATE_MS}ms intervals`);
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
          this.log.info(`Game ${gameId} ended, removing from registry`);
          this.removeGame(gameId);
        }
      } catch (error) {
        this.log.error(`Error processing game ${gameId}:`, error);
        this.removeGame(gameId);
      }
    }
  }

  addGame(gameId: number): void {
    if (this.games.has(gameId)) {
      this.log.info(`Game ${gameId} already exists in registry`);
      return;
    }

    this.log.info(`Adding game ${gameId} to registry`);
    const gameServer = new GameServer(gameId);
    this.games.set(gameId, gameServer);
  }

  removeGame(gameId: number): void {
    const gameServer = this.games.get(gameId);
    if (!gameServer) {
      this.log.info(`Attempted to remove non-existent game ${gameId}`);
      return;
    }

    this.log.info(`Removing game ${gameId} from registry`);
    gameServer.cleanup();
    this.games.delete(gameId);
  }

  getGame(gameId: number): GameServer | undefined {
    return this.games.get(gameId);
  }

  requireGame(gameId: number): GameServer {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error(`Game server for game=${gameId} not found`);
    }
    return game;
  }

  getActiveGameCount(): number {
    return this.games.size;
  }

  shutdown(): void {
    this.log.info('Shutting down game coordinator');

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    for (const [gameId, gameServer] of this.games) {
      this.log.info(`Cleaning up game ${gameId} during shutdown`);
      gameServer.cleanup();
    }

    this.games.clear();
  }
}

let gameCoordinator: GameCoordinator | null = null;

function getGameCoordinator(): GameCoordinator {
  if (!gameCoordinator) {
    gameCoordinator = new GameCoordinator();
  }
  return gameCoordinator;
}

function initializeGameCoordinator(): GameCoordinator {
  if (gameCoordinator) {
    moduleLogger.info('Already initialized');
    return gameCoordinator;
  }

  moduleLogger.info('Initializing global game coordinator');
  gameCoordinator = new GameCoordinator();
  return gameCoordinator;
}

export { getGameCoordinator, initializeGameCoordinator };
