/**
 * Smoke tests for BiomechanicalSolver.
 * 
 * These tests validate hard invariants that should ALWAYS hold:
 * - Determinism (relaxed): same aggregate metrics within epsilon
 * - No NaNs in results
 * - Non-negative times
 * - Stable ordering
 * - Feasibility consistency
 * - Mapping integrity
 * - Valid grid positions
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TEST_CONFIG,
  runSolver,
  createTestPerformance,
  assertPerformanceUnits,
  assertNoNaNs,
  assertMappingIntegrity,
  assertValidGridPositions,
  assertDebugEventsMatchInput,
  expectWithinEpsilon,
  ensureEventKeys,
} from './helpers/testHelpers';
import { Performance } from '../../types/performance';

describe('Solver Smoke Tests', () => {
  describe('Determinism', () => {
    it('should produce same aggregate metrics on repeated runs', () => {
      const performance = createTestPerformance([
        { noteNumber: 36, startTime: 0.0 },
        { noteNumber: 37, startTime: 0.1 },
        { noteNumber: 38, startTime: 0.2 },
        { noteNumber: 39, startTime: 0.3 },
      ]);
      
      const result1 = runSolver(performance);
      const result2 = runSolver(performance);
      
      expect(result1.unplayableCount).toBe(result2.unplayableCount);
      expect(result1.hardCount).toBe(result2.hardCount);
      expectWithinEpsilon(result1.score, result2.score, 0.001);
      expectWithinEpsilon(
        result1.averageMetrics.total,
        result2.averageMetrics.total,
        0.001
      );
    });

    it('should produce same per-component costs within epsilon', () => {
      const performance = createTestPerformance([
        { noteNumber: 36, startTime: 0.0 },
        { noteNumber: 40, startTime: 0.25 },
        { noteNumber: 36, startTime: 0.5 },
        { noteNumber: 44, startTime: 0.75 },
      ]);
      
      const result1 = runSolver(performance);
      const result2 = runSolver(performance);
      
      const epsilon = 0.001;
      expectWithinEpsilon(result1.averageMetrics.movement, result2.averageMetrics.movement, epsilon);
      expectWithinEpsilon(result1.averageMetrics.stretch, result2.averageMetrics.stretch, epsilon);
      expectWithinEpsilon(result1.averageMetrics.drift, result2.averageMetrics.drift, epsilon);
      expectWithinEpsilon(result1.averageMetrics.bounce, result2.averageMetrics.bounce, epsilon);
      expectWithinEpsilon(result1.averageMetrics.fatigue, result2.averageMetrics.fatigue, epsilon);
      expectWithinEpsilon(result1.averageMetrics.crossover, result2.averageMetrics.crossover, epsilon);
    });
  });

  describe('No NaNs', () => {
    it('should not produce NaN values in results', () => {
      const performance = createTestPerformance([
        { noteNumber: 36, startTime: 0.0 },
        { noteNumber: 37, startTime: 0.1 },
        { noteNumber: 38, startTime: 0.2 },
      ]);
      
      const result = runSolver(performance);
      
      expect(result).toHaveNoNaNs();
    });

    it('should not produce NaN for edge case with single note', () => {
      const performance = createTestPerformance([
        { noteNumber: 48, startTime: 0.0 },
      ]);
      
      const result = runSolver(performance);
      
      expect(result).toHaveNoNaNs();
    });

    it('should not produce NaN for chord (simultaneous notes)', () => {
      const performance = createTestPerformance([
        { noteNumber: 36, startTime: 0.0 },
        { noteNumber: 38, startTime: 0.0 },
        { noteNumber: 40, startTime: 0.0 },
      ]);
      
      const result = runSolver(performance);
      
      expect(result).toHaveNoNaNs();
    });
  });

  describe('Non-negative time', () => {
    it('should have all debugEvent startTimes non-negative', () => {
      const performance = createTestPerformance([
        { noteNumber: 36, startTime: 0.0 },
        { noteNumber: 37, startTime: 0.5 },
        { noteNumber: 38, startTime: 1.0 },
      ]);
      
      const result = runSolver(performance);
      
      for (const event of result.debugEvents) {
        expect(event.startTime).toBeGreaterThanOrEqual(0);
      }
    });

    it('should validate performance units before solving', () => {
      const validPerformance = createTestPerformance([
        { noteNumber: 36, startTime: 0.0, duration: 0.5 },
        { noteNumber: 37, startTime: 0.5, duration: 0.5 },
      ]);
      
      expect(() => assertPerformanceUnits(validPerformance)).not.toThrow();
    });
  });

  describe('Feasibility consistency', () => {
    it('should mark clearly easy patterns as feasible', () => {
      const easyPerformance = createTestPerformance([
        { noteNumber: 36, startTime: 0.0 },
        { noteNumber: 36, startTime: 1.0 },
        { noteNumber: 36, startTime: 2.0 },
      ]);
      
      const result = runSolver(easyPerformance);
      
      expect(result).toBeFeasible();
    });

    it('should mark notes outside grid as unplayable', () => {
      const impossiblePerformance = createTestPerformance([
        { noteNumber: 200, startTime: 0.0 },
        { noteNumber: 201, startTime: 0.5 },
      ]);
      
      const result = runSolver(impossiblePerformance);
      
      expect(result).toBeInfeasible();
      expect(result.unplayableCount).toBe(2);
    });

    it('should handle large chord without crashing and maintain integrity', () => {
      const hugeChord = createTestPerformance(
        Array.from({ length: 12 }, (_, i) => ({
          noteNumber: 36 + i,
          startTime: 0.0,
        }))
      );
      
      const result = runSolver(hugeChord);
      
      expect(result).toHaveNoNaNs();
      expect(result).toHaveValidMappingIntegrity();
      expect(result.debugEvents.length).toBe(12);
    });
  });

  describe('Mapping integrity', () => {
    it('should have valid hand/finger assignment or be Unplayable', () => {
      const performance = createTestPerformance([
        { noteNumber: 36, startTime: 0.0 },
        { noteNumber: 40, startTime: 0.25 },
        { noteNumber: 44, startTime: 0.5 },
        { noteNumber: 48, startTime: 0.75 },
      ]);
      
      const result = runSolver(performance);
      
      expect(result).toHaveValidMappingIntegrity();
    });

    it('should have valid grid positions for playable events', () => {
      const performance = createTestPerformance([
        { noteNumber: 36, startTime: 0.0 },
        { noteNumber: 43, startTime: 0.25 },
        { noteNumber: 50, startTime: 0.5 },
      ]);
      
      const result = runSolver(performance);
      
      expect(result).toHaveValidGridPositions();
    });
  });

  describe('debugEvents vs input', () => {
    it('should have debug events for all input events with eventKeys', () => {
      const performance = ensureEventKeys(createTestPerformance([
        { noteNumber: 36, startTime: 0.0 },
        { noteNumber: 37, startTime: 0.1 },
        { noteNumber: 38, startTime: 0.2 },
      ]));
      
      const result = runSolver(performance);
      
      expect(result).toHaveDebugEventsForInput(performance);
    });

    it('should maintain non-decreasing event order', () => {
      const performance = ensureEventKeys(createTestPerformance([
        { noteNumber: 36, startTime: 0.0 },
        { noteNumber: 37, startTime: 0.5 },
        { noteNumber: 38, startTime: 1.0 },
        { noteNumber: 39, startTime: 1.5 },
      ]));
      
      const result = runSolver(performance);
      
      expect(result).toHaveDebugEventsForInput(performance);
    });
  });

  describe('Hand state sanity', () => {
    it('should keep grid positions within 0-7 range', () => {
      const performance = createTestPerformance([
        { noteNumber: 36, startTime: 0.0 },
        { noteNumber: 99, startTime: 0.5 },
      ]);
      
      const result = runSolver(performance);
      
      for (const event of result.debugEvents) {
        if (event.assignedHand !== 'Unplayable') {
          expect(event.row).toBeGreaterThanOrEqual(0);
          expect(event.row).toBeLessThanOrEqual(7);
          expect(event.col).toBeGreaterThanOrEqual(0);
          expect(event.col).toBeLessThanOrEqual(7);
        }
      }
    });
  });

  describe('Micro-offset handling', () => {
    it('should handle events with micro-offset times without NaN', () => {
      const performance = createTestPerformance([
        { noteNumber: 36, startTime: 0.001 },
        { noteNumber: 37, startTime: 0.502 },
        { noteNumber: 38, startTime: 1.003 },
      ]);
      
      const result = runSolver(performance);
      
      expect(result).toHaveNoNaNs();
      expect(result).toHaveValidMappingIntegrity();
    });

    it('should handle grace notes (near-simultaneous events)', () => {
      const performance = createTestPerformance([
        { noteNumber: 36, startTime: 0.0 },
        { noteNumber: 37, startTime: 0.01 },
      ]);
      
      const result = runSolver(performance);
      
      expect(result).toHaveNoNaNs();
      expect(result.debugEvents.length).toBe(2);
    });
  });
});
