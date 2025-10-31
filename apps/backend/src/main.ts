import { initializeGameCoordinator } from '@/domains/gameplay/game-coordinator';
import { startServer } from '@/server';

// Initialize game coordinator
initializeGameCoordinator();

// Start Fastify server
startServer();
