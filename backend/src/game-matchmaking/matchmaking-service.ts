import { getClient } from '@/services/redis';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from 'redis';
import { PLAYERS_PER_GAME } from '@common/constants/matchmaking';

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

interface Game {
  gameId: string;
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

  async addPlayer(playerId: string, playerData: PlayerData = {}): Promise<Game | null> {
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

  async checkForMatch(): Promise<Game | null> {
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

  async createGame(): Promise<Game | null> {
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

      const gameId = uuidv4();
      const game = {
        gameId,
        players,
        createdAt: Date.now(),
        status: 'starting'
      };

      await this.redis.hSet(this.gameKey, gameId, JSON.stringify(game));
      await this.redis.zRem(this.queueKey, playerIds);
      await this.redis.hDel(this.playerDataKey, playerIds);
      
      return game;
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

  async getGame(gameId: string): Promise<Game | null> {
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
export type { QueueStatus, Game };
