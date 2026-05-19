/** Search API tests. */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import {
  dbAvailable,
  getTestPool,
  cleanupTestConnections,
  resetTestDatabase,
  createTestUser,
  createTestItem,
} from './setup';

// Set test environment
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.NODE_ENV = 'test';

describe.skipIf(!dbAvailable)('Search API', () => {
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

  describe('Keyword Search', () => {
    it('should find items by title', async () => {
      await createTestItem(testUser.id, { title: 'Amazing Tokyo Food Tour' });
      await createTestItem(testUser.id, { title: 'Paris Travel Vlog' });
      
      const pool = getTestPool();
      const result = await pool.query(
        `SELECT * FROM save_items 
         WHERE user_id = $1 
         AND title ILIKE $2`,
        [testUser.id, '%Tokyo%']
      );
      
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].title).toContain('Tokyo');
    });

    it('should return empty array for no matches', async () => {
      await createTestItem(testUser.id, { title: 'Unrelated Video' });
      
      const pool = getTestPool();
      const result = await pool.query(
        `SELECT * FROM save_items 
         WHERE user_id = $1 
         AND title ILIKE $2`,
        [testUser.id, '%NonExistent%']
      );
      
      expect(result.rows).toHaveLength(0);
    });

    it('should search across multiple fields', async () => {
      const pool = getTestPool();
      
      await pool.query(
        `INSERT INTO save_items (user_id, source_url, title, raw_shared_text, detected_topics, status)
         VALUES ($1, 'https://example.com/1', 'Video Title', 'ramen noodles delicious', ARRAY['Food'], 'ready')`,
        [testUser.id]
      );
      
      // Search for 'ramen' in raw_shared_text
      const result = await pool.query(
        `SELECT * FROM save_items 
         WHERE user_id = $1 
         AND (title ILIKE $2 OR raw_shared_text ILIKE $2)`,
        [testUser.id, '%ramen%']
      );
      
      expect(result.rows).toHaveLength(1);
    });
  });

  describe('Full-Text Search', () => {
    it('should use PostgreSQL full-text search', async () => {
      const pool = getTestPool();
      
      await pool.query(
        `INSERT INTO save_items (user_id, source_url, title, transcript_text, status)
         VALUES ($1, 'https://example.com/1', 'Japanese Street Food', 'Walking through Tokyo trying delicious ramen', 'ready')`,
        [testUser.id]
      );
      
      await pool.query(
        `INSERT INTO save_items (user_id, source_url, title, transcript_text, status)
         VALUES ($1, 'https://example.com/2', 'Korean BBQ', 'Best Korean barbecue in Seoul', 'ready')`,
        [testUser.id]
      );
      
      // Search using full-text
      const result = await pool.query(
        `SELECT * FROM save_items 
         WHERE user_id = $1 
         AND status = 'ready'
         AND to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(transcript_text, ''))
             @@ plainto_tsquery('english', $2)`,
        [testUser.id, 'ramen']
      );
      
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].title).toBe('Japanese Street Food');
    });
  });

  describe('Search Result Ordering', () => {
    it('should order by relevance', async () => {
      const pool = getTestPool();
      
      // Item with "food" in title (more relevant)
      await pool.query(
        `INSERT INTO save_items (user_id, source_url, title, status)
         VALUES ($1, 'https://example.com/1', 'Food Tour in Tokyo', 'ready')`,
        [testUser.id]
      );
      
      // Item with "food" in transcript only
      await pool.query(
        `INSERT INTO save_items (user_id, source_url, title, transcript_text, status)
         VALUES ($1, 'https://example.com/2', 'Travel Vlog', 'We tried some food', 'ready')`,
        [testUser.id]
      );
      
      const result = await pool.query(
        `SELECT *, 
           ts_rank(to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(transcript_text, '')),
                   plainto_tsquery('english', 'food')) as rank
         FROM save_items 
         WHERE user_id = $1 
         AND status = 'ready'
         ORDER BY rank DESC`,
        [testUser.id]
      );
      
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].title).toBe('Food Tour in Tokyo');
    });
  });

  describe('Search Filters', () => {
    it('should only search ready items', async () => {
      await createTestItem(testUser.id, { title: 'Test Video', status: 'processing' });
      await createTestItem(testUser.id, { title: 'Test Video', status: 'ready' });
      
      const pool = getTestPool();
      const result = await pool.query(
        `SELECT * FROM save_items 
         WHERE user_id = $1 
         AND status = 'ready'
         AND title ILIKE '%Test%'`,
        [testUser.id]
      );
      
      expect(result.rows).toHaveLength(1);
    });

    it('should not return soft-deleted items', async () => {
      const item = await createTestItem(testUser.id, { title: 'Searchable Video' });
      
      const pool = getTestPool();
      
      // Soft delete
      await pool.query(`UPDATE save_items SET deleted_at = NOW() WHERE id = $1`, [item.id]);
      
      // Search
      const result = await pool.query(
        `SELECT * FROM save_items 
         WHERE user_id = $1 
         AND deleted_at IS NULL
         AND title ILIKE '%Searchable%'`,
        [testUser.id]
      );
      
      expect(result.rows).toHaveLength(0);
    });
  });
});
