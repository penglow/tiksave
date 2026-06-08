/**
 * JWT authenticate middleware — unique HTTP auth edge cases.
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import jwt from 'jsonwebtoken';
import { authenticate } from '../../middleware/auth.js';
import { mockRequest, mockResponse } from '../setup.js';

process.env.JWT_SECRET = 'middleware-test-secret-key';

describe('authenticate middleware scenarios', () => {
  let validToken: string;

  beforeAll(() => {
    validToken = jwt.sign({ userId: 'user-abc-123' }, process.env.JWT_SECRET!, { expiresIn: '1h' });
  });

  it('rejects missing Authorization header', () => {
    const req = mockRequest();
    const res = mockResponse();
    let nextCalled = false;
    authenticate(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.data.error).toBe('Authentication required');
  });

  it('rejects Basic auth scheme', () => {
    const req = mockRequest({ headers: { authorization: 'Basic dXNlcjpwYXNz' } });
    const res = mockResponse();
    authenticate(req, res, () => {});
    expect(res.statusCode).toBe(401);
  });

  it('attaches userId and calls next() for valid Bearer token', () => {
    const req = mockRequest({ headers: { authorization: `Bearer ${validToken}` } });
    const res = mockResponse();
    let nextCalled = false;
    authenticate(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
    expect(req.userId).toBe('user-abc-123');
  });

  it('returns token expired message for expired JWT', () => {
    const expired = jwt.sign({ userId: 'u1' }, process.env.JWT_SECRET!, { expiresIn: '-1s' });
    const req = mockRequest({ headers: { authorization: `Bearer ${expired}` } });
    const res = mockResponse();
    authenticate(req, res, () => {});
    expect(res.statusCode).toBe(401);
    expect(res.data.error).toContain('expired');
  });

  it('rejects token signed with wrong secret', () => {
    const bad = jwt.sign({ userId: 'u1' }, 'wrong-secret', { expiresIn: '1h' });
    const req = mockRequest({ headers: { authorization: `Bearer ${bad}` } });
    const res = mockResponse();
    authenticate(req, res, () => {});
    expect(res.statusCode).toBe(401);
  });

  it('rejects payload missing userId claim', () => {
    const noUser = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET!, { expiresIn: '1h' });
    const req = mockRequest({ headers: { authorization: `Bearer ${noUser}` } });
    const res = mockResponse();
    authenticate(req, res, () => {});
    expect(res.statusCode).toBe(401);
  });
});
