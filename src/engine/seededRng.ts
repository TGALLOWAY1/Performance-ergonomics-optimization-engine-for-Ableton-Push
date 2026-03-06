/**
 * Seeded RNG for deterministic optimization.
 * Mulberry32 - fast, simple, reproducible.
 */

/**
 * Creates a seeded random number generator.
 * Returns a function that yields values in [0, 1).
 *
 * @param seed - Integer seed (same seed => same sequence)
 */
export function createSeededRng(seed: number): () => number {
  return function mulberry32(): number {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
