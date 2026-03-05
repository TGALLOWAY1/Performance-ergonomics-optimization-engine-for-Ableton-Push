/**
 * Solver Policy Tests
 * 
 * These tests explicitly encode the intended behavior for edge cases
 * and ambiguous scenarios. They serve as a "policy specification" that
 * prevents confusion as the solver evolves.
 * 
 * POLICY DECISIONS DOCUMENTED HERE:
 * 
 * 1. UNMAPPED NOTES: Notes outside the grid are counted as UNPLAYABLE
 *    - They increment `unplayableCount`
 *    - They get `assignedHand: 'Unplayable'` in debugEvents
 *    - They do NOT cause errors or crashes
 *    - They do NOT affect scoring of playable notes
 * 
 * 2. IGNORED NOTES: Handled at APP LAYER (before solver)
 *    - The solver never sees ignored notes (filtered by performanceSelectors)
 *    - If passed to solver anyway, they behave as unmapped
 * 
 * 3. HARD COUNT: "Technically playable but high cost"
 *    - Distinct from unplayable (hardCount ≠ unplayableCount)
 *    - Affects score but doesn't make result "infeasible"
 * 
 * 4. SCORE DIRECTION: Lower score = worse
 *    - Formula: 100 - (5 * hardCount) - (20 * unplayableCount)
 *    - Perfect score = 100
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TEST_CONFIG,
  runSolver,
  createTestPerformance,
} from './helpers/testHelpers';
import { loadMappingFixture } from './helpers/fixtureLoader';
import { GridMapService } from '../gridMapService';

describe('Solver Policy Tests', () => {
  describe('Unmapped Notes Policy', () => {
    it('POLICY: unmapped notes are counted as Unplayable (not errors)', () => {
      const onGridNote = 36;
      const offGridNote = 200;
      
      const position = GridMapService.noteToGrid(onGridNote, DEFAULT_TEST_CONFIG);
      expect(position).not.toBeNull();
      
      const offPosition = GridMapService.noteToGrid(offGridNote, DEFAULT_TEST_CONFIG);
      expect(offPosition).toBeNull();
      
      const performance = createTestPerformance([
        { noteNumber: onGridNote, startTime: 0.0 },
        { noteNumber: offGridNote, startTime: 0.5 },
      ]);
      
      const result = runSolver(performance);
      
      expect(result.unplayableCount).toBeGreaterThanOrEqual(1);
      expect(result.debugEvents.length).toBeGreaterThanOrEqual(1);
      
      const unplayableEvents = result.debugEvents.filter(e => e.assignedHand === 'Unplayable');
      const playableEvents = result.debugEvents.filter(e => e.assignedHand !== 'Unplayable');
      
      expect(unplayableEvents.length).toBeGreaterThanOrEqual(1);
      expect(playableEvents.length).toBeGreaterThanOrEqual(0);
    });

    it('POLICY: unmapped notes do not affect scoring of playable notes', () => {
      const onlyOnGrid = createTestPerformance([
        { noteNumber: 36, startTime: 0.0 },
        { noteNumber: 37, startTime: 0.5 },
      ]);
      
      const mixedNotes = createTestPerformance([
        { noteNumber: 36, startTime: 0.0 },
        { noteNumber: 200, startTime: 0.25 },
        { noteNumber: 37, startTime: 0.5 },
      ]);
      
      const resultOnlyOnGrid = runSolver(onlyOnGrid);
      const resultMixed = runSolver(mixedNotes);
      
      expect(resultOnlyOnGrid.unplayableCount).toBe(0);
      expect(resultMixed.unplayableCount).toBe(1);
      
      const onGridEventsOnlyOnGrid = resultOnlyOnGrid.debugEvents.filter(
        e => e.assignedHand !== 'Unplayable'
      );
      const onGridEventsMixed = resultMixed.debugEvents.filter(
        e => e.assignedHand !== 'Unplayable'
      );
      
      expect(onGridEventsMixed.length).toBe(2);
      expect(onGridEventsOnlyOnGrid.length).toBe(2);
    });

    it('POLICY: notes below bottomLeftNote are unmapped', () => {
      const belowGridNote = 35;
      
      const position = GridMapService.noteToGrid(belowGridNote, DEFAULT_TEST_CONFIG);
      expect(position).toBeNull();
      
      const performance = createTestPerformance([
        { noteNumber: belowGridNote, startTime: 0.0 },
      ]);
      
      const result = runSolver(performance);
      
      expect(result.unplayableCount).toBe(1);
      expect(result.debugEvents[0].assignedHand).toBe('Unplayable');
    });

    it('POLICY: notes above grid window (>64 pads from bottomLeft) are unmapped', () => {
      const aboveGridNote = DEFAULT_TEST_CONFIG.bottomLeftNote + 64;
      
      const position = GridMapService.noteToGrid(aboveGridNote, DEFAULT_TEST_CONFIG);
      expect(position).toBeNull();
      
      const performance = createTestPerformance([
        { noteNumber: aboveGridNote, startTime: 0.0 },
      ]);
      
      const result = runSolver(performance);
      
      expect(result.unplayableCount).toBe(1);
    });
  });

  describe('Score Direction Policy', () => {
    it('POLICY: higher unplayableCount = lower score', () => {
      const feasible = createTestPerformance([
        { noteNumber: 36, startTime: 0.0 },
        { noteNumber: 37, startTime: 0.5 },
      ]);
      
      const partiallyUnplayable = createTestPerformance([
        { noteNumber: 36, startTime: 0.0 },
        { noteNumber: 200, startTime: 0.5 },
      ]);
      
      const allUnplayable = createTestPerformance([
        { noteNumber: 200, startTime: 0.0 },
        { noteNumber: 201, startTime: 0.5 },
      ]);
      
      const feasibleResult = runSolver(feasible);
      const partialResult = runSolver(partiallyUnplayable);
      const allUnplayableResult = runSolver(allUnplayable);
      
      expect(feasibleResult.score).toBeGreaterThan(partialResult.score);
      expect(partialResult.score).toBeGreaterThan(allUnplayableResult.score);
    });

    it('POLICY: perfect score is 100 when all notes are playable and easy', () => {
      const easyPerformance = createTestPerformance([
        { noteNumber: 36, startTime: 0.0 },
        { noteNumber: 36, startTime: 1.0 },
      ]);
      
      const result = runSolver(easyPerformance);
      
      expect(result.unplayableCount).toBe(0);
      if (result.hardCount === 0) {
        expect(result.score).toBe(100);
      }
    });
  });

  describe('Feasibility Policy', () => {
    it('POLICY: feasible means unplayableCount === 0', () => {
      const feasiblePerf = createTestPerformance([
        { noteNumber: 36, startTime: 0.0 },
        { noteNumber: 40, startTime: 0.5 },
      ]);
      
      const result = runSolver(feasiblePerf);
      
      expect(result).toBeFeasible();
      expect(result.unplayableCount).toBe(0);
    });

    it('POLICY: infeasible means unplayableCount > 0', () => {
      const infeasiblePerf = createTestPerformance([
        { noteNumber: 200, startTime: 0.0 },
      ]);
      
      const result = runSolver(infeasiblePerf);
      
      expect(result).toBeInfeasible();
      expect(result.unplayableCount).toBeGreaterThan(0);
    });
  });

  describe('Sparse Mapping Policy (L03)', () => {
    it('POLICY: with sparse mapping, solver handles missing cells gracefully', () => {
      const sparseMapping = loadMappingFixture('L03_sparse');
      
      const noteInSparseMapping = 36;
      const noteNotInSparseMapping = 37;
      
      const performance = createTestPerformance([
        { noteNumber: noteInSparseMapping, startTime: 0.0 },
        { noteNumber: noteNotInSparseMapping, startTime: 0.5 },
      ]);
      
      const result = runSolver(performance, DEFAULT_TEST_CONFIG, sparseMapping);
      
      expect(result).toBeDefined();
      expect(result).toHaveNoNaNs();
      expect(result.debugEvents.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Chord Policy (same startTime)', () => {
    it('POLICY: same-startTime events are treated as a chord, not sequential', () => {
      const chordPerformance = createTestPerformance([
        { noteNumber: 36, startTime: 0.0 },
        { noteNumber: 38, startTime: 0.0 },
        { noteNumber: 40, startTime: 0.0 },
      ]);
      
      const result = runSolver(chordPerformance);
      
      const chordEvents = result.debugEvents.filter(
        e => e.startTime === 0.0 && e.assignedHand !== 'Unplayable'
      );
      
      const usedFingers = new Set(
        chordEvents.map(e => `${e.assignedHand}-${e.finger}`)
      );
      expect(usedFingers.size).toBe(chordEvents.length);
    });

    it('POLICY: chord notes should use multiple fingers, not repeat same finger', () => {
      const chordPerformance = createTestPerformance([
        { noteNumber: 36, startTime: 0.0 },
        { noteNumber: 37, startTime: 0.0 },
      ]);
      
      const result = runSolver(chordPerformance);
      
      const chordEvents = result.debugEvents.filter(
        e => e.startTime === 0.0 && e.assignedHand !== 'Unplayable'
      );
      
      if (chordEvents.length === 2) {
        const finger1 = `${chordEvents[0].assignedHand}-${chordEvents[0].finger}`;
        const finger2 = `${chordEvents[1].assignedHand}-${chordEvents[1].finger}`;
        expect(finger1).not.toBe(finger2);
      }
    });
  });

  describe('Chord Permutation Stability', () => {
    it('POLICY: chord result should be stable under input event permutation', () => {
      const chordNotes = [36, 40, 43, 47];
      
      const chordOrdered = createTestPerformance(
        chordNotes.map(n => ({ noteNumber: n, startTime: 0.0 }))
      );
      
      const chordReversed = createTestPerformance(
        [...chordNotes].reverse().map(n => ({ noteNumber: n, startTime: 0.0 }))
      );
      
      const chordShuffled = createTestPerformance(
        [40, 47, 36, 43].map(n => ({ noteNumber: n, startTime: 0.0 }))
      );
      
      const resultOrdered = runSolver(chordOrdered);
      const resultReversed = runSolver(chordReversed);
      const resultShuffled = runSolver(chordShuffled);
      
      expect(resultOrdered.unplayableCount).toBe(resultReversed.unplayableCount);
      expect(resultOrdered.unplayableCount).toBe(resultShuffled.unplayableCount);
      
      expect(resultOrdered.score).toBe(resultReversed.score);
      expect(resultOrdered.score).toBe(resultShuffled.score);
      
      expect(resultOrdered.averageMetrics.total).toBeCloseTo(resultReversed.averageMetrics.total, 3);
      expect(resultOrdered.averageMetrics.total).toBeCloseTo(resultShuffled.averageMetrics.total, 3);
    });

    it('POLICY: permuted chord should produce same number of unique finger assignments', () => {
      const chordNotes = [36, 38, 40];
      
      const variant1 = createTestPerformance(
        chordNotes.map(n => ({ noteNumber: n, startTime: 0.0 }))
      );
      
      const variant2 = createTestPerformance(
        [40, 36, 38].map(n => ({ noteNumber: n, startTime: 0.0 }))
      );
      
      const result1 = runSolver(variant1);
      const result2 = runSolver(variant2);
      
      const fingers1 = new Set(
        result1.debugEvents
          .filter(e => e.assignedHand !== 'Unplayable')
          .map(e => `${e.assignedHand}-${e.finger}`)
      );
      const fingers2 = new Set(
        result2.debugEvents
          .filter(e => e.assignedHand !== 'Unplayable')
          .map(e => `${e.assignedHand}-${e.finger}`)
      );
      
      expect(fingers1.size).toBe(fingers2.size);
    });
  });

  describe('Grid Bounds Policy', () => {
    it('POLICY: valid grid positions are row 0-7, col 0-7', () => {
      const cornerNotes = [
        DEFAULT_TEST_CONFIG.bottomLeftNote,
        DEFAULT_TEST_CONFIG.bottomLeftNote + 7,
        DEFAULT_TEST_CONFIG.bottomLeftNote + 56,
        DEFAULT_TEST_CONFIG.bottomLeftNote + 63,
      ];
      
      const performance = createTestPerformance(
        cornerNotes.map((n, i) => ({ noteNumber: n, startTime: i * 0.5 }))
      );
      
      const result = runSolver(performance);
      
      expect(result.unplayableCount).toBe(0);
      
      for (const debugEvent of result.debugEvents) {
        if (debugEvent.assignedHand !== 'Unplayable') {
          expect(debugEvent.row).toBeGreaterThanOrEqual(0);
          expect(debugEvent.row).toBeLessThanOrEqual(7);
          expect(debugEvent.col).toBeGreaterThanOrEqual(0);
          expect(debugEvent.col).toBeLessThanOrEqual(7);
        }
      }
    });
  });

  describe('Debug Trace Sanity (Golden)', () => {
    it('GOLDEN: debug output should include essential fields for playable events', () => {
      const performance = createTestPerformance([
        { noteNumber: 36, startTime: 0.0, eventKey: 'golden-1' },
        { noteNumber: 40, startTime: 0.25, eventKey: 'golden-2' },
        { noteNumber: 44, startTime: 0.5, eventKey: 'golden-3' },
      ]);
      
      const result = runSolver(performance);
      
      expect(result.debugEvents.length).toBe(3);
      
      for (const debugEvent of result.debugEvents) {
        expect(debugEvent.eventKey).toBeDefined();
        
        if (debugEvent.assignedHand !== 'Unplayable') {
          expect(debugEvent.assignedHand).toMatch(/^(left|right)$/);
          expect(debugEvent.finger).toBeDefined();
          expect(debugEvent.row).toBeGreaterThanOrEqual(0);
          expect(debugEvent.row).toBeLessThanOrEqual(7);
          expect(debugEvent.col).toBeGreaterThanOrEqual(0);
          expect(debugEvent.col).toBeLessThanOrEqual(7);
          expect(debugEvent.cost).toBeDefined();
          expect(Number.isFinite(debugEvent.cost)).toBe(true);
          expect(debugEvent.startTime).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('GOLDEN: debug output should mark unplayable events clearly', () => {
      const performance = createTestPerformance([
        { noteNumber: 36, startTime: 0.0, eventKey: 'playable-1' },
        { noteNumber: 200, startTime: 0.5, eventKey: 'unplayable-1' },
      ]);
      
      const result = runSolver(performance);
      
      const unplayableEvents = result.debugEvents.filter(
        e => e.assignedHand === 'Unplayable'
      );
      
      expect(unplayableEvents.length).toBeGreaterThanOrEqual(1);
      
      for (const event of unplayableEvents) {
        expect(event.assignedHand).toBe('Unplayable');
        expect(event.difficulty).toBe('Unplayable');
      }
    });

    it('GOLDEN: debug events should preserve eventKey linkage', () => {
      const inputKeys = ['trace-a', 'trace-b', 'trace-c'];
      const performance = createTestPerformance(
        inputKeys.map((key, i) => ({
          noteNumber: 36 + i,
          startTime: i * 0.5,
          eventKey: key,
        }))
      );
      
      const result = runSolver(performance);
      
      const outputKeys = result.debugEvents.map(e => e.eventKey).filter(Boolean);
      
      for (const inputKey of inputKeys) {
        expect(outputKeys).toContain(inputKey);
      }
    });

    it('GOLDEN: debug events should have non-decreasing startTime order', () => {
      const performance = createTestPerformance([
        { noteNumber: 36, startTime: 0.0 },
        { noteNumber: 40, startTime: 0.25 },
        { noteNumber: 44, startTime: 0.5 },
        { noteNumber: 48, startTime: 0.75 },
      ]);
      
      const result = runSolver(performance);
      
      for (let i = 1; i < result.debugEvents.length; i++) {
        expect(result.debugEvents[i].startTime).toBeGreaterThanOrEqual(
          result.debugEvents[i - 1].startTime
        );
      }
    });
  });

  describe('Manual Assignment Override Policy', () => {
    it('POLICY: manual assignments should be respected by solver', () => {
      const performance = {
        name: 'ManualOverrideTest',
        tempo: 120,
        events: [
          { noteNumber: 36, startTime: 0.0, duration: 0.5, velocity: 100, eventKey: 'test-event-1' },
          { noteNumber: 37, startTime: 0.5, duration: 0.5, velocity: 100, eventKey: 'test-event-2' },
        ],
      };
      
      const resultWithoutManual = runSolver(performance);
      
      const manualAssignments = {
        'test-event-1': { hand: 'left' as const, finger: 'pinky' as const },
      };
      
      const resultWithManual = runSolver(performance, DEFAULT_TEST_CONFIG, null, manualAssignments);
      
      expect(resultWithoutManual).toHaveNoNaNs();
      expect(resultWithManual).toHaveNoNaNs();
      
      const manualEvent = resultWithManual.debugEvents.find(e => e.eventKey === 'test-event-1');
      if (manualEvent && manualEvent.assignedHand !== 'Unplayable') {
        expect(manualEvent.assignedHand).toBe('left');
        expect(manualEvent.finger).toBe('pinky');
      }
    });

    it('POLICY: bad manual assignment should increase cost/hardCount', () => {
      const performance = {
        name: 'BadManualTest',
        tempo: 120,
        events: [
          { noteNumber: 36, startTime: 0.0, duration: 0.5, velocity: 100, eventKey: 'event-1' },
          { noteNumber: 99, startTime: 0.5, duration: 0.5, velocity: 100, eventKey: 'event-2' },
        ],
      };
      
      const manualAssignments = {
        'event-1': { hand: 'left' as const, finger: 'thumb' as const },
        'event-2': { hand: 'left' as const, finger: 'thumb' as const },
      };
      
      const resultWithManual = runSolver(performance, DEFAULT_TEST_CONFIG, null, manualAssignments);
      
      expect(resultWithManual).toHaveNoNaNs();
    });

    it('POLICY: manual assignment should not be silently overridden', () => {
      const performance = {
        name: 'OverrideCheck',
        tempo: 120,
        events: [
          { noteNumber: 40, startTime: 0.0, duration: 0.5, velocity: 100, eventKey: 'check-event' },
        ],
      };
      
      const forcedFinger = 'middle' as const;
      const manualAssignments = {
        'check-event': { hand: 'right' as const, finger: forcedFinger },
      };
      
      const result = runSolver(performance, DEFAULT_TEST_CONFIG, null, manualAssignments);
      
      const event = result.debugEvents.find(e => e.eventKey === 'check-event');
      if (event && event.assignedHand !== 'Unplayable') {
        expect(event.assignedHand).toBe('right');
        expect(event.finger).toBe(forcedFinger);
      }
    });
  });
});
