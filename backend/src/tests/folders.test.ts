/** Folders API tests. */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import {
  getTestPool,
  cleanupTestConnections,
  resetTestDatabase,
  createTestUser,
  createTestFolder,
} from './setup';

// Set test environment
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.NODE_ENV = 'test';

describe('Folders API', () => {
  let testUser: { id: string; email: string; accessToken: string };
  
  beforeAll(async () => {
    getTestPool();
  });

  afterAll(async () => {
    await cleanupTestConnections();
  });

  beforeEach(async () => {
    await resetTestDatabase();
    testUser = await createTestUser();
  });

  describe('GET /folders', () => {
    it('should return empty array when no folders exist', async () => {
      const pool = getTestPool();
      
      const result = await pool.query(
        `SELECT * FROM folders WHERE user_id = $1`,
        [testUser.id]
      );
      
      expect(result.rows).toHaveLength(0);
    });

    it('should return all folders for user', async () => {
      await createTestFolder(testUser.id, { name: 'Folder 1' });
      await createTestFolder(testUser.id, { name: 'Folder 2' });
      
      const pool = getTestPool();
      const result = await pool.query(
        `SELECT * FROM folders WHERE user_id = $1 ORDER BY name`,
        [testUser.id]
      );
      
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].name).toBe('Folder 1');
      expect(result.rows[1].name).toBe('Folder 2');
    });
  });

  describe('POST /folders', () => {
    it('should create a root folder', async () => {
      const pool = getTestPool();
      
      const result = await pool.query(
        `INSERT INTO folders (user_id, name, icon_name)
         VALUES ($1, $2, $3)
         RETURNING id, name, parent_id`,
        [testUser.id, 'New Folder', '📁']
      );
      
      expect(result.rows[0].name).toBe('New Folder');
      expect(result.rows[0].parent_id).toBeNull();
    });

    it('should create a subfolder', async () => {
      const parent = await createTestFolder(testUser.id, { name: 'Parent' });
      
      const pool = getTestPool();
      const result = await pool.query(
        `INSERT INTO folders (user_id, name, parent_id)
         VALUES ($1, $2, $3)
         RETURNING id, name, parent_id`,
        [testUser.id, 'Child', parent.id]
      );
      
      expect(result.rows[0].parent_id).toBe(parent.id);
    });

    it('should reject duplicate folder name at same level', async () => {
      await createTestFolder(testUser.id, { name: 'Duplicate' });
      
      const pool = getTestPool();
      
      try {
        await pool.query(
          `INSERT INTO folders (user_id, name, parent_id)
           VALUES ($1, $2, NULL)`,
          [testUser.id, 'Duplicate']
        );
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.code).toBe('23505'); // Unique constraint violation
      }
    });

    it('should allow same name in different parents', async () => {
      const parent1 = await createTestFolder(testUser.id, { name: 'Parent 1' });
      const parent2 = await createTestFolder(testUser.id, { name: 'Parent 2' });
      
      const pool = getTestPool();
      
      // Create 'Child' under parent1
      await pool.query(
        `INSERT INTO folders (user_id, name, parent_id)
         VALUES ($1, 'Child', $2)`,
        [testUser.id, parent1.id]
      );
      
      // Create 'Child' under parent2 - should succeed
      const result = await pool.query(
        `INSERT INTO folders (user_id, name, parent_id)
         VALUES ($1, 'Child', $2)
         RETURNING id`,
        [testUser.id, parent2.id]
      );
      
      expect(result.rows).toHaveLength(1);
    });
  });

  describe('PATCH /folders/:id', () => {
    it('should update folder name', async () => {
      const folder = await createTestFolder(testUser.id, { name: 'Original' });
      
      const pool = getTestPool();
      await pool.query(
        `UPDATE folders SET name = $1, updated_at = NOW() WHERE id = $2`,
        ['Updated', folder.id]
      );
      
      const result = await pool.query(
        `SELECT name FROM folders WHERE id = $1`,
        [folder.id]
      );
      
      expect(result.rows[0].name).toBe('Updated');
    });

    it('should update folder icon', async () => {
      const folder = await createTestFolder(testUser.id);
      
      const pool = getTestPool();
      await pool.query(
        `UPDATE folders SET icon_name = $1 WHERE id = $2`,
        ['🎬', folder.id]
      );
      
      const result = await pool.query(
        `SELECT icon_name FROM folders WHERE id = $1`,
        [folder.id]
      );
      
      expect(result.rows[0].icon_name).toBe('🎬');
    });
  });

  describe('DELETE /folders/:id', () => {
    it('should delete folder and cascade to items', async () => {
      const folder = await createTestFolder(testUser.id);
      
      const pool = getTestPool();
      
      // Add an item to the folder
      await pool.query(
        `INSERT INTO save_items (user_id, source_url, folder_id, status)
         VALUES ($1, 'https://example.com', $2, 'ready')`,
        [testUser.id, folder.id]
      );
      
      // Delete folder
      await pool.query(`DELETE FROM folders WHERE id = $1`, [folder.id]);
      
      // Verify folder is deleted
      const folderResult = await pool.query(
        `SELECT * FROM folders WHERE id = $1`,
        [folder.id]
      );
      expect(folderResult.rows).toHaveLength(0);
    });

    it('should cascade delete to child folders', async () => {
      const parent = await createTestFolder(testUser.id, { name: 'Parent' });
      
      const pool = getTestPool();
      await pool.query(
        `INSERT INTO folders (user_id, name, parent_id)
         VALUES ($1, 'Child', $2)`,
        [testUser.id, parent.id]
      );
      
      // Delete parent
      await pool.query(`DELETE FROM folders WHERE id = $1`, [parent.id]);
      
      // Verify both are deleted
      const result = await pool.query(
        `SELECT * FROM folders WHERE user_id = $1`,
        [testUser.id]
      );
      
      expect(result.rows).toHaveLength(0);
    });
  });

  describe('POST /folders/reorder', () => {
    it('should update sort order for multiple folders', async () => {
      const folder1 = await createTestFolder(testUser.id, { name: 'A' });
      const folder2 = await createTestFolder(testUser.id, { name: 'B' });
      const folder3 = await createTestFolder(testUser.id, { name: 'C' });
      
      const pool = getTestPool();
      
      // Reorder: B, C, A
      const orderedIds = [folder2.id, folder3.id, folder1.id];
      
      for (let i = 0; i < orderedIds.length; i++) {
        await pool.query(
          `UPDATE folders SET sort_order = $1 WHERE id = $2`,
          [i, orderedIds[i]]
        );
      }
      
      // Verify order
      const result = await pool.query(
        `SELECT name FROM folders WHERE user_id = $1 ORDER BY sort_order`,
        [testUser.id]
      );
      
      expect(result.rows[0].name).toBe('B');
      expect(result.rows[1].name).toBe('C');
      expect(result.rows[2].name).toBe('A');
    });
  });
});
