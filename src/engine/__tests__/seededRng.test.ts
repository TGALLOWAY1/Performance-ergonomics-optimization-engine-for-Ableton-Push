/**
 * Seeded RNG Tests
 */

import { describe, it, expect } from 'vitest';
import { createSeededRng } from '../seededRng';

describe('seededRng', () => {
  it('should produce same sequence for same seed', () => {
    const rng1 = createSeededRng(42);
    const rng2 = createSeededRng(42);
    for (let i = 0; i < 10; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('should produce different sequences for different seeds', () => {
    const rng1 = createSeededRng(42);
    const rng2 = createSeededRng(43);
    const vals1 = Array.from({ length: 5 }, () => rng1());
    const vals2 = Array.from({ length: 5 }, () => rng2());
    expect(vals1).not.toEqual(vals2);
  });

  it('should produce values in [0, 1)', () => {
    const rng = createSeededRng(123);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
