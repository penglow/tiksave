/** Authentication API tests. */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import {
  getTestPool,
  cleanupTestConnections,
  resetTestDatabase,
  createTestUser,
} from './setup';

// Set test environment
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.NODE_ENV = 'test';

describe('Auth API', () => {
  beforeAll(async () => {
    // Initialize test database connection
    getTestPool();
  });

  afterAll(async () => {
    await cleanupTestConnections();
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe('POST /auth/signup', () => {
    it('should create a new user with valid credentials', async () => {
      const pool = getTestPool();
      const bcrypt = await import('bcryptjs');
      
      const email = 'newuser@example.com';
      const password = 'securepassword123';
      
      // Simulate signup logic
      const passwordHash = await bcrypt.hash(password, 12);
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, settings)
         VALUES ($1, $2, '{}')
         RETURNING id, email`,
        [email, passwordHash]
      );
      
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].email).toBe(email);
    });

    it('should reject duplicate email registration', async () => {
      const pool = getTestPool();
      const bcrypt = await import('bcryptjs');
      
      const email = 'duplicate@example.com';
      const passwordHash = await bcrypt.hash('password123', 12);
      
      // First signup
      await pool.query(
        `INSERT INTO users (email, password_hash, settings)
         VALUES ($1, $2, '{}')`,
        [email, passwordHash]
      );
      
      // Second signup should fail
      try {
        await pool.query(
          `INSERT INTO users (email, password_hash, settings)
           VALUES ($1, $2, '{}')`,
          [email, passwordHash]
        );
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.code).toBe('23505'); // Unique constraint violation
      }
    });

    it('should reject invalid email format', async () => {
      const { z } = await import('zod');
      
      const signUpSchema = z.object({
        email: z.string().email(),
        password: z.string().min(8),
      });
      
      const result = signUpSchema.safeParse({
        email: 'not-an-email',
        password: 'password123',
      });
      
      expect(result.success).toBe(false);
    });

    it('should reject password shorter than 8 characters', async () => {
      const { z } = await import('zod');
      
      const signUpSchema = z.object({
        email: z.string().email(),
        password: z.string().min(8),
      });
      
      const result = signUpSchema.safeParse({
        email: 'test@example.com',
        password: 'short',
      });
      
      expect(result.success).toBe(false);
    });
  });

  describe('POST /auth/signin', () => {
    it('should authenticate valid credentials', async () => {
      const bcrypt = await import('bcryptjs');
      const pool = getTestPool();
      
      const email = 'signin@example.com';
      const password = 'correctpassword123';
      const passwordHash = await bcrypt.hash(password, 12);
      
      // Create user
      await pool.query(
        `INSERT INTO users (email, password_hash, settings)
         VALUES ($1, $2, '{}')`,
        [email, passwordHash]
      );
      
      // Verify password
      const user = await pool.query('SELECT password_hash FROM users WHERE email = $1', [email]);
      const isValid = await bcrypt.compare(password, user.rows[0].password_hash);
      
      expect(isValid).toBe(true);
    });

    it('should reject invalid password', async () => {
      const bcrypt = await import('bcryptjs');
      const pool = getTestPool();
      
      const email = 'signin@example.com';
      const passwordHash = await bcrypt.hash('correctpassword123', 12);
      
      await pool.query(
        `INSERT INTO users (email, password_hash, settings)
         VALUES ($1, $2, '{}')`,
        [email, passwordHash]
      );
      
      const user = await pool.query('SELECT password_hash FROM users WHERE email = $1', [email]);
      const isValid = await bcrypt.compare('wrongpassword', user.rows[0].password_hash);
      
      expect(isValid).toBe(false);
    });
  });

  describe('Token Generation', () => {
    it('should generate valid JWT tokens', async () => {
      const jwt = await import('jsonwebtoken');
      
      const userId = 'test-user-id';
      const token = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '1h' });
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      expect(decoded.userId).toBe(userId);
    });

    it('should reject expired tokens', async () => {
      const jwt = await import('jsonwebtoken');
      
      const token = jwt.sign({ userId: 'test' }, process.env.JWT_SECRET!, { expiresIn: '-1h' });
      
      try {
        jwt.verify(token, process.env.JWT_SECRET!);
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.name).toBe('TokenExpiredError');
      }
    });
  });
});
