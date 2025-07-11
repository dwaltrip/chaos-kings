import { getClient } from '../services/redis';

const QUEUE_KEY = 'matchmaking-queue';

function getCurrentQueue() {
  // Logic to retrieve the current matchmaking queue
}

async function createQueue() {
  const client = await getClient();
  const exists = await client.exists(QUEUE_KEY);
}

export { getCurrentQueue };
