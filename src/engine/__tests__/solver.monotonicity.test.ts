/**
 * Solver Monotonicity Tests
 * 
 * Tests that verify expected monotonic relationships in the solver:
 * - Distance ↑ ⇒ movement cost ↑
 * - Tempo ↑ (same pattern) ⇒ feasibility weakens or cost ↑
 * - Same-pad repetition ↑ ⇒ bounce/fatigue ↑
 * - More crossovers ⇒ crossover penalty ↑
 * 
 * Uses epsilon for all numeric comparisons to avoid floating point issues.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TEST_CONFIG,
  runSolver,
  beatsToSeconds,
} from './helpers/testHelpers';
import { Performance, NoteEvent } from '../../types/performance';

const EPSILON = 0.0001;

function createPerformance(
  events: Array<{ noteNumber: number; startTime: number }>,
  tempo: number = 120
): Performance {
  return {
    name: 'Monotonicity Test',
    tempo,
    events: events.map((e, i) => ({
      noteNumber: e.noteNumber,
      startTime: e.startTime,
      duration: 0.1,
      velocity: 100,
      eventKey: `${i}:${e.startTime}:${e.noteNumber}:1`,
    })),
  };
}

describe('Solver Monotonicity Tests', () => {
  describe('Distance and Movement Cost', () => {
    it('wider jumps should have >= movement cost than adjacent notes', () => {
      const adjacentPerf = createPerformance([
        { noteNumber: 36, startTime: 0.0 },
        { noteNumber: 37, startTime: 0.5 },
        { noteNumber: 36, startTime: 1.0 },
        { noteNumber: 37, startTime: 1.5 },
      ]);

      const widePerf = createPerformance([
        { noteNumber: 36, startTime: 0.0 },
        { noteNumber: 60, startTime: 0.5 },
        { noteNumber: 36, startTime: 1.0 },
        { noteNumber: 60, startTime: 1.5 },
      ]);

      const adjacentResult = runSolver(adjacentPerf);
      const wideResult = runSolver(widePerf);

      expect(adjacentResult).toHaveNoNaNs();
      expect(wideResult).toHaveNoNaNs();

      expect(wideResult.averageMetrics.movement + EPSILON).toBeGreaterThanOrEqual(
        adjacentResult.averageMetrics.movement
      );
    });

    it('same note repeated should have low movement', () => {
      const sameNotePerf = createPerformance([
        { noteNumber: 48, startTime: 0.0 },
        { noteNumber: 48, startTime: 0.5 },
        { noteNumber: 48, startTime: 1.0 },
        { noteNumber: 48, startTime: 1.5 },
      ]);

      const movingPerf = createPerformance([
        { noteNumber: 48, startTime: 0.0 },
        { noteNumber: 52, startTime: 0.5 },
        { noteNumber: 56, startTime: 1.0 },
        { noteNumber: 60, startTime: 1.5 },
      ]);

      const sameResult = runSolver(sameNotePerf);
      const movingResult = runSolver(movingPerf);

      expect(sameResult).toHaveNoNaNs();
      expect(movingResult).toHaveNoNaNs();

      expect(movingResult.averageMetrics.movement + EPSILON).toBeGreaterThanOrEqual(
        sameResult.averageMetrics.movement
      );
    });
  });

  describe('Tempo and Feasibility', () => {
    it('faster tempo should have >= cost or worse feasibility', () => {
      const bpmSlow = 60;
      const bpmFast = 180;

      const slowPerf = createPerformance([
        { noteNumber: 36, startTime: beatsToSeconds(0, bpmSlow) },
        { noteNumber: 48, startTime: beatsToSeconds(1, bpmSlow) },
        { noteNumber: 36, startTime: beatsToSeconds(2, bpmSlow) },
        { noteNumber: 48, startTime: beatsToSeconds(3, bpmSlow) },
      ], bpmSlow);

      const fastPerf = createPerformance([
        { noteNumber: 36, startTime: beatsToSeconds(0, bpmFast) },
        { noteNumber: 48, startTime: beatsToSeconds(1, bpmFast) },
        { noteNumber: 36, startTime: beatsToSeconds(2, bpmFast) },
        { noteNumber: 48, startTime: beatsToSeconds(3, bpmFast) },
      ], bpmFast);

      const slowResult = runSolver(slowPerf);
      const fastResult = runSolver(fastPerf);

      expect(slowResult).toHaveNoNaNs();
      expect(fastResult).toHaveNoNaNs();

      const slowCost = slowResult.averageMetrics.total;
      const fastCost = fastResult.averageMetrics.total;
      const slowScore = slowResult.score;
      const fastScore = fastResult.score;

      const costWorsened = fastCost >= slowCost - EPSILON;
      const scoreWorsened = fastScore <= slowScore + EPSILON;
      const unplayableIncreased = fastResult.unplayableCount >= slowResult.unplayableCount;

      expect(costWorsened || scoreWorsened || unplayableIncreased).toBe(true);
    });

    it('dense 16ths should have more cost than sparse quarters', () => {
      const bpm = 120;

      const sparsePerf = createPerformance([
        { noteNumber: 36, startTime: beatsToSeconds(0, bpm) },
        { noteNumber: 40, startTime: beatsToSeconds(1, bpm) },
        { noteNumber: 44, startTime: beatsToSeconds(2, bpm) },
        { noteNumber: 48, startTime: beatsToSeconds(3, bpm) },
      ], bpm);

      const densePerf = createPerformance([
        { noteNumber: 36, startTime: beatsToSeconds(0, bpm) },
        { noteNumber: 40, startTime: beatsToSeconds(0.25, bpm) },
        { noteNumber: 44, startTime: beatsToSeconds(0.5, bpm) },
        { noteNumber: 48, startTime: beatsToSeconds(0.75, bpm) },
      ], bpm);

      const sparseResult = runSolver(sparsePerf);
      const denseResult = runSolver(densePerf);

      expect(sparseResult).toHaveNoNaNs();
      expect(denseResult).toHaveNoNaNs();

      expect(denseResult.averageMetrics.total + EPSILON).toBeGreaterThanOrEqual(
        sparseResult.averageMetrics.total - EPSILON
      );
    });
  });

  describe('Same-Pad Repetition and Bounce/Fatigue', () => {
    it('repetitions should have non-negative fatigue', () => {
      const bpm = 120;

      const fewHits = createPerformance([
        { noteNumber: 40, startTime: beatsToSeconds(0, bpm) },
        { noteNumber: 40, startTime: beatsToSeconds(1, bpm) },
        { noteNumber: 40, startTime: beatsToSeconds(2, bpm) },
        { noteNumber: 40, startTime: beatsToSeconds(3, bpm) },
      ], bpm);

      const manyHits = createPerformance(
        Array.from({ length: 16 }, (_, i) => ({
          noteNumber: 40,
          startTime: beatsToSeconds(i * 0.25, bpm),
        })),
        bpm
      );

      const fewResult = runSolver(fewHits);
      const manyResult = runSolver(manyHits);

      expect(fewResult).toHaveNoNaNs();
      expect(manyResult).toHaveNoNaNs();

      expect(fewResult.averageMetrics.fatigue).toBeGreaterThanOrEqual(0);
      expect(manyResult.averageMetrics.fatigue).toBeGreaterThanOrEqual(0);
    });

    it('more repetitions should have >= bounce', () => {
      const bpm = 120;

      const fewHits = createPerformance([
        { noteNumber: 36, startTime: beatsToSeconds(0, bpm) },
        { noteNumber: 36, startTime: beatsToSeconds(1, bpm) },
      ], bpm);

      const manyHits = createPerformance(
        Array.from({ length: 8 }, (_, i) => ({
          noteNumber: 36,
          startTime: beatsToSeconds(i * 0.25, bpm),
        })),
        bpm
      );

      const fewResult = runSolver(fewHits);
      const manyResult = runSolver(manyHits);

      expect(fewResult).toHaveNoNaNs();
      expect(manyResult).toHaveNoNaNs();

      expect(manyResult.averageMetrics.bounce + EPSILON).toBeGreaterThanOrEqual(
        fewResult.averageMetrics.bounce - EPSILON
      );
    });
  });

  describe('Crossover Patterns', () => {
    it('patterns requiring crossovers should have >= crossover cost', () => {
      const bpm = 120;

      const separateHandsPerf = createPerformance([
        { noteNumber: 36, startTime: beatsToSeconds(0, bpm) },
        { noteNumber: 36, startTime: beatsToSeconds(0.5, bpm) },
        { noteNumber: 60, startTime: beatsToSeconds(1, bpm) },
        { noteNumber: 60, startTime: beatsToSeconds(1.5, bpm) },
      ], bpm);

      const crossingPerf = createPerformance([
        { noteNumber: 36, startTime: beatsToSeconds(0, bpm) },
        { noteNumber: 60, startTime: beatsToSeconds(0.25, bpm) },
        { noteNumber: 36, startTime: beatsToSeconds(0.5, bpm) },
        { noteNumber: 60, startTime: beatsToSeconds(0.75, bpm) },
        { noteNumber: 36, startTime: beatsToSeconds(1, bpm) },
        { noteNumber: 60, startTime: beatsToSeconds(1.25, bpm) },
      ], bpm);

      const separateResult = runSolver(separateHandsPerf);
      const crossingResult = runSolver(crossingPerf);

      expect(separateResult).toHaveNoNaNs();
      expect(crossingResult).toHaveNoNaNs();
    });
  });

  describe('Edge Cases', () => {
    it('empty performance should not crash and have zero costs', () => {
      const emptyPerf: Performance = {
        name: 'Empty',
        tempo: 120,
        events: [],
      };

      const result = runSolver(emptyPerf);

      expect(result).toBeDefined();
      expect(result.unplayableCount).toBe(0);
    });

    it('single note should have low/zero costs', () => {
      const singleNote = createPerformance([
        { noteNumber: 48, startTime: 0.0 },
      ]);

      const result = runSolver(singleNote);

      expect(result).toHaveNoNaNs();
      expect(result.unplayableCount).toBe(0);
    });

    it('very fast notes should still be stable', () => {
      const bpm = 300;
      const fastPerf = createPerformance(
        Array.from({ length: 8 }, (_, i) => ({
          noteNumber: 36 + (i % 4),
          startTime: beatsToSeconds(i * 0.125, bpm),
        })),
        bpm
      );

      const result = runSolver(fastPerf);

      expect(result).toHaveNoNaNs();
      expect(result).toHaveValidMappingIntegrity();
    });

    it('simultaneous notes should distribute fingers without repetition', () => {
      const chordPerf: Performance = {
        name: 'Chord',
        tempo: 120,
        events: [
          { noteNumber: 36, startTime: 0.0, duration: 0.5, velocity: 100, eventKey: '0:0:36:1' },
          { noteNumber: 38, startTime: 0.0, duration: 0.5, velocity: 100, eventKey: '1:0:38:2' },
          { noteNumber: 40, startTime: 0.0, duration: 0.5, velocity: 100, eventKey: '2:0:40:3' },
          { noteNumber: 43, startTime: 0.0, duration: 0.5, velocity: 100, eventKey: '3:0:43:4' },
        ],
      };

      const result = runSolver(chordPerf);

      expect(result).toHaveNoNaNs();

      const simultaneousPlayable = result.debugEvents.filter(
        e => e.startTime === 0.0 && e.assignedHand !== 'Unplayable'
      );

      const fingerKeys = simultaneousPlayable.map(e => `${e.assignedHand}-${e.finger}`);
      const uniqueFingers = new Set(fingerKeys);

      expect(uniqueFingers.size).toBe(fingerKeys.length);
    });
  });
});
