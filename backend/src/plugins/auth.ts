import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { UserRepository } from '@/user/user-repository';
import { SessionStore } from '@/services/session-store';
import { USER_KEY_COOKIE_NAME } from '@/user/user-key-cookie';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, generateSessionId } from '@/user/session-cookie';

const authPlugin: FastifyPluginAsync = async (fastify) => {
  const sessionStore = new SessionStore();
  
  fastify.addHook('preHandler', async (request, reply) => {
    const userKey = request.cookies[USER_KEY_COOKIE_NAME];
    let sessionId = request.cookies[SESSION_COOKIE_NAME];
    
    if (!userKey) {
      return; // No user key, skip auth
    }
    
    try {
      const userRepository = new UserRepository();
      const user = await userRepository.findByUserKey(userKey);
      
      if (!user) {
        console.warn('[auth-plugin] Invalid user key:', userKey);
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
        // Update last active time
        await sessionStore.updateLastActive(sessionId!);
      }
      
      // Populate currentUser
      request.currentUser = {
        id: user.id.toString(),
        username: user.username || undefined,
        sessionId: sessionId!,
        userKey: userKey!
      };
    } catch (error) {
      fastify.log.warn('Failed to authenticate user:', error);
    }
  });
};

export default fp(authPlugin, {
  name: 'auth',
});
