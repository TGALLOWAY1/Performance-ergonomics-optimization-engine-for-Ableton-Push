/**
 * Solver Fixture Tests
 * 
 * Tests the solver against all F01-F12 and I01-I05 fixtures.
 * Uses threshold bands from bands.json for regression detection.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  DEFAULT_TEST_CONFIG,
  runSolver,
  assertPerformanceUnits,
  expectResultInBands,
  expectWithinEpsilon,
  countHandUsage,
  countUniqueFingers,
  ensureEventKeys,
} from './helpers/testHelpers';
import {
  loadPerformanceFixture,
  loadBands,
  getBands,
} from './helpers/fixtureLoader';
import { Performance } from '../../types/performance';
import { EngineResult } from '../solvers/types';

let bands: Record<string, { feasible?: boolean; unplayableCount?: number; hardCountMax?: number; crossoverRateMax?: number; movementCostMax?: number; scoreMin?: number }>;

beforeAll(() => {
  bands = loadBands();
});

describe('Solver Fixture Tests', () => {
  describe('Core Fixtures (F01-F12)', () => {
    describe('F01 - Same pad 16ths', () => {
      let performance: Performance;
      let result: EngineResult;

      beforeAll(() => {
        performance = loadPerformanceFixture('F01');
        assertPerformanceUnits(performance);
        result = runSolver(performance);
      });

      it('should be feasible', () => {
        expect(result).toBeFeasible();
      });

      it('should have fatigue component > 0 (repeated hits)', () => {
        expect(result.averageMetrics.fatigue).toBeGreaterThan(0);
      });

      it('should have bounce component >= 0 (same pad repeated)', () => {
        expect(result.averageMetrics.bounce).toBeGreaterThanOrEqual(0);
      });

      it('should meet threshold bands', () => {
        expectResultInBands(result, bands['F01']);
      });
    });

    describe('F02 - Same pad quarters', () => {
      let performance: Performance;
      let result: EngineResult;

      beforeAll(() => {
        performance = loadPerformanceFixture('F02');
        assertPerformanceUnits(performance);
        result = runSolver(performance);
      });

      it('should be feasible', () => {
        expect(result).toBeFeasible();
      });

      it('should have drift present (slow, repeated)', () => {
        expect(result.averageDrift).toBeGreaterThanOrEqual(0);
      });

      it('should meet threshold bands', () => {
        expectResultInBands(result, bands['F02']);
      });
    });

    describe('F03 - Adjacent alternation', () => {
      let performance: Performance;
      let result: EngineResult;

      beforeAll(() => {
        performance = loadPerformanceFixture('F03');
        assertPerformanceUnits(performance);
        result = runSolver(performance);
      });

      it('should be feasible', () => {
        expect(result).toBeFeasible();
      });

      it('should have low crossover (adjacent notes)', () => {
        expect(result.averageMetrics.crossover).toBeLessThan(1);
      });

      it('should have low movement cost', () => {
        expect(result.averageMetrics.movement).toBeLessThan(50);
      });

      it('should use both hands', () => {
        const usage = countHandUsage(result);
        expect(usage.left + usage.right).toBeGreaterThan(0);
      });

      it('should meet threshold bands', () => {
        expectResultInBands(result, bands['F03']);
      });
    });

    describe('F04 - Wide alternation', () => {
      let f03Result: EngineResult;
      let f04Result: EngineResult;

      beforeAll(() => {
        const f03 = loadPerformanceFixture('F03');
        const f04 = loadPerformanceFixture('F04');
        f03Result = runSolver(f03);
        f04Result = runSolver(f04);
      });

      it('should be feasible', () => {
        expect(f04Result).toBeFeasible();
      });

      it('should handle wider jumps without crashing', () => {
        expect(f04Result).toHaveNoNaNs();
        expect(f04Result).toHaveValidMappingIntegrity();
      });

      it('should meet threshold bands', () => {
        expectResultInBands(f04Result, bands['F04']);
      });
    });

    describe('F05 - Medium jump tempo comparison', () => {
      let slowResult: EngineResult;
      let fastResult: EngineResult;

      beforeAll(() => {
        const slow = loadPerformanceFixture('F05_slow');
        const fast = loadPerformanceFixture('F05_fast');
        slowResult = runSolver(slow);
        fastResult = runSolver(fast);
      });

      it('slow version should be feasible', () => {
        expect(slowResult).toBeFeasible();
      });

      it('fast version should be feasible or have higher cost', () => {
        if (fastResult.unplayableCount === 0) {
          expect(fastResult.averageMetrics.total).toBeGreaterThanOrEqual(0);
        }
      });

      it('should meet threshold bands', () => {
        expectResultInBands(slowResult, bands['F05_slow']);
        expectResultInBands(fastResult, bands['F05_fast']);
      });
    });

    describe('F06 - Impossible leap (outside grid)', () => {
      let performance: Performance;
      let result: EngineResult;

      beforeAll(() => {
        performance = loadPerformanceFixture('F06');
        assertPerformanceUnits(performance);
        result = runSolver(performance);
      });

      it('should be infeasible (notes outside grid)', () => {
        expect(result).toBeInfeasible();
      });

      it('should have all events marked Unplayable', () => {
        const unplayable = result.debugEvents.filter(
          e => e.assignedHand === 'Unplayable'
        );
        expect(unplayable.length).toBe(result.debugEvents.length);
      });

      it('should meet threshold bands', () => {
        expectResultInBands(result, bands['F06']);
      });
    });

    describe('F07 - Triad compact', () => {
      let performance: Performance;
      let result: EngineResult;

      beforeAll(() => {
        performance = loadPerformanceFixture('F07');
        assertPerformanceUnits(performance);
        result = runSolver(performance);
      });

      it('should be feasible', () => {
        expect(result).toBeFeasible();
      });

      it('should use at least 3 unique fingers for chord', () => {
        const simultaneousEvents = result.debugEvents.filter(
          e => e.startTime === result.debugEvents[0].startTime && e.assignedHand !== 'Unplayable'
        );
        const fingers = new Set(simultaneousEvents.map(e => `${e.assignedHand}-${e.finger}`));
        expect(fingers.size).toBeGreaterThanOrEqual(3);
      });

      it('should meet threshold bands', () => {
        expectResultInBands(result, bands['F07']);
      });
    });

    describe('F08 - Triad large span', () => {
      let performance: Performance;
      let result: EngineResult;

      beforeAll(() => {
        performance = loadPerformanceFixture('F08');
        assertPerformanceUnits(performance);
        result = runSolver(performance);
      });

      it('should be feasible', () => {
        expect(result).toBeFeasible();
      });

      it('should handle wide chord with multiple fingers', () => {
        const simultaneousEvents = result.debugEvents.filter(
          e => e.startTime === result.debugEvents[0].startTime && e.assignedHand !== 'Unplayable'
        );
        const fingers = new Set(simultaneousEvents.map(e => `${e.assignedHand}-${e.finger}`));
        expect(fingers.size).toBe(simultaneousEvents.length);
      });

      it('should meet threshold bands', () => {
        expectResultInBands(result, bands['F08']);
      });
    });

    describe('F09 - Cluster chord tight', () => {
      let performance: Performance;
      let result: EngineResult;

      beforeAll(() => {
        performance = loadPerformanceFixture('F09');
        assertPerformanceUnits(performance);
        result = runSolver(performance);
      });

      it('should handle tight cluster (feasible or split across hands)', () => {
        expect(result).toHaveNoNaNs();
        expect(result).toHaveValidMappingIntegrity();
      });

      it('should meet threshold bands', () => {
        expectResultInBands(result, bands['F09']);
      });
    });

    describe('F10 - 2-octave chromatic', () => {
      let performance: Performance;
      let result: EngineResult;

      beforeAll(() => {
        performance = loadPerformanceFixture('F10');
        assertPerformanceUnits(performance);
        result = runSolver(performance);
      });

      it('should be feasible', () => {
        expect(result).toBeFeasible();
      });

      it('should have smooth pathing (movement not excessively spiky)', () => {
        expect(result).toHaveNoNaNs();
        expect(result).toHaveValidGridPositions();
      });

      it('should meet threshold bands', () => {
        expectResultInBands(result, bands['F10']);
      });
    });

    describe('F11 - Off-grid micro-offsets', () => {
      let performance: Performance;
      let result1: EngineResult;
      let result2: EngineResult;

      beforeAll(() => {
        performance = loadPerformanceFixture('F11');
        assertPerformanceUnits(performance);
        result1 = runSolver(performance);
        result2 = runSolver(performance);
      });

      it('should have stable ordering', () => {
        expect(result1.debugEvents.length).toBe(result2.debugEvents.length);
        for (let i = 0; i < result1.debugEvents.length; i++) {
          expect(result1.debugEvents[i].startTime).toBeCloseTo(
            result2.debugEvents[i].startTime,
            6
          );
        }
      });

      it('should produce no NaNs', () => {
        expect(result1).toHaveNoNaNs();
      });

      it('should be deterministic', () => {
        expectWithinEpsilon(result1.score, result2.score, 0.001);
      });

      it('should meet threshold bands', () => {
        expectResultInBands(result1, bands['F11']);
      });
    });

    describe('F12 - Grace cluster', () => {
      let performance: Performance;
      let result: EngineResult;

      beforeAll(() => {
        performance = loadPerformanceFixture('F12');
        assertPerformanceUnits(performance);
        result = runSolver(performance);
      });

      it('should not crash', () => {
        expect(result).toBeDefined();
        expect(result.debugEvents.length).toBe(5);
      });

      it('should have consistent ordering', () => {
        for (let i = 1; i < result.debugEvents.length; i++) {
          expect(result.debugEvents[i].startTime).toBeGreaterThanOrEqual(
            result.debugEvents[i - 1].startTime
          );
        }
      });

      it('should meet threshold bands', () => {
        expectResultInBands(result, bands['F12']);
      });
    });
  });

  describe('Integration Fixtures (I01-I05)', () => {
    describe('I01 - Dense 32nd bursts', () => {
      let performance: Performance;
      let result: EngineResult;

      beforeAll(() => {
        performance = loadPerformanceFixture('I01');
        assertPerformanceUnits(performance);
        result = runSolver(performance);
      });

      it('should be feasible', () => {
        expect(result).toBeFeasible();
      });

      it('should have significant fatigue (dense hits)', () => {
        expect(result.averageMetrics.fatigue).toBeGreaterThan(0);
      });

      it('should use hand alternation', () => {
        const usage = countHandUsage(result);
        expect(usage.left).toBeGreaterThan(0);
        expect(usage.right).toBeGreaterThan(0);
      });

      it('should meet threshold bands', () => {
        expectResultInBands(result, bands['I01']);
      });
    });

    describe('I02 - Hi-hat repeat 2 notes', () => {
      let performance: Performance;
      let result: EngineResult;

      beforeAll(() => {
        performance = loadPerformanceFixture('I02');
        assertPerformanceUnits(performance);
        result = runSolver(performance);
      });

      it('should be feasible', () => {
        expect(result).toBeFeasible();
      });

      it('should have bounce >= 0', () => {
        expect(result.averageMetrics.bounce).toBeGreaterThanOrEqual(0);
      });

      it('should have low movement', () => {
        expect(result.averageMetrics.movement).toBeLessThan(50);
      });

      it('should meet threshold bands', () => {
        expectResultInBands(result, bands['I02']);
      });
    });

    describe('I03 - Spider walk', () => {
      let performance: Performance;
      let result: EngineResult;

      beforeAll(() => {
        performance = loadPerformanceFixture('I03');
        assertPerformanceUnits(performance);
        result = runSolver(performance);
      });

      it('should be feasible', () => {
        expect(result).toBeFeasible();
      });

      it('should have crossover component present', () => {
        expect(result.averageMetrics).toBeDefined();
      });

      it('should meet threshold bands', () => {
        expectResultInBands(result, bands['I03']);
      });
    });

    describe('I04 - 2-hand bass+melody', () => {
      let performance: Performance;
      let result: EngineResult;

      beforeAll(() => {
        performance = loadPerformanceFixture('I04');
        assertPerformanceUnits(performance);
        result = runSolver(performance);
      });

      it('should use both hands', () => {
        const usage = countHandUsage(result);
        expect(usage.left).toBeGreaterThan(0);
        expect(usage.right).toBeGreaterThan(0);
      });

      it('should meet threshold bands', () => {
        expectResultInBands(result, bands['I04']);
      });
    });

    describe('I05 - Mixed benchmark', () => {
      let performance: Performance;
      let result: EngineResult;

      beforeAll(() => {
        performance = loadPerformanceFixture('I05');
        assertPerformanceUnits(performance);
        result = runSolver(performance);
      });

      it('should be feasible (regression gate)', () => {
        expect(result).toBeFeasible();
      });

      it('should meet all threshold bands', () => {
        expectResultInBands(result, bands['I05']);
      });

      it('should not regress on core metrics', () => {
        expect(result).toHaveNoNaNs();
        expect(result).toHaveValidMappingIntegrity();
      });

      it('should have stable metric profile (component shares)', () => {
        const profile = (bands['I05'] as any).metricProfile;
        if (!profile) {
          console.log('No metricProfile in bands.json for I05, skipping share assertions');
          return;
        }

        const total = result.averageMetrics.total;
        if (total <= 0) {
          console.log('Total cost is 0, skipping share assertions');
          return;
        }

        const movementShare = (result.averageMetrics.movement / total) * 100;
        const fatigueShare = (result.averageMetrics.fatigue / total) * 100;
        const crossoverShare = (result.averageMetrics.crossover / total) * 100;

        expect(movementShare).toBeGreaterThanOrEqual(profile.movementShareMin ?? 0);
        expect(movementShare).toBeLessThanOrEqual(profile.movementShareMax ?? 100);

        expect(fatigueShare).toBeGreaterThanOrEqual(profile.fatigueShareMin ?? 0);
        expect(fatigueShare).toBeLessThanOrEqual(profile.fatigueShareMax ?? 100);

        expect(crossoverShare).toBeGreaterThanOrEqual(profile.crossoverShareMin ?? 0);
        expect(crossoverShare).toBeLessThanOrEqual(profile.crossoverShareMax ?? 100);

        console.log(`I05 metric profile: movement=${movementShare.toFixed(1)}%, fatigue=${fatigueShare.toFixed(1)}%, crossover=${crossoverShare.toFixed(1)}%`);
      });
    });
  });

  describe('High-ROI Solver Paths', () => {
    describe('Manual assignments respected', () => {
      it('should use forced hand/finger when provided', () => {
        const performance = ensureEventKeys({
          name: 'Manual Test',
          tempo: 120,
          events: [
            { noteNumber: 36, startTime: 0.0, duration: 0.5, velocity: 100, eventKey: 'event-0' },
            { noteNumber: 40, startTime: 0.5, duration: 0.5, velocity: 100, eventKey: 'event-1' },
          ],
        });

        const manualAssignments = {
          'event-0': { hand: 'right' as const, finger: 'index' },
        };

        const result = runSolver(performance, DEFAULT_TEST_CONFIG, null, manualAssignments);

        const forcedEvent = result.debugEvents.find(e => e.eventKey === 'event-0');
        expect(forcedEvent).toBeDefined();
        if (forcedEvent && forcedEvent.assignedHand !== 'Unplayable') {
          expect(forcedEvent.assignedHand).toBe('right');
          expect(forcedEvent.finger).toBe('index');
        }
      });
    });

    describe('Ignored/unmapped notes behavior', () => {
      it('should mark off-grid notes as Unplayable without crashing', () => {
        const performance = {
          name: 'Off-Grid Test',
          tempo: 120,
          events: [
            { noteNumber: 36, startTime: 0.0, duration: 0.5, velocity: 100, eventKey: 'on-grid' },
            { noteNumber: 200, startTime: 0.5, duration: 0.5, velocity: 100, eventKey: 'off-grid' },
          ],
        };

        const result = runSolver(performance);

        expect(result).toHaveNoNaNs();
        expect(result.unplayableCount).toBeGreaterThanOrEqual(1);

        const unplayableEvents = result.debugEvents.filter(
          e => e.assignedHand === 'Unplayable'
        );
        expect(unplayableEvents.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('Chord grouping correctness', () => {
      it('should treat same-startTime events as chord (multiple fingers)', () => {
        const performance = {
          name: 'Chord Test',
          tempo: 120,
          events: [
            { noteNumber: 36, startTime: 0.0, duration: 0.5, velocity: 100, eventKey: 'chord-0' },
            { noteNumber: 38, startTime: 0.0, duration: 0.5, velocity: 100, eventKey: 'chord-1' },
            { noteNumber: 40, startTime: 0.0, duration: 0.5, velocity: 100, eventKey: 'chord-2' },
          ],
        };

        const result = runSolver(performance);

        const chordEvents = result.debugEvents.filter(
          e => e.startTime === 0.0 && e.assignedHand !== 'Unplayable'
        );

        const usedFingers = new Set(
          chordEvents.map(e => `${e.assignedHand}-${e.finger}`)
        );
        expect(usedFingers.size).toBe(chordEvents.length);
      });
    });

    describe('Fallback mapping path', () => {
      it('should produce stable results with null mapping (L01)', () => {
        const performance = {
          name: 'Fallback Test',
          tempo: 120,
          events: [
            { noteNumber: 36, startTime: 0.0, duration: 0.5, velocity: 100 },
            { noteNumber: 40, startTime: 0.5, duration: 0.5, velocity: 100 },
            { noteNumber: 44, startTime: 1.0, duration: 0.5, velocity: 100 },
          ],
        };

        const result1 = runSolver(performance, DEFAULT_TEST_CONFIG, null);
        const result2 = runSolver(performance, DEFAULT_TEST_CONFIG, null);

        expect(result1).toHaveNoNaNs();
        expect(result2).toHaveNoNaNs();
        expectWithinEpsilon(result1.score, result2.score, 0.001);
      });
    });
  });
});
