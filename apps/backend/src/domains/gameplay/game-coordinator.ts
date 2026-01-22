import { GameId, UserId } from '@kernel/ids';

import { DEFAULT_TIMING } from '@core/game-timing-config';
import type { PlayerIndex } from '@core/types';
import type { GameWithPlayers } from '@platform/domains/games/types';

import { createScopedLogger } from '@/utils/scoped-logger';
import { runInContextWithTransaction } from '@/context/app-context';
import { GameServer } from '@/domains/gameplay/game-server';

const moduleLogger = createScopedLogger('GameCoordinator');

interface UserGameSession {
  gameId: GameId;
  playerIndex: PlayerIndex;
}

class GameCoordinator {
  private games: Map<GameId, GameServer> = new Map();
  private userSessions: Map<UserId, UserGameSession> = new Map();
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

    this.log.info(
      `Starting global tick system at ${DEFAULT_TIMING.tickRateMs}ms intervals`,
    );
    this.tickInterval = setInterval(() => {
      void runInContextWithTransaction(async () => {
        await this.tick();
      });
    }, DEFAULT_TIMING.tickRateMs);
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

  addGame(game: GameWithPlayers): void {
    const gameId = GameId(game.id);
    if (this.games.has(gameId)) {
      this.log.info(`Game ${gameId} already exists in registry`);
      return;
    }

    this.log.info(`Adding game ${gameId} to registry`);
    const gameServer = new GameServer(game);
    this.games.set(gameId, gameServer);

    // Auto-register players
    for (const player of game.players) {
      this.userSessions.set(player.user_id, {
        gameId,
        playerIndex: player.player_index,
      });
    }
  }

  removeGame(gameId: GameId): void {
    const gameServer = this.games.get(gameId);
    if (!gameServer) {
      this.log.info(`Attempted to remove non-existent game ${gameId}`);
      return;
    }

    this.log.info(`Removing game ${gameId} from registry`);

    // Auto-cleanup user sessions for this game
    for (const [userId, session] of this.userSessions) {
      if (session.gameId === gameId) {
        this.userSessions.delete(userId);
      }
    }

    gameServer.cleanup();
    this.games.delete(gameId);
  }

  getGame(gameId: GameId): GameServer | undefined {
    return this.games.get(gameId);
  }

  requireGame(gameId: GameId): GameServer {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error(`Game server for game=${gameId} not found`);
    }
    return game;
  }

  getActiveGameCount(): number {
    return this.games.size;
  }

  // Returns gameServer and playerIndex for a user, or undefined if not in a game
  getGameContextForUser(
    userId: UserId,
  ): { gameServer: GameServer; playerIndex: PlayerIndex } | undefined {
    const session = this.userSessions.get(userId);
    if (!session) return undefined;
    const gameServer = this.games.get(session.gameId);
    if (!gameServer) return undefined;
    return { gameServer, playerIndex: session.playerIndex };
  }

  // Check if a user is in a specific game (for join-game validation)
  isUserInGame(userId: UserId, gameId: GameId): boolean {
    const session = this.userSessions.get(userId);
    return session?.gameId === gameId;
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
    this.userSessions.clear();
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
