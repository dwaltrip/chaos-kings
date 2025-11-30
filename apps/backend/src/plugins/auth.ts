import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { runInContextWithTransaction } from '@/context/app-context';
import { SessionStore } from '@/services/session-store';
import { userRepository } from '@/domains/users/user-repository';
import { USER_KEY_COOKIE_NAME } from '@/domains/users/user-key-cookie';
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  generateSessionId,
} from '@/domains/users/session-cookie';

const authPlugin: FastifyPluginAsync = async (fastify) => {
  const sessionStore = new SessionStore();

  fastify.addHook('preHandler', async (request, reply) => {
    const userKey = request.cookies[USER_KEY_COOKIE_NAME];
    let sessionId = request.cookies[SESSION_COOKIE_NAME];

    if (!userKey) {
      return; // No user key, skip auth
    }

    async function handleAuth(userKey: string, sessionId: string | undefined) {
      const user = await userRepository.findByUserKey(userKey);
      if (!user) {
        console.warn('[auth-plugin] Invalid user key:', userKey);
        reply.clearCookie(USER_KEY_COOKIE_NAME);
        reply.clearCookie(SESSION_COOKIE_NAME);
        return; // Invalid user key
      }

      // Check if we have a valid session
      let sessionData = null;
      if (sessionId) {
        sessionData = await sessionStore.get(sessionId);
      }

      // If no valid session or session doesn't match user, create new session
      if (!sessionData || sessionData.userId !== user.id) {
        sessionId = generateSessionId();
        await sessionStore.create(sessionId, user.id, userKey);
        reply.setCookie(SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);
      } else {
        await sessionStore.updateLastActive(sessionId!);
      }

      console.log('[auth-plugin] User authenticated:', user.id, 'Session ID:', sessionId);
      request.currentUser = {
        id: user.id,
        username: user.username,
        session_id: sessionId!,
        user_key: userKey!,
        created_at: user.created_at.toISOString(),
      };
    }

    try {
      await runInContextWithTransaction(async () => {
        await handleAuth(userKey, sessionId);
      });
    } catch (error) {
      fastify.log.warn(`Failed to authenticate user: ${error}`);
    }
  });
};

export default fp(authPlugin, {
  name: 'auth',
});
