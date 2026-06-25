import { createClient, type RedisClientType } from 'redis';

/**
 * Lazily-created singleton redis client. Returns null when REDIS_URL is unset so
 * callers can degrade gracefully (e.g. screenshots just won't render). The
 * connection is reused across requests in the long-lived Node server process.
 */
let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType> | null = null;

export async function getRedis(): Promise<RedisClientType | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  if (client?.isReady) return client;
  if (connecting) return connecting;

  connecting = (async () => {
    const c: RedisClientType = createClient({ url });
    c.on('error', (err) => console.error('Redis client error:', err));
    await c.connect();
    client = c;
    connecting = null;
    return c;
  })();

  try {
    return await connecting;
  } catch (err) {
    connecting = null;
    console.error('Redis connection failed:', err);
    return null;
  }
}
