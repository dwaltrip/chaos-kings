// import { v4 as uuidv4 } from 'uuid';
import { createClient } from 'redis';

import { GameId, UserId } from '@kernel/ids';
import { idToNumber } from '@kernel/branded-type';
import { FFA_NUM_PLAYERS_MAX } from '@common/constants/matchmaking';

import { getClient } from '@/services/redis';
import { createGame } from '@/domains/games/actions/create-game';

// TOOD: is this the best way to handle userIds in Redis?
const redisUserIds = {
  serialize: (userId: UserId): string => idToNumber(userId).toString(),
  deserialize: (str: string): UserId => UserId(Number(str)),
};

type Redis = ReturnType<typeof createClient>;

interface PlayerData {
  username?: string;
  level?: number;
  [key: string]: any;
}

interface QueueEntry {
  playerId: UserId;
  joinedAt: number;
  [key: string]: any;
}

interface MatchmakingGame {
  gameId: GameId;
  players: QueueEntry[];
  createdAt: number;
  status: string;
}

interface QueueStatus {
  queueSize: number;
  playersInQueue: UserId[];
  playersNeeded: number;
}

class MatchmakingService {
  private redis: Redis;
  private playersPerGame: number;
  private queueKey: string;
  private playerDataKey: string;
  private gameKey: string;
  private earlyVotesKey: string;
  private isCreatingGame: boolean = false;

  constructor(redisClient: Redis) {
    this.redis = redisClient;
    this.playersPerGame = FFA_NUM_PLAYERS_MAX;
    this.queueKey = 'matchmaking:queue';
    this.playerDataKey = 'matchmaking:players';
    this.gameKey = 'matchmaking:games';
    this.earlyVotesKey = 'matchmaking:early_votes';
  }

  async addPlayer(
    playerId: UserId,
    playerData: PlayerData = {},
  ): Promise<MatchmakingGame | null> {
    const timestamp = Date.now();
    const queueEntry = {
      playerId,
      joinedAt: timestamp,
      ...playerData,
    };

    await this.redis.hSet(this.playerDataKey, playerId, JSON.stringify(queueEntry));
    await this.redis.zAdd(this.queueKey, {
      score: timestamp,
      value: redisUserIds.serialize(playerId),
    });

    // Reset early-start votes on membership change
    await this.clearEarlyVotes();

    return await this.checkForMatch();
  }

  async removePlayer(playerId: UserId): Promise<void> {
    const userId = redisUserIds.serialize(playerId);
    await this.redis.zRem(this.queueKey, userId);
    await this.redis.hDel(this.playerDataKey, userId);
    // Reset early-start votes on membership change
    await this.clearEarlyVotes();
  }

  // TODO: This is not robust. If enough people join at the same time,
  // we need to carefully create multiple games.
  async checkForMatch(): Promise<MatchmakingGame | null> {
    if (this.isCreatingGame) {
      return null;
    }

    const queueSize = await this.redis.zCard(this.queueKey);

    // Auto start when full
    if (queueSize >= this.playersPerGame) {
      if (this.isCreatingGame) {
        return null;
      }
      this.isCreatingGame = true;
      return await this.createGame(this.playersPerGame);
    }

    // Early start when unanimous and at least 2
    const voteCount = await this.redis.sCard(this.earlyVotesKey);
    if (queueSize >= 2 && voteCount === queueSize) {
      if (this.isCreatingGame) {
        return null;
      }
      this.isCreatingGame = true;
      return await this.createGame(queueSize);
    }

    return null;
  }

  async createGame(playerCount: number): Promise<MatchmakingGame | null> {
    try {
      const playerIds = await this.redis.zRange(this.queueKey, 0, playerCount - 1);

      if (playerIds.length < playerCount) {
        return null;
      }

      const playerDataArray = await this.redis.hmGet(this.playerDataKey, playerIds);
      const players = playerIds.map((id: string, index: number) => ({
        playerId: id,
        ...JSON.parse(playerDataArray[index] || '{}'),
      }));

      // Convert string playerIds to numbers for database
      const userIds = playerIds.map((id) => parseInt(id, 10));

      // Create actual game in database
      const dbGame = await createGame(userIds);

      const matchmakingGame: MatchmakingGame = {
        gameId: dbGame.id,
        players,
        createdAt: Date.now(),
        status: 'starting',
      };

      // Store in Redis for quick lookup (optional)
      await this.redis.hSet(
        this.gameKey,
        dbGame.id.toString(),
        JSON.stringify(matchmakingGame),
      );
      await this.redis.zRem(this.queueKey, playerIds);
      await this.redis.hDel(this.playerDataKey, playerIds);
      // Clear early votes after spawning
      await this.clearEarlyVotes();

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
      playersInQueue: playersInQueue.map(redisUserIds.deserialize),
      playersNeeded: Math.max(0, this.playersPerGame - queueSize),
    };
  }

  async getGame(gameId: string): Promise<MatchmakingGame | null> {
    const gameData = await this.redis.hGet(this.gameKey, gameId);
    return gameData ? JSON.parse(gameData) : null;
  }

  async setEarlyStartVote(playerId: UserId, vote: boolean): Promise<void> {
    const userId = redisUserIds.serialize(playerId);
    if (vote) {
      await this.redis.sAdd(this.earlyVotesKey, userId);
    } else {
      await this.redis.sRem(this.earlyVotesKey, userId);
    }
  }

  async getEarlyStartStatus(): Promise<{
    voters: UserId[];
    queueSize: number;
    allVoted: boolean;
  }> {
    const [voters, queueSize] = await Promise.all([
      (await this.redis.sMembers(this.earlyVotesKey)).map(redisUserIds.deserialize),
      this.redis.zCard(this.queueKey),
    ]);
    const allVoted = queueSize >= 2 && voters.length === queueSize;
    return { voters, queueSize, allVoted };
  }

  private async clearEarlyVotes(): Promise<void> {
    await this.redis.del(this.earlyVotesKey);
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

export { getMatchmakingService };
export type { QueueStatus, MatchmakingGame };
