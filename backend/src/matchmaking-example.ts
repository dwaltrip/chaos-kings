import { getClient } from './services/redis';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from 'redis';

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

class MatchmakingQueue {
    private redis: Redis;
    private playersPerGame: number;
    private queueKey: string;
    private playerDataKey: string;
    private gameKey: string;
    private isCreatingGame: boolean = false;

    constructor(redisClient: Redis, playersPerGame: number = 4) {
        this.redis = redisClient;
        this.playersPerGame = playersPerGame;
        this.queueKey = 'matchmaking:queue';
        this.playerDataKey = 'matchmaking:players';
        this.gameKey = 'matchmaking:games';
    }

    // Add a player to the queue
    async addPlayer(playerId: string, playerData: PlayerData = {}): Promise<Game | null> {
        console.log(`🟡 addPlayer called for ${playerId}, isCreatingGame: ${this.isCreatingGame}`);
        
        const timestamp = Date.now();
        const queueEntry = {
            playerId,
            joinedAt: timestamp,
            ...playerData
        };

        // Store player data in a hash
        await this.redis.hSet(this.playerDataKey, playerId, JSON.stringify(queueEntry));
        
        // Add player to the queue (sorted by join time)
        await this.redis.zAdd(this.queueKey, {
            score: timestamp,
            value: playerId
        });

        console.log(`✅ Player ${playerId} added to queue`);
        
        // Check if we can form a game
        const result = await this.checkForMatch();
        console.log(`🎯 checkForMatch result for ${playerId}:`, result ? 'GAME CREATED' : 'NO GAME');
        return result;
    }

    // Remove a player from the queue
    async removePlayer(playerId: string): Promise<void> {
        // Remove from queue
        await this.redis.zRem(this.queueKey, playerId);
        
        // Remove player data
        await this.redis.hDel(this.playerDataKey, playerId);
        
        console.log(`Player ${playerId} removed from queue`);
    }

    // Check if we have enough players to start a game
    async checkForMatch(): Promise<Game | null> {
        console.log(`🔍 checkForMatch called, isCreatingGame: ${this.isCreatingGame}`);
        
        // Prevent concurrent game creation - acquire lock here atomically
        if (this.isCreatingGame) {
            console.log(`🚫 Game creation already in progress, skipping`);
            return null;
        }
        
        const queueSize = await this.redis.zCard(this.queueKey);
        console.log(`📊 Current queue size: ${queueSize}, needed: ${this.playersPerGame}`);
        
        if (queueSize >= this.playersPerGame) {
            // Set lock immediately before proceeding
            if (this.isCreatingGame) {
                console.log(`🚫 Lock acquired by another thread, skipping`);
                return null;
            }
            this.isCreatingGame = true;
            console.log(`🔒 Lock acquired in checkForMatch`);
            
            console.log(`🚀 Enough players! Starting game creation...`);
            return await this.createGame();
        }
        
        console.log(`⏳ Not enough players yet`);
        return null;
    }

    // Create a game with the first N players in queue
    // NOTE: Lock is already acquired in checkForMatch()
    async createGame(): Promise<Game | null> {
        console.log(`🎮 Starting createGame process (lock already acquired)...`);
        
        try {
            // Get the first N players (oldest in queue)
            const playerIds = await this.redis.zRange(this.queueKey, 0, this.playersPerGame - 1);
            console.log(`👥 Found players for game:`, playerIds);
            
            if (playerIds.length < this.playersPerGame) {
                console.log(`❌ Not enough players found: ${playerIds.length} < ${this.playersPerGame}`);
                return null;
            }

            // Get player data for all matched players
            const playerDataArray = await this.redis.hmGet(this.playerDataKey, playerIds);
            const players = playerIds.map((id: string, index: number) => ({
                playerId: id,
                ...JSON.parse(playerDataArray[index] || '{}'),
            }));

            // Create game
            const gameId = uuidv4();
            const game = {
                gameId,
                players,
                createdAt: Date.now(),
                status: 'starting'
            };

            console.log(`💾 Storing game ${gameId}...`);
            // Store game data
            await this.redis.hSet(this.gameKey, gameId, JSON.stringify(game));

            console.log(`🗑️ Removing players from queue:`, playerIds);
            // Remove matched players from queue
            await this.redis.zRem(this.queueKey, playerIds);
            await this.redis.hDel(this.playerDataKey, playerIds);

            console.log(`✅ Game ${gameId} created with players:`, playerIds);
            
            return game;
        } finally {
            console.log(`🔓 Clearing game creation lock`);
            // Always clear the lock
            this.isCreatingGame = false;
        }
    }

    // Get current queue status
    async getQueueStatus(): Promise<QueueStatus> {
        const queueSize = await this.redis.zCard(this.queueKey);
        const playersInQueue = await this.redis.zRange(this.queueKey, 0, -1);
        
        return {
            queueSize,
            playersInQueue,
            playersNeeded: Math.max(0, this.playersPerGame - queueSize)
        };
    }

    // Get all players currently in queue with their data
    async getQueuedPlayers(): Promise<QueueEntry[]> {
        const playerIds = await this.redis.zRange(this.queueKey, 0, -1);
        
        if (playerIds.length === 0) {
            return [];
        }

        const playerDataArray = await this.redis.hmGet(this.playerDataKey, playerIds);
        return playerIds.map((id: string, index: number) => JSON.parse(playerDataArray[index] || '{}'));
    }

    // Clean up expired queue entries (optional)
    async cleanupExpiredPlayers(maxWaitTimeMs: number = 300000): Promise<string[]> { // 5 minutes default
        const cutoffTime = Date.now() - maxWaitTimeMs;
        
        // Get players who have been waiting too long
        const expiredPlayerIds = await this.redis.zRangeByScore(this.queueKey, 0, cutoffTime);
        
        if (expiredPlayerIds.length > 0) {
            // Remove expired players
            await this.redis.zRemRangeByScore(this.queueKey, 0, cutoffTime);
            await this.redis.hDel(this.playerDataKey, expiredPlayerIds);
            
            console.log(`Cleaned up ${expiredPlayerIds.length} expired players`);
        }
        
        return expiredPlayerIds;
    }

    // Get game by ID
    async getGame(gameId: string): Promise<Game | null> {
        const gameData = await this.redis.hGet(this.gameKey, gameId);
        return gameData ? JSON.parse(gameData) : null;
    }
}

// Usage example
async function example() {
    const redis = await getClient();
    // Create matchmaking queue for 4-player games
    const queue = new MatchmakingQueue(redis, 4);

    // Add players to queue
    let game1 = await queue.addPlayer('player1', { username: 'Alice', level: 10 });
    console.log('Game after adding player 1:', game1);
    let game2 = await queue.addPlayer('player2', { username: 'Bob', level: 12 });
    console.log('Game after adding player 2:', game2);
    let game3 = await queue.addPlayer('player3', { username: 'Charlie', level: 8 });
    console.log('Game after adding player 3:', game3);
    
    // Check queue status
    console.log('Queue status:', await queue.getQueueStatus());
    
    // Add fourth player - this should trigger game creation
    let game4 = await queue.addPlayer('player4', { username: 'David', level: 15 });
    
    if (game4) {
        console.log('Game created:', game4);
    }
    
    // Check queue status after game creation
    console.log('Queue status after game:', await queue.getQueueStatus());
}

// Export the MatchmakingQueue class for use in other modules
export { MatchmakingQueue };

// Run the example if this file is executed directly
if (require.main === module) {
  example().catch(console.error);
}
