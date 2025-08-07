import { getClient } from '@/services/redis';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from 'redis';
import { PLAYERS_PER_GAME } from '@common/constants/matchmaking';
import { createGame } from '@/game/actions/create-game';

type Redis = ReturnType<typeof createClient>;

interface PlayerData {
  username?: string;
  level?: number;
  [key: string]: any;
}

interface QueueEntry {
  playerId: string;
  joinedAt: number;
  [key: string]: any;
}

interface MatchmakingGame {
  gameId: number;
  players: QueueEntry[];
  createdAt: number;
  status: string;
}

interface QueueStatus {
  queueSize: number;
  playersInQueue: string[];
  playersNeeded: number;
}

class MatchmakingService {
  private redis: Redis;
  private playersPerGame: number;
  private queueKey: string;
  private playerDataKey: string;
  private gameKey: string;
  private isCreatingGame: boolean = false;

  constructor(redisClient: Redis) {
    this.redis = redisClient;
    this.playersPerGame = PLAYERS_PER_GAME;
    this.queueKey = 'matchmaking:queue';
    this.playerDataKey = 'matchmaking:players';
    this.gameKey = 'matchmaking:games';
  }

  async addPlayer(playerId: string, playerData: PlayerData = {}): Promise<MatchmakingGame | null> {
    const timestamp = Date.now();
    const queueEntry = {
      playerId,
      joinedAt: timestamp,
      ...playerData
    };

    await this.redis.hSet(this.playerDataKey, playerId, JSON.stringify(queueEntry));
    await this.redis.zAdd(this.queueKey, {
      score: timestamp,
      value: playerId
    });

    return await this.checkForMatch();
  }

  async removePlayer(playerId: string): Promise<void> {
    await this.redis.zRem(this.queueKey, playerId);
    await this.redis.hDel(this.playerDataKey, playerId);
  }

  // TODO: This is not robust. If enough people join at the same time,
  // we need to carefully create multiple games.
  async checkForMatch(): Promise<MatchmakingGame | null> {
    if (this.isCreatingGame) {
      return null;
    }
    
    const queueSize = await this.redis.zCard(this.queueKey);
    
    if (queueSize >= this.playersPerGame) {
      if (this.isCreatingGame) {
        return null;
      }
      this.isCreatingGame = true;
      return await this.createGame();
    }
    
    return null;
  }

  async createGame(): Promise<MatchmakingGame | null> {
    try {
      const playerIds = await this.redis.zRange(this.queueKey, 0, this.playersPerGame - 1);
      
      if (playerIds.length < this.playersPerGame) {
        return null;
      }

      const playerDataArray = await this.redis.hmGet(this.playerDataKey, playerIds);
      const players = playerIds.map((id: string, index: number) => ({
        playerId: id,
        ...JSON.parse(playerDataArray[index] || '{}'),
      }));

      // Convert string playerIds to numbers for database
      const userIds = playerIds.map(id => parseInt(id, 10));
      
      // Create actual game in database
      const dbGame = await createGame({ playerIds: userIds });

      const matchmakingGame: MatchmakingGame = {
        gameId: dbGame.id,
        players,
        createdAt: Date.now(),
        status: 'starting'
      };

      // Store in Redis for quick lookup (optional)
      await this.redis.hSet(this.gameKey, dbGame.id.toString(), JSON.stringify(matchmakingGame));
      await this.redis.zRem(this.queueKey, playerIds);
      await this.redis.hDel(this.playerDataKey, playerIds);
      
      return matchmakingGame;
    } finally {
      this.isCreatingGame = false;
    }
  }

  async getQueueStatus(): Promise<QueueStatus> {
    const queueSize = await this.redis.zCard(this.queueKey);
    const playersInQueue = await this.redis.zRange(this.queueKey, 0, -1);
    
    return {
      queueSize,
      playersInQueue,
      playersNeeded: Math.max(0, this.playersPerGame - queueSize)
    };
  }

  async getGame(gameId: string): Promise<MatchmakingGame | null> {
    const gameData = await this.redis.hGet(this.gameKey, gameId);
    return gameData ? JSON.parse(gameData) : null;
  }
}

let matchmakingService: MatchmakingService | null = null;

async function getMatchmakingService(): Promise<MatchmakingService> {
  if (matchmakingService) {
    return matchmakingService;
  }
  
  const redis = await getClient();
  matchmakingService = new MatchmakingService(redis);
  return matchmakingService;
}

export { MatchmakingService, getMatchmakingService };
export type { QueueStatus, MatchmakingGame };
