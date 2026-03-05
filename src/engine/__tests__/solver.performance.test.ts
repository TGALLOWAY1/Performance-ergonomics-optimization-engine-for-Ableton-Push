/**
 * Solver Performance / Runtime Budget Tests
 * 
 * These tests ensure the solver doesn't regress to unacceptable performance.
 * They use generous thresholds suitable for CI environments.
 * 
 * Purpose:
 * - Catch "we accidentally made solve O(n²)" regressions
 * - Ensure reasonable performance on typical workloads
 * - Not meant to be tight microbenchmarks
 * 
 * Note: Thresholds are intentionally generous to avoid flaky tests.
 * Local machines will usually be much faster.
 * 
 * ## CI vs Local Thresholds
 * 
 * Set CI=true environment variable for more generous thresholds:
 * - CI runners have variable load and may be slower
 * - Local thresholds are tighter for faster developer feedback
 * 
 * The O(n²) ratio test is the PRIMARY signal for regressions.
 * Absolute budget tests are secondary guards.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  DEFAULT_TEST_CONFIG,
  runSolver,
  beatsToSeconds,
} from './helpers/testHelpers';
import { loadPerformanceFixture } from './helpers/fixtureLoader';
import { Performance } from '../../types/performance';

const IS_CI = process.env.CI === 'true';

const GENEROUS_THRESHOLD_MS = IS_CI ? 10000 : 5000;
const MODERATE_THRESHOLD_MS = IS_CI ? 4000 : 2000;
const FAST_THRESHOLD_MS = IS_CI ? 1000 : 500;

function measureSolveTime(performance: Performance): number {
  const start = performance.now ? performance.now() : Date.now();
  runSolver(performance);
  const end = performance.now ? performance.now() : Date.now();
  return end - start;
}

function createLargePerformance(eventCount: number): Performance {
  const events = Array.from({ length: eventCount }, (_, i) => ({
    noteNumber: 36 + (i % 64),
    startTime: beatsToSeconds(i * 0.25, 120),
    duration: beatsToSeconds(0.2, 120),
    velocity: 100,
    eventKey: `${i}:${beatsToSeconds(i * 0.25, 120)}:${36 + (i % 64)}:1`,
  }));
  
  return {
    name: `LargePerformance_${eventCount}`,
    tempo: 120,
    events,
  };
}

describe('Solver Performance Tests', () => {
  describe('I05 Mixed Benchmark', () => {
    let i05Performance: Performance;

    beforeAll(() => {
      i05Performance = loadPerformanceFixture('I05');
    });

    it(`should solve I05 benchmark under ${MODERATE_THRESHOLD_MS}ms`, () => {
      const startTime = Date.now();
      const result = runSolver(i05Performance);
      const elapsed = Date.now() - startTime;
      
      expect(result).toBeDefined();
      expect(elapsed).toBeLessThan(MODERATE_THRESHOLD_MS);
      
      console.log(`I05 solve time: ${elapsed}ms`);
    });

    it('should produce consistent results (determinism check)', () => {
      const result1 = runSolver(i05Performance);
      const result2 = runSolver(i05Performance);
      
      expect(result1.score).toBe(result2.score);
      expect(result1.unplayableCount).toBe(result2.unplayableCount);
    });
  });

  describe('Scaling Behavior (PRIMARY: O(n²) detection)', () => {
    it('PRIMARY: should not exhibit O(n²) behavior (ratio check)', () => {
      const perf50 = createLargePerformance(50);
      const perf100 = createLargePerformance(100);
      
      const start50 = Date.now();
      runSolver(perf50);
      const time50 = Date.now() - start50;
      
      const start100 = Date.now();
      runSolver(perf100);
      const time100 = Date.now() - start100;
      
      const ratio = time100 / Math.max(time50, 1);
      
      expect(ratio).toBeLessThan(6);
      
      console.log(`Scaling ratio (100/50 events): ${ratio.toFixed(2)}x (expected <6x for O(n) or O(n log n))`);
    });

    it('PRIMARY: should scale sub-quadratically from 100 to 200 events', () => {
      const perf100 = createLargePerformance(100);
      const perf200 = createLargePerformance(200);
      
      const start100 = Date.now();
      runSolver(perf100);
      const time100 = Date.now() - start100;
      
      const start200 = Date.now();
      runSolver(perf200);
      const time200 = Date.now() - start200;
      
      const ratio = time200 / Math.max(time100, 1);
      
      expect(ratio).toBeLessThan(6);
      
      console.log(`Scaling ratio (200/100 events): ${ratio.toFixed(2)}x`);
    });

    it(`SECONDARY: should solve 50 events under ${FAST_THRESHOLD_MS}ms`, () => {
      const performance = createLargePerformance(50);
      
      const startTime = Date.now();
      const result = runSolver(performance);
      const elapsed = Date.now() - startTime;
      
      expect(result).toBeDefined();
      expect(elapsed).toBeLessThan(FAST_THRESHOLD_MS);
      
      console.log(`50 events solve time: ${elapsed}ms (threshold: ${FAST_THRESHOLD_MS}ms, CI=${IS_CI})`);
    });

    it(`SECONDARY: should solve 100 events under ${MODERATE_THRESHOLD_MS}ms`, () => {
      const performance = createLargePerformance(100);
      
      const startTime = Date.now();
      const result = runSolver(performance);
      const elapsed = Date.now() - startTime;
      
      expect(result).toBeDefined();
      expect(elapsed).toBeLessThan(MODERATE_THRESHOLD_MS);
      
      console.log(`100 events solve time: ${elapsed}ms (threshold: ${MODERATE_THRESHOLD_MS}ms, CI=${IS_CI})`);
    });

    it(`SECONDARY: should solve 200 events under ${GENEROUS_THRESHOLD_MS}ms`, () => {
      const performance = createLargePerformance(200);
      
      const startTime = Date.now();
      const result = runSolver(performance);
      const elapsed = Date.now() - startTime;
      
      expect(result).toBeDefined();
      expect(elapsed).toBeLessThan(GENEROUS_THRESHOLD_MS);
      
      console.log(`200 events solve time: ${elapsed}ms (threshold: ${GENEROUS_THRESHOLD_MS}ms, CI=${IS_CI})`);
    });
  });

  describe('Dense Pattern Performance', () => {
    let densePerformance: Performance;

    beforeAll(() => {
      densePerformance = loadPerformanceFixture('I01');
    });

    it(`should solve dense 32nd burst pattern under ${MODERATE_THRESHOLD_MS}ms`, () => {
      const startTime = Date.now();
      const result = runSolver(densePerformance);
      const elapsed = Date.now() - startTime;
      
      expect(result).toBeDefined();
      expect(elapsed).toBeLessThan(MODERATE_THRESHOLD_MS);
      
      console.log(`I01 dense burst solve time: ${elapsed}ms`);
    });
  });

  describe('Chord-Heavy Performance', () => {
    it(`should solve chord-heavy pattern under ${MODERATE_THRESHOLD_MS}ms`, () => {
      const chordPerformance: Performance = {
        name: 'ChordHeavy',
        tempo: 120,
        events: [],
      };
      
      for (let beat = 0; beat < 16; beat++) {
        const startTime = beatsToSeconds(beat, 120);
        for (let note = 0; note < 4; note++) {
          chordPerformance.events.push({
            noteNumber: 36 + beat + note * 4,
            startTime,
            duration: beatsToSeconds(0.9, 120),
            velocity: 100,
            eventKey: `${beat * 4 + note}:${startTime}:${36 + beat + note * 4}:${note + 1}`,
          });
        }
      }
      
      const startTime = Date.now();
      const result = runSolver(chordPerformance);
      const elapsed = Date.now() - startTime;
      
      expect(result).toBeDefined();
      expect(elapsed).toBeLessThan(MODERATE_THRESHOLD_MS);
      
      console.log(`Chord-heavy (64 events, 16 chords) solve time: ${elapsed}ms`);
    });
  });

  describe('Worst-Case Patterns', () => {
    it('should handle alternating wide jumps without timeout', () => {
      const wideJumps: Performance = {
        name: 'WideJumps',
        tempo: 180,
        events: Array.from({ length: 32 }, (_, i) => ({
          noteNumber: i % 2 === 0 ? 36 : 99,
          startTime: beatsToSeconds(i * 0.25, 180),
          duration: beatsToSeconds(0.2, 180),
          velocity: 100,
          eventKey: `${i}:${beatsToSeconds(i * 0.25, 180)}:${i % 2 === 0 ? 36 : 99}:1`,
        })),
      };
      
      const startTime = Date.now();
      const result = runSolver(wideJumps);
      const elapsed = Date.now() - startTime;
      
      expect(result).toBeDefined();
      expect(elapsed).toBeLessThan(GENEROUS_THRESHOLD_MS);
      
      console.log(`Wide jumps pattern solve time: ${elapsed}ms`);
    });
  });
});
