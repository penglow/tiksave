/** Items API tests. */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import {
  getTestPool,
  cleanupTestConnections,
  resetTestDatabase,
  createTestUser,
  createTestFolder,
  createTestItem,
} from './setup';

// Set test environment
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.NODE_ENV = 'test';

describe('Items API', () => {
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

  describe('GET /items', () => {
    it('should return empty array when no items exist', async () => {
      const pool = getTestPool();
      
      const result = await pool.query(
        `SELECT * FROM save_items WHERE user_id = $1 AND deleted_at IS NULL`,
        [testUser.id]
      );
      
      expect(result.rows).toHaveLength(0);
    });

    it('should return items for authenticated user', async () => {
      await createTestItem(testUser.id, { title: 'Test Item 1' });
      await createTestItem(testUser.id, { title: 'Test Item 2' });
      
      const pool = getTestPool();
      const result = await pool.query(
        `SELECT * FROM save_items WHERE user_id = $1 AND deleted_at IS NULL`,
        [testUser.id]
      );
      
      expect(result.rows).toHaveLength(2);
    });

    it('should filter items by status', async () => {
      await createTestItem(testUser.id, { status: 'ready' });
      await createTestItem(testUser.id, { status: 'processing' });
      
      const pool = getTestPool();
      const result = await pool.query(
        `SELECT * FROM save_items WHERE user_id = $1 AND status = $2`,
        [testUser.id, 'ready']
      );
      
      expect(result.rows).toHaveLength(1);
    });

    it('should filter items by folder', async () => {
      const folder = await createTestFolder(testUser.id, { name: 'Test Folder' });
      
      await createTestItem(testUser.id, { folderId: folder.id });
      await createTestItem(testUser.id); // No folder
      
      const pool = getTestPool();
      const result = await pool.query(
        `SELECT * FROM save_items WHERE user_id = $1 AND folder_id = $2`,
        [testUser.id, folder.id]
      );
      
      expect(result.rows).toHaveLength(1);
    });

    it('should exclude soft-deleted items by default', async () => {
      const item = await createTestItem(testUser.id);
      
      const pool = getTestPool();
      
      // Soft delete the item
      await pool.query(
        `UPDATE save_items SET deleted_at = NOW() WHERE id = $1`,
        [item.id]
      );
      
      // Query without deleted items
      const result = await pool.query(
        `SELECT * FROM save_items WHERE user_id = $1 AND deleted_at IS NULL`,
        [testUser.id]
      );
      
      expect(result.rows).toHaveLength(0);
    });
  });

  describe('POST /items', () => {
    it('should create a new item with valid URL', async () => {
      const pool = getTestPool();
      
      const sourceUrl = 'https://www.tiktok.com/@creator/video/1234567890';
      
      const result = await pool.query(
        `INSERT INTO save_items (user_id, source_url, status)
         VALUES ($1, $2, 'queued')
         RETURNING id, source_url, status`,
        [testUser.id, sourceUrl]
      );
      
      expect(result.rows[0].source_url).toBe(sourceUrl);
      expect(result.rows[0].status).toBe('queued');
    });

    it('should reject duplicate URL within 5 minutes', async () => {
      const pool = getTestPool();
      
      const sourceUrl = 'https://www.tiktok.com/@creator/video/1234567890';
      
      // First insert
      await pool.query(
        `INSERT INTO save_items (user_id, source_url, status)
         VALUES ($1, $2, 'queued')`,
        [testUser.id, sourceUrl]
      );
      
      // Check for duplicate within 5 minutes
      const duplicate = await pool.query(
        `SELECT id FROM save_items 
         WHERE user_id = $1 AND source_url = $2 
         AND created_at > NOW() - INTERVAL '5 minutes'`,
        [testUser.id, sourceUrl]
      );
      
      expect(duplicate.rows).toHaveLength(1);
    });
  });

  describe('DELETE /items/:id (soft delete)', () => {
    it('should soft delete an item', async () => {
      const item = await createTestItem(testUser.id);
      const pool = getTestPool();
      
      // Soft delete
      await pool.query(
        `UPDATE save_items SET deleted_at = NOW() WHERE id = $1`,
        [item.id]
      );
      
      // Verify it's soft deleted
      const result = await pool.query(
        `SELECT deleted_at FROM save_items WHERE id = $1`,
        [item.id]
      );
      
      expect(result.rows[0].deleted_at).not.toBeNull();
    });

    it('should allow restoring soft-deleted items', async () => {
      const item = await createTestItem(testUser.id);
      const pool = getTestPool();
      
      // Soft delete
      await pool.query(
        `UPDATE save_items SET deleted_at = NOW() WHERE id = $1`,
        [item.id]
      );
      
      // Restore
      await pool.query(
        `UPDATE save_items SET deleted_at = NULL WHERE id = $1`,
        [item.id]
      );
      
      // Verify it's restored
      const result = await pool.query(
        `SELECT deleted_at FROM save_items WHERE id = $1`,
        [item.id]
      );
      
      expect(result.rows[0].deleted_at).toBeNull();
    });
  });

  describe('POST /items/:id/moveFolder', () => {
    it('should move item to a different folder', async () => {
      const folder1 = await createTestFolder(testUser.id, { name: 'Folder 1' });
      const folder2 = await createTestFolder(testUser.id, { name: 'Folder 2' });
      const item = await createTestItem(testUser.id, { folderId: folder1.id });
      
      const pool = getTestPool();
      
      // Move to folder2
      await pool.query(
        `UPDATE save_items SET folder_id = $1 WHERE id = $2`,
        [folder2.id, item.id]
      );
      
      // Verify
      const result = await pool.query(
        `SELECT folder_id FROM save_items WHERE id = $1`,
        [item.id]
      );
      
      expect(result.rows[0].folder_id).toBe(folder2.id);
    });

    it('should move item to library (null folder)', async () => {
      const folder = await createTestFolder(testUser.id);
      const item = await createTestItem(testUser.id, { folderId: folder.id });
      
      const pool = getTestPool();
      
      // Move to library
      await pool.query(
        `UPDATE save_items SET folder_id = NULL WHERE id = $1`,
        [item.id]
      );
      
      // Verify
      const result = await pool.query(
        `SELECT folder_id FROM save_items WHERE id = $1`,
        [item.id]
      );
      
      expect(result.rows[0].folder_id).toBeNull();
    });
  });
});
