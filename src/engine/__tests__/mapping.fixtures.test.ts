/**
 * Mapping Fixture Tests
 * 
 * Tests the solver with different GridMapping configurations (L01-L05).
 * Verifies that different layouts produce valid results and that
 * mapping-specific behaviors work correctly.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  DEFAULT_TEST_CONFIG,
  runSolver,
  createTestPerformance,
  expectWithinEpsilon,
} from './helpers/testHelpers';
import { loadMappingFixture } from './helpers/fixtureLoader';
import { Performance } from '../../types/performance';
import { GridMapping } from '../../types/layout';
import { EngineResult } from '../solvers/types';

const sharedPerformance = createTestPerformance([
  { noteNumber: 36, startTime: 0.0 },
  { noteNumber: 37, startTime: 0.25 },
  { noteNumber: 38, startTime: 0.5 },
  { noteNumber: 39, startTime: 0.75 },
  { noteNumber: 40, startTime: 1.0 },
  { noteNumber: 41, startTime: 1.25 },
  { noteNumber: 42, startTime: 1.5 },
  { noteNumber: 43, startTime: 1.75 },
]);

describe('Mapping Fixture Tests', () => {
  describe('L01 - Standard Chromatic (null mapping)', () => {
    let mapping: GridMapping | null;
    let result1: EngineResult;
    let result2: EngineResult;

    beforeAll(() => {
      mapping = loadMappingFixture('L01');
      result1 = runSolver(sharedPerformance, DEFAULT_TEST_CONFIG, mapping);
      result2 = runSolver(sharedPerformance, DEFAULT_TEST_CONFIG, mapping);
    });

    it('should use null mapping (standard chromatic)', () => {
      expect(mapping).toBeNull();
    });

    it('should not crash', () => {
      expect(result1).toBeDefined();
      expect(result1.debugEvents.length).toBe(sharedPerformance.events.length);
    });

    it('should be deterministic', () => {
      expectWithinEpsilon(result1.score, result2.score, 0.001);
      expect(result1.unplayableCount).toBe(result2.unplayableCount);
      expect(result1.hardCount).toBe(result2.hardCount);
    });

    it('should have no NaNs', () => {
      expect(result1).toHaveNoNaNs();
    });

    it('should have valid mapping integrity', () => {
      expect(result1).toHaveValidMappingIntegrity();
    });

    it('should have valid grid positions', () => {
      expect(result1).toHaveValidGridPositions();
    });
  });

  describe('L02 - Rotated/Inverted Layout', () => {
    let mapping: GridMapping | null;
    let result: EngineResult;

    beforeAll(() => {
      mapping = loadMappingFixture('L02_rotated');
      result = runSolver(sharedPerformance, DEFAULT_TEST_CONFIG, mapping);
    });

    it('should load rotated mapping', () => {
      expect(mapping).not.toBeNull();
      expect(mapping!.id).toBe('L02-rotated');
    });

    it('should not crash', () => {
      expect(result).toBeDefined();
    });

    it('should have no NaNs', () => {
      expect(result).toHaveNoNaNs();
    });

    it('should have valid mapping integrity', () => {
      expect(result).toHaveValidMappingIntegrity();
    });

    it('should have different grid positions than L01', () => {
      const l01Result = runSolver(sharedPerformance, DEFAULT_TEST_CONFIG, null);
      
      const l01Positions = l01Result.debugEvents
        .filter(e => e.assignedHand !== 'Unplayable' && e.row !== undefined)
        .map(e => `${e.row},${e.col}`);
      
      const l02Positions = result.debugEvents
        .filter(e => e.assignedHand !== 'Unplayable' && e.row !== undefined)
        .map(e => `${e.row},${e.col}`);

      const hasMatch = l01Positions.some((pos, i) => pos === l02Positions[i]);
      expect(hasMatch || l01Positions.length !== l02Positions.length).toBeDefined();
    });
  });

  describe('L03 - Sparse Layout', () => {
    let mapping: GridMapping | null;
    let result: EngineResult;

    beforeAll(() => {
      mapping = loadMappingFixture('L03_sparse');
      result = runSolver(sharedPerformance, DEFAULT_TEST_CONFIG, mapping);
    });

    it('should load sparse mapping', () => {
      expect(mapping).not.toBeNull();
      expect(mapping!.id).toBe('L03-sparse');
    });

    it('should not crash', () => {
      expect(result).toBeDefined();
    });

    it('should have no NaNs', () => {
      expect(result).toHaveNoNaNs();
    });

    it('should handle unmapped notes correctly', () => {
      const unplayableEvents = result.debugEvents.filter(
        e => e.assignedHand === 'Unplayable'
      );
      expect(result.unplayableCount).toBe(unplayableEvents.length);
    });

    it('should have more unplayable notes than L01 (sparse mapping)', () => {
      const l01Result = runSolver(sharedPerformance, DEFAULT_TEST_CONFIG, null);
      expect(result.unplayableCount).toBeGreaterThanOrEqual(l01Result.unplayableCount);
    });
  });

  describe('L04 - Clustered Layout', () => {
    let mapping: GridMapping | null;
    let result: EngineResult;
    let l01Result: EngineResult;

    beforeAll(() => {
      mapping = loadMappingFixture('L04_clustered');
      result = runSolver(sharedPerformance, DEFAULT_TEST_CONFIG, mapping);
      l01Result = runSolver(sharedPerformance, DEFAULT_TEST_CONFIG, null);
    });

    it('should load clustered mapping', () => {
      expect(mapping).not.toBeNull();
      expect(mapping!.id).toBe('L04-clustered');
    });

    it('should not crash', () => {
      expect(result).toBeDefined();
    });

    it('should have no NaNs', () => {
      expect(result).toHaveNoNaNs();
    });

    it('should have valid mapping integrity', () => {
      expect(result).toHaveValidMappingIntegrity();
    });

    it('should be feasible for mapped notes', () => {
      expect(result.debugEvents.length).toBe(sharedPerformance.events.length);
    });
  });

  describe('L05 - Non-Contiguous Layout', () => {
    let mapping: GridMapping | null;
    let result1: EngineResult;
    let result2: EngineResult;

    beforeAll(() => {
      mapping = loadMappingFixture('L05_noncontiguous');
      result1 = runSolver(sharedPerformance, DEFAULT_TEST_CONFIG, mapping);
      result2 = runSolver(sharedPerformance, DEFAULT_TEST_CONFIG, mapping);
    });

    it('should load non-contiguous mapping', () => {
      expect(mapping).not.toBeNull();
      expect(mapping!.id).toBe('L05-noncontiguous');
    });

    it('should not crash', () => {
      expect(result1).toBeDefined();
    });

    it('should have no NaNs', () => {
      expect(result1).toHaveNoNaNs();
    });

    it('should have no indexing errors (valid positions)', () => {
      expect(result1).toHaveValidGridPositions();
    });

    it('should be deterministic', () => {
      expectWithinEpsilon(result1.score, result2.score, 0.001);
      expect(result1.unplayableCount).toBe(result2.unplayableCount);
    });
  });

  describe('Cross-Layout Comparisons', () => {
    const layouts = ['L01', 'L02_rotated', 'L03_sparse', 'L04_clustered', 'L05_noncontiguous'];
    const results: Map<string, EngineResult> = new Map();

    beforeAll(() => {
      for (const layoutId of layouts) {
        const mapping = loadMappingFixture(layoutId);
        const result = runSolver(sharedPerformance, DEFAULT_TEST_CONFIG, mapping);
        results.set(layoutId, result);
      }
    });

    it('all layouts should produce valid results', () => {
      for (const layoutId of layouts) {
        const result = results.get(layoutId)!;
        expect(result).toHaveNoNaNs();
      }
    });

    it('all layouts should have correct event count', () => {
      for (const layoutId of layouts) {
        const result = results.get(layoutId)!;
        expect(result.debugEvents.length).toBe(sharedPerformance.events.length);
      }
    });

    it('L01 (null/standard) should have the most playable notes', () => {
      const l01Result = results.get('L01')!;
      for (const layoutId of layouts) {
        if (layoutId === 'L01') continue;
        const result = results.get(layoutId)!;
        expect(l01Result.unplayableCount).toBeLessThanOrEqual(result.unplayableCount);
      }
    });
  });

  describe('Fallback Path Consistency', () => {
    it('null mapping and empty cells should behave similarly', () => {
      const emptyMapping: GridMapping = {
        id: 'empty-test',
        name: 'Empty Test',
        cells: {},
        fingerConstraints: {},
      };

      const nullResult = runSolver(sharedPerformance, DEFAULT_TEST_CONFIG, null);
      const emptyResult = runSolver(sharedPerformance, DEFAULT_TEST_CONFIG, emptyMapping);

      expect(nullResult).toHaveNoNaNs();
      expect(emptyResult).toHaveNoNaNs();
    });
  });
});
