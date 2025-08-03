import 'fastify';

declare module 'fastify' {
  export interface FastifyRequest {
    currentUser?: {
      id: string;
      username?: string;
      sessionId: string;
      userKey: string;
    };
  }
}