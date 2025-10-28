import { createClient } from 'redis';

let client: ReturnType<typeof createClient> | null = null;

async function getClient() {
  if (client) {
    return client;
  }
  const url = process.env.REDIS_URL || 'redis://localhost:6379/0';
  client = await createClient({ url })
    .on('error', (err) => console.log('Redis Client Error', err))
    .connect();
  return client;

  // await client.set("test-key", "test-value");
  // const value = await client.get("test-key");
  // console.log("redis --- test-key:", value);
  // client.destroy();
}

function destroyClient() {
  if (!client) {
    return;
  }
  client.destroy();
  client = null;
}

export { getClient, destroyClient };
