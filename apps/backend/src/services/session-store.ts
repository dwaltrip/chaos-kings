import { getClient } from '@/services/redis';

interface SessionData {
  userId: number;
  userKey: string;
  createdAt: number;
  lastActive: number;
}

class SessionStore {
  private readonly PREFIX = 'session:';
  private readonly TTL = 24 * 60 * 60; // 24 hours in seconds

  async create(sessionId: string, userId: number, userKey: string): Promise<void> {
    const sessionData: SessionData = {
      userId,
      userKey,
      createdAt: Date.now(),
      lastActive: Date.now(),
    };

    const redisClient = await getClient();
    await redisClient.setEx(
      `${this.PREFIX}${sessionId}`,
      this.TTL,
      JSON.stringify(sessionData),
    );
  }

  async get(sessionId: string): Promise<SessionData | null> {
    const redisClient = await getClient();
    const data = await redisClient.get(`${this.PREFIX}${sessionId}`);
    if (!data) return null;

    try {
      return JSON.parse(data) as SessionData;
    } catch {
      return null;
    }
  }

  async updateLastActive(sessionId: string): Promise<void> {
    const sessionData = await this.get(sessionId);
    if (sessionData) {
      sessionData.lastActive = Date.now();
      const redisClient = await getClient();
      await redisClient.setEx(
        `${this.PREFIX}${sessionId}`,
        this.TTL,
        JSON.stringify(sessionData),
      );
    }
  }

  async delete(sessionId: string): Promise<void> {
    const redisClient = await getClient();
    await redisClient.del(`${this.PREFIX}${sessionId}`);
  }

  async deleteAllForUser(userId: number): Promise<void> {
    // This is a bit expensive but allows invalidating all sessions for a user
    const redisClient = await getClient();
    const keys = await redisClient.keys(`${this.PREFIX}*`);
    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        try {
          const sessionData = JSON.parse(data) as SessionData;
          if (sessionData.userId === userId) {
            await redisClient.del(key);
          }
        } catch {
          // Invalid session data, delete it
          await redisClient.del(key);
        }
      }
    }
  }
}

export { SessionStore, type SessionData };
