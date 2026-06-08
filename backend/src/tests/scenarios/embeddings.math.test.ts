/**
 * Unique vector math cases for embedding similarity.
 */

import { describe, it, expect } from 'bun:test';
import { cosineSimilarity } from '../../services/embeddings';

describe('cosineSimilarity scenarios', () => {
  it('identical unit vectors score 1', () => {
    const v = [1, 0, 0];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it('orthogonal vectors score 0', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  it('opposite vectors score -1', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
  });

  it('throws on dimension mismatch', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(
      'Embeddings must have the same dimension'
    );
  });

  it('handles high-dimensional sparse-like vectors', () => {
    const a = Array.from({ length: 1536 }, (_, i) => (i % 7 === 0 ? 1 : 0));
    const b = Array.from({ length: 1536 }, (_, i) => (i % 11 === 0 ? 1 : 0));
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });

  it('zero vector yields NaN (documented edge)', () => {
    expect(Number.isNaN(cosineSimilarity([0, 0], [1, 0]))).toBe(true);
  });

  it('near-duplicate restaurant embeddings stay > 0.99', () => {
    const a = [0.12, 0.45, 0.88, 0.33];
    const b = [0.121, 0.449, 0.879, 0.331];
    expect(cosineSimilarity(a, b)).toBeGreaterThan(0.99);
  });
});
