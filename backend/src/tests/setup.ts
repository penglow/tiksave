/** Shared test setup, utilities, and mocks for backend API tests. */

import { Pool } from 'pg';
import Redis from 'ioredis';

const DEFAULT_TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://tiksave:tiksave_password@localhost:5432/tiksave_test';

/** True when the configured test database accepts connections. */
export async function isDatabaseAvailable(): Promise<boolean> {
  const pool = new Pool({
    connectionString: DEFAULT_TEST_DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 2000,
  });
  try {
    await pool.query('SELECT 1');
    await pool.end();
    return true;
  } catch {
    await pool.end().catch(() => {});
    return false;
  }
}

export let dbAvailable = false;

/** Populated by test preload before suites are collected. */
export async function initDbAvailability(): Promise<void> {
  dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable && process.env.REQUIRE_TEST_DB === 'true') {
    throw new Error(
      'Test database is required (REQUIRE_TEST_DB=true) but TEST_DATABASE_URL is unreachable.',
    );
  }
}

// Test database connection
let testPool: Pool | null = null;
let testRedis: Redis | null = null;

/**
 * Get test database pool
 */
export function getTestPool(): Pool {
  if (!testPool) {
    testPool = new Pool({
      connectionString: DEFAULT_TEST_DATABASE_URL,
      max: 5,
    });
  }
  return testPool;
}

/**
 * Get test Redis client
 */
export function getTestRedis(): Redis {
  if (!testRedis) {
    testRedis = new Redis(process.env.TEST_REDIS_URL || 'redis://localhost:6379/1');
  }
  return testRedis;
}

/**
 * Clean up test connections
 */
export async function cleanupTestConnections(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
  if (testRedis) {
    await testRedis.quit();
    testRedis = null;
  }
}

/**
 * Reset test database
 */
export async function resetTestDatabase(): Promise<void> {
  const pool = getTestPool();
  
  // Truncate all tables in reverse dependency order
  await pool.query(`
    TRUNCATE TABLE 
      save_item_locations,
      training_examples,
      user_preferences,
      save_items,
      folders,
      users
    CASCADE;
  `);
}

/**
 * Create a test user
 */
export async function createTestUser(options?: {
  email?: string;
  password?: string;
}): Promise<{ id: string; email: string; accessToken: string }> {
  const pool = getTestPool();
  const bcrypt = await import('bcryptjs');
  const jwt = await import('jsonwebtoken');
  
  const email = options?.email || `test-${Date.now()}@example.com`;
  const password = options?.password || 'testpassword123';
  const passwordHash = await bcrypt.hash(password, 10);
  
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, settings)
     VALUES ($1, $2, '{}')
     RETURNING id, email`,
    [email, passwordHash]
  );
  
  const user = result.rows[0];
  const accessToken = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
  
  return {
    id: user.id,
    email: user.email,
    accessToken,
  };
}

/**
 * Create a test folder
 */
export async function createTestFolder(
  userId: string,
  options?: {
    name?: string;
    parentId?: string;
  }
): Promise<{ id: string; name: string }> {
  const pool = getTestPool();
  
  const result = await pool.query(
    `INSERT INTO folders (user_id, name, parent_id)
     VALUES ($1, $2, $3)
     RETURNING id, name`,
    [userId, options?.name || `Test Folder ${Date.now()}`, options?.parentId || null]
  );
  
  return result.rows[0];
}

/**
 * Create a test save item
 */
export async function createTestItem(
  userId: string,
  options?: {
    sourceUrl?: string;
    status?: string;
    folderId?: string;
    title?: string;
  }
): Promise<{ id: string; sourceUrl: string }> {
  const pool = getTestPool();
  
  const result = await pool.query(
    `INSERT INTO save_items (user_id, source_url, status, folder_id, title)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, source_url`,
    [
      userId,
      options?.sourceUrl || 'https://www.tiktok.com/@test/video/1234567890',
      options?.status || 'ready',
      options?.folderId || null,
      options?.title || 'Test Video',
    ]
  );
  
  return { id: result.rows[0].id, sourceUrl: result.rows[0].source_url };
}

/**
 * Mock HTTP request helper
 */
export function mockRequest(overrides: Partial<{
  body: unknown;
  query: Record<string, string>;
  params: Record<string, string>;
  headers: Record<string, string>;
  userId?: string;
}> = {}): any {
  return {
    body: overrides.body || {},
    query: overrides.query || {},
    params: overrides.params || {},
    headers: {
      'content-type': 'application/json',
      ...overrides.headers,
    },
    userId: overrides.userId,
    requestId: `test-${Date.now()}`,
    ip: '127.0.0.1',
    get: (header: string) => overrides.headers?.[header.toLowerCase()],
  };
}

/**
 * Mock HTTP response helper
 */
export function mockResponse(): any {
  const res: any = {
    statusCode: 200,
    data: null,
    headers: {},
  };
  
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  
  res.json = (data: unknown) => {
    res.data = data;
    return res;
  };
  
  res.setHeader = (key: string, value: string) => {
    res.headers[key] = value;
    return res;
  };
  
  return res;
}

/**
 * Wait for a condition with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs: number = 5000,
  intervalMs: number = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  throw new Error('waitFor timeout exceeded');
}
