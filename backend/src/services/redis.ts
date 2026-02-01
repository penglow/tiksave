import Redis, { Cluster, ClusterOptions, RedisOptions } from 'ioredis';

// Redis connection configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_CLUSTER_NODES = process.env.REDIS_CLUSTER_NODES; // Comma-separated list of host:port
const REDIS_CLUSTER_MODE = process.env.REDIS_CLUSTER_MODE === 'true';

// Connection pool settings
const POOL_SIZE = parseInt(process.env.REDIS_POOL_SIZE || '10', 10);

// Singleton Redis client for general use
let redisClient: Redis | Cluster | null = null;

// Connection pool for high-throughput scenarios
const connectionPool: Redis[] = [];

/**
 * Parse Redis cluster nodes from environment variable
 */
function parseClusterNodes(): Array<{ host: string; port: number }> {
  if (!REDIS_CLUSTER_NODES) return [];
  
  return REDIS_CLUSTER_NODES.split(',').map(node => {
    const [host, portStr] = node.trim().split(':');
    return { host, port: parseInt(portStr || '6379', 10) };
  });
}

/**
 * Get common Redis options
 */
function getCommonOptions(): Partial<RedisOptions> {
  return {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 5) return null; // Stop retrying after 5 attempts
      return Math.min(times * 200, 3000); // Exponential backoff up to 3s
    },
    enableReadyCheck: true,
    connectTimeout: 10000,
    commandTimeout: 5000,
  };
}

/**
 * Get the shared Redis client instance
 * Supports both standalone and cluster modes
 */
export function getRedisClient(): Redis | Cluster {
  if (!redisClient) {
    const clusterNodes = parseClusterNodes();
    
    if (REDIS_CLUSTER_MODE && clusterNodes.length > 0) {
      // Cluster mode
      console.log('🔗 Connecting to Redis Cluster...');
      const clusterOptions: ClusterOptions = {
        clusterRetryStrategy: (times) => {
          if (times > 5) return null;
          return Math.min(times * 200, 3000);
        },
        redisOptions: getCommonOptions() as RedisOptions,
        enableReadyCheck: true,
        scaleReads: 'slave', // Read from replicas for scalability
      };
      
      redisClient = new Cluster(clusterNodes, clusterOptions);
      
      redisClient.on('error', (err) => {
        console.error('Redis Cluster error:', err);
      });
      
      redisClient.on('ready', () => {
        console.log('✅ Redis Cluster connected');
      });
    } else {
      // Standalone mode
      redisClient = new Redis(REDIS_URL, {
        ...getCommonOptions(),
        lazyConnect: true,
      } as RedisOptions);
      
      redisClient.on('error', (err) => {
        console.error('Redis client error:', err);
      });
      
      redisClient.on('connect', () => {
        console.log('✅ Redis client connected');
      });
    }
  }
  return redisClient;
}

/**
 * Get a connection from the pool for high-throughput operations
 * Falls back to shared client if pool is exhausted
 */
export function getPooledConnection(): Redis {
  // Initialize pool if needed
  if (connectionPool.length === 0 && !REDIS_CLUSTER_MODE) {
    for (let i = 0; i < POOL_SIZE; i++) {
      const conn = new Redis(REDIS_URL, {
        ...getCommonOptions(),
        lazyConnect: true,
      } as RedisOptions);
      connectionPool.push(conn);
    }
    console.log(`📦 Redis connection pool initialized with ${POOL_SIZE} connections`);
  }
  
  // Round-robin selection from pool
  if (connectionPool.length > 0) {
    const conn = connectionPool.shift()!;
    connectionPool.push(conn);
    return conn;
  }
  
  // Fallback to main client
  return getRedisClient() as Redis;
}

/**
 * Check if Redis is connected and healthy
 */
