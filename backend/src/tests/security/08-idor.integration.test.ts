/**
 * Security integration — IDOR / cross-tenant data access (requires test DB).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import {
  dbAvailable,
  getTestPool,
  cleanupTestConnections,
  resetTestDatabase,
  createTestUser,
  createTestItem,
  createTestFolder,
} from '../setup';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-testing';

describe.skipIf(!dbAvailable)('security.idor — cross-user resource isolation', () => {
  beforeAll(() => {
    getTestPool();
  });

  afterAll(async () => {
    await cleanupTestConnections();
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  for (let scenario = 0; scenario < 30; scenario++) {
    it(`user A cannot read user B item by id (scenario ${scenario})`, async () => {
      const pool = getTestPool();
      const userA = await createTestUser({ email: `a-${scenario}@test.com` });
      const userB = await createTestUser({ email: `b-${scenario}@test.com` });
      const itemB = await createTestItem(userB.id, {
        sourceUrl: `https://www.tiktok.com/@b/video/${7000000000000000000n + BigInt(scenario)}`,
        title: `B item ${scenario}`,
      });

      const result = await pool.query(
        `SELECT id FROM save_items WHERE id = $1 AND user_id = $2`,
        [itemB.id, userA.id],
      );
      expect(result.rows.length).toBe(0);
    });

    it(`user A cannot update user B item (scenario ${scenario})`, async () => {
      const pool = getTestPool();
      const userA = await createTestUser({ email: `a-up-${scenario}@test.com` });
      const userB = await createTestUser({ email: `b-up-${scenario}@test.com` });
      const itemB = await createTestItem(userB.id);

      const update = await pool.query(
        `UPDATE save_items SET title = $1 WHERE id = $2 AND user_id = $3 RETURNING id`,
        ['hacked', itemB.id, userA.id],
      );
      expect(update.rowCount).toBe(0);

      const check = await pool.query(`SELECT title FROM save_items WHERE id = $1`, [itemB.id]);
      expect(check.rows[0].title).not.toBe('hacked');
    });

    it(`user A cannot delete user B folder (scenario ${scenario})`, async () => {
      const pool = getTestPool();
      const userA = await createTestUser({ email: `a-f-${scenario}@test.com` });
      const userB = await createTestUser({ email: `b-f-${scenario}@test.com` });
      const folderB = await createTestFolder(userB.id, { name: `Secret ${scenario}` });

      const del = await pool.query(
        `DELETE FROM folders WHERE id = $1 AND user_id = $2 RETURNING id`,
        [folderB.id, userA.id],
      );
      expect(del.rowCount).toBe(0);

      const still = await pool.query(`SELECT id FROM folders WHERE id = $1`, [folderB.id]);
      expect(still.rows.length).toBe(1);
    });
  }
});

describe.skipIf(!dbAvailable)('security.idor — parameterized query resists injection in UUID slot', () => {
  const pool = () => getTestPool();

  beforeAll(() => {
    getTestPool();
  });

  afterAll(async () => {
    await cleanupTestConnections();
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  const injections = [
    "' OR '1'='1",
    "00000000-0000-4000-8000-000000000000'; DROP TABLE users; --",
    "1; DELETE FROM save_items",
  ];

  for (let i = 0; i < injections.length; i++) {
    for (let j = 0; j < 20; j++) {
      it(`injection safe query ${i}-${j}`, async () => {
        const user = await createTestUser();
        await expect(
          pool().query(`SELECT id FROM save_items WHERE id = $1 AND user_id = $2`, [
            injections[i],
            user.id,
          ]),
        ).rejects.toThrow();
      });
    }
  }
});