export async function isRedisHealthy(): Promise<boolean> {
  try {
    const client = getRedisClient();
    await client.ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Distributed lock implementation using Redis
 * Uses SET NX with expiry for atomic lock acquisition
 */
export class DistributedLock {
  private client: Redis;
  private lockKey: string;
  private lockValue: string;
  private ttlMs: number;
  private acquired: boolean = false;

  constructor(key: string, ttlMs: number = 60000) {
    this.client = getRedisClient();
    this.lockKey = `lock:${key}`;
    this.lockValue = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.ttlMs = ttlMs;
  }

  /**
   * Attempt to acquire the lock
   * @returns true if lock was acquired, false otherwise
   */
  async acquire(): Promise<boolean> {
    try {
      // SET key value NX PX milliseconds
      // NX - Only set if key doesn't exist
      // PX - Set expiry in milliseconds
      const result = await this.client.set(
        this.lockKey,
        this.lockValue,
        'PX',
        this.ttlMs,
        'NX'
      );
      
      this.acquired = result === 'OK';
      return this.acquired;
    } catch (error) {
      console.error('Failed to acquire distributed lock:', error);
      return false;
    }
  }

  /**
   * Release the lock (only if we own it)
   */
  async release(): Promise<boolean> {
    if (!this.acquired) return true;
    
    try {
      // Use Lua script for atomic check-and-delete
      // Only delete if the value matches (we own the lock)
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      
      const result = await this.client.eval(script, 1, this.lockKey, this.lockValue);
      this.acquired = false;
      return result === 1;
    } catch (error) {
      console.error('Failed to release distributed lock:', error);
      return false;
    }
  }

  /**
   * Extend the lock TTL (only if we own it)
   */
  async extend(additionalMs: number): Promise<boolean> {
    if (!this.acquired) return false;
    
    try {
      // Use Lua script for atomic check-and-extend
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("pexpire", KEYS[1], ARGV[2])
        else
          return 0
        end
      `;
      
      const result = await this.client.eval(
        script, 
        1, 
        this.lockKey, 
        this.lockValue, 
        this.ttlMs + additionalMs
      );
      return result === 1;
    } catch (error) {
      console.error('Failed to extend distributed lock:', error);
      return false;
    }
  }

  /**
   * Check if we currently hold the lock
   */
  isHeld(): boolean {
    return this.acquired;
  }
}

/**
 * Execute a function with a distributed lock
 * @param key - Lock key
 * @param fn - Function to execute while holding the lock
 * @param options - Lock options
 */
export async function withLock<T>(
  key: string,
  fn: () => Promise<T>,
  options: {
    ttlMs?: number;
    waitTimeoutMs?: number;
    retryIntervalMs?: number;
  } = {}
): Promise<T | null> {
  const {
    ttlMs = 60000,
    waitTimeoutMs = 0, // 0 = don't wait, return immediately if lock is held
    retryIntervalMs = 100,
  } = options;

  const lock = new DistributedLock(key, ttlMs);
  const startTime = Date.now();

  // Try to acquire lock (with optional waiting)
  while (true) {
    const acquired = await lock.acquire();
    
    if (acquired) {
      try {
        return await fn();
      } finally {
        await lock.release();
      }
    }
    
    // Check if we should wait
    if (waitTimeoutMs <= 0) {
      return null; // Lock is held by someone else, return immediately
    }
    
    // Check if we've exceeded wait timeout
    if (Date.now() - startTime >= waitTimeoutMs) {
      return null; // Timeout waiting for lock
    }
    
    // Wait before retrying
    await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
  }
}

/**
 * Cache helper with automatic TTL
 */
export class RedisCache {
  private client: Redis;
  private prefix: string;
  private defaultTtlSeconds: number;

  constructor(prefix: string, defaultTtlSeconds: number = 300) {
    this.client = getRedisClient();
    this.prefix = prefix;
    this.defaultTtlSeconds = defaultTtlSeconds;
  }

  private getKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(this.getKey(key));
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      const ttl = ttlSeconds ?? this.defaultTtlSeconds;
      await this.client.setex(this.getKey(key), ttl, serialized);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      await this.client.del(this.getKey(key));
      return true;
    } catch {
      return false;
    }
  }

  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.client.keys(`${this.prefix}:${pattern}`);
      if (keys.length === 0) return 0;
      return await this.client.del(...keys);
    } catch {
      return 0;
    }
  }
}

/**
 * Close all Redis connections (for graceful shutdown)
 */
export async function closeRedisConnections(): Promise<void> {
  // Close pooled connections
  for (const conn of connectionPool) {
    try {
      await conn.quit();
    } catch (e) {
      // Ignore errors during shutdown
    }
  }
  connectionPool.length = 0;
  
  // Close main client
  if (redisClient) {
    try {
      if (redisClient instanceof Cluster) {
        await redisClient.quit();
      } else {
        await (redisClient as Redis).quit();
      }
    } catch (e) {
      // Ignore errors during shutdown
    }
    redisClient = null;
  }
  
  console.log('✅ All Redis connections closed');
}
