/**
 * Solver Edge Cases Tests
 * 
 * Tests for degenerate inputs that might cause crashes or unexpected behavior.
 * These are fast tests that catch edge regressions early.
 * 
 * Categories:
 * - Empty/minimal inputs
 * - Zero/negative/missing values
 * - Duplicate/collision scenarios
 * - Boundary conditions
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TEST_CONFIG,
  runSolver,
  createTestPerformance,
} from './helpers/testHelpers';
import { Performance, NoteEvent } from '../../types/performance';

describe('Solver Edge Cases', () => {
  describe('Empty and Minimal Inputs', () => {
    it('should handle empty performance (events: [])', () => {
      const emptyPerformance: Performance = {
        name: 'Empty',
        tempo: 120,
        events: [],
      };
      
      const result = runSolver(emptyPerformance);
      
      expect(result).toBeDefined();
      expect(result.debugEvents).toEqual([]);
      expect(result.unplayableCount).toBe(0);
      expect(result.hardCount).toBe(0);
      expect(result.score).toBe(100);
    });

    it('should handle single note performance', () => {
      const singleNote: Performance = {
        name: 'Single',
        tempo: 120,
        events: [
          { noteNumber: 48, startTime: 0.0, duration: 0.5, velocity: 100 },
        ],
      };
      
      const result = runSolver(singleNote);
      
      expect(result).toBeDefined();
      expect(result.debugEvents.length).toBe(1);
      expect(result).toHaveNoNaNs();
      expect(result).toBeFeasible();
    });

    it('should handle performance with only unmapped notes', () => {
      const allUnmapped: Performance = {
        name: 'AllUnmapped',
        tempo: 120,
        events: [
          { noteNumber: 200, startTime: 0.0, duration: 0.5, velocity: 100 },
          { noteNumber: 201, startTime: 0.5, duration: 0.5, velocity: 100 },
        ],
      };
      
      const result = runSolver(allUnmapped);
      
      expect(result).toBeDefined();
      expect(result.debugEvents.length).toBe(2);
      expect(result.unplayableCount).toBe(2);
      expect(result).toHaveNoNaNs();
    });
  });

  describe('Duration Edge Cases', () => {
    it('should handle zero duration notes', () => {
      const zeroDuration: Performance = {
        name: 'ZeroDuration',
        tempo: 120,
        events: [
          { noteNumber: 36, startTime: 0.0, duration: 0, velocity: 100 },
          { noteNumber: 37, startTime: 0.5, duration: 0, velocity: 100 },
        ],
      };
      
      const result = runSolver(zeroDuration);
      
      expect(result).toBeDefined();
      expect(result).toHaveNoNaNs();
    });

    it('should handle missing duration (undefined)', () => {
      const missingDuration: Performance = {
        name: 'MissingDuration',
        tempo: 120,
        events: [
          { noteNumber: 36, startTime: 0.0, velocity: 100 } as NoteEvent,
          { noteNumber: 37, startTime: 0.5, velocity: 100 } as NoteEvent,
        ],
      };
      
      const result = runSolver(missingDuration);
      
      expect(result).toBeDefined();
      expect(result).toHaveNoNaNs();
    });

    it('should handle very long duration notes', () => {
      const longDuration: Performance = {
        name: 'LongDuration',
        tempo: 120,
        events: [
          { noteNumber: 36, startTime: 0.0, duration: 60.0, velocity: 100 },
          { noteNumber: 37, startTime: 30.0, duration: 60.0, velocity: 100 },
        ],
      };
      
      const result = runSolver(longDuration);
      
      expect(result).toBeDefined();
      expect(result).toHaveNoNaNs();
    });
  });

  describe('Time Edge Cases', () => {
    it('should handle startTime = 0 exactly', () => {
      const zeroStart: Performance = {
        name: 'ZeroStart',
        tempo: 120,
        events: [
          { noteNumber: 36, startTime: 0, duration: 0.5, velocity: 100 },
        ],
      };
      
      const result = runSolver(zeroStart);
      
      expect(result).toBeDefined();
      expect(result.debugEvents[0].startTime).toBe(0);
    });

    it('should handle very small time differences (microseconds)', () => {
      const microTimes: Performance = {
        name: 'MicroTimes',
        tempo: 120,
        events: [
          { noteNumber: 36, startTime: 0.0, duration: 0.1, velocity: 100 },
          { noteNumber: 37, startTime: 0.000001, duration: 0.1, velocity: 100 },
          { noteNumber: 38, startTime: 0.000002, duration: 0.1, velocity: 100 },
        ],
      };
      
      const result = runSolver(microTimes);
      
      expect(result).toBeDefined();
      expect(result).toHaveNoNaNs();
    });

    it('should handle large time values', () => {
      const largeTimes: Performance = {
        name: 'LargeTimes',
        tempo: 120,
        events: [
          { noteNumber: 36, startTime: 0.0, duration: 0.5, velocity: 100 },
          { noteNumber: 37, startTime: 3600.0, duration: 0.5, velocity: 100 },
        ],
      };
      
      const result = runSolver(largeTimes);
      
      expect(result).toBeDefined();
      expect(result).toHaveNoNaNs();
    });
  });

  describe('Chord and Simultaneous Note Edge Cases', () => {
    it('should handle many simultaneous notes (large chord)', () => {
      const largeChord: Performance = {
        name: 'LargeChord',
        tempo: 120,
        events: Array.from({ length: 10 }, (_, i) => ({
          noteNumber: 36 + i,
          startTime: 0.0,
          duration: 0.5,
          velocity: 100,
        })),
      };
      
      const result = runSolver(largeChord);
      
      expect(result).toBeDefined();
      expect(result).toHaveNoNaNs();
      expect(result.debugEvents.length).toBe(10);
    });

    it('should handle chord with same note repeated (impossible)', () => {
      const duplicateNoteChord: Performance = {
        name: 'DuplicateNote',
        tempo: 120,
        events: [
          { noteNumber: 36, startTime: 0.0, duration: 0.5, velocity: 100, eventKey: '0:0:36:1' },
          { noteNumber: 36, startTime: 0.0, duration: 0.5, velocity: 100, eventKey: '1:0:36:2' },
        ],
      };
      
      const result = runSolver(duplicateNoteChord);
      
      expect(result).toBeDefined();
      expect(result).toHaveNoNaNs();
    });
  });

  describe('EventKey Edge Cases', () => {
    it('should handle missing eventKeys', () => {
      const noEventKeys: Performance = {
        name: 'NoEventKeys',
        tempo: 120,
        events: [
          { noteNumber: 36, startTime: 0.0, duration: 0.5, velocity: 100 },
          { noteNumber: 37, startTime: 0.5, duration: 0.5, velocity: 100 },
        ],
      };
      
      const result = runSolver(noEventKeys);
      
      expect(result).toBeDefined();
      expect(result).toHaveNoNaNs();
    });

    it('should handle duplicate eventKeys gracefully', () => {
      const duplicateKeys: Performance = {
        name: 'DuplicateKeys',
        tempo: 120,
        events: [
          { noteNumber: 36, startTime: 0.0, duration: 0.5, velocity: 100, eventKey: 'same-key' },
          { noteNumber: 37, startTime: 0.5, duration: 0.5, velocity: 100, eventKey: 'same-key' },
        ],
      };
      
      const result = runSolver(duplicateKeys);
      
      expect(result).toBeDefined();
      expect(result).toHaveNoNaNs();
    });

    it('should handle empty eventKey string', () => {
      const emptyKey: Performance = {
        name: 'EmptyKey',
        tempo: 120,
        events: [
          { noteNumber: 36, startTime: 0.0, duration: 0.5, velocity: 100, eventKey: '' },
        ],
      };
      
      const result = runSolver(emptyKey);
      
      expect(result).toBeDefined();
      expect(result).toHaveNoNaNs();
    });
  });

  describe('Velocity Edge Cases', () => {
    it('should handle zero velocity', () => {
      const zeroVelocity: Performance = {
        name: 'ZeroVelocity',
        tempo: 120,
        events: [
          { noteNumber: 36, startTime: 0.0, duration: 0.5, velocity: 0 },
        ],
      };
      
      const result = runSolver(zeroVelocity);
      
      expect(result).toBeDefined();
      expect(result).toHaveNoNaNs();
    });

    it('should handle max velocity (127)', () => {
      const maxVelocity: Performance = {
        name: 'MaxVelocity',
        tempo: 120,
        events: [
          { noteNumber: 36, startTime: 0.0, duration: 0.5, velocity: 127 },
        ],
      };
      
      const result = runSolver(maxVelocity);
      
      expect(result).toBeDefined();
      expect(result).toHaveNoNaNs();
    });

    it('should handle missing velocity (undefined)', () => {
      const missingVelocity: Performance = {
        name: 'MissingVelocity',
        tempo: 120,
        events: [
          { noteNumber: 36, startTime: 0.0, duration: 0.5 } as NoteEvent,
        ],
      };
      
      const result = runSolver(missingVelocity);
      
      expect(result).toBeDefined();
      expect(result).toHaveNoNaNs();
    });
  });

  describe('Note Number Boundary Cases', () => {
    it('should handle MIDI note 0 (below grid)', () => {
      const midiZero: Performance = {
        name: 'MidiZero',
        tempo: 120,
        events: [
          { noteNumber: 0, startTime: 0.0, duration: 0.5, velocity: 100 },
        ],
      };
      
      const result = runSolver(midiZero);
      
      expect(result).toBeDefined();
      expect(result.unplayableCount).toBe(1);
    });

    it('should handle MIDI note 127 (above grid)', () => {
      const midiMax: Performance = {
        name: 'MidiMax',
        tempo: 120,
        events: [
          { noteNumber: 127, startTime: 0.0, duration: 0.5, velocity: 100 },
        ],
      };
      
      const result = runSolver(midiMax);
      
      expect(result).toBeDefined();
      expect(result.unplayableCount).toBe(1);
    });

    it('should handle exact grid boundary notes', () => {
      const boundaryNotes: Performance = {
        name: 'Boundary',
        tempo: 120,
        events: [
          { noteNumber: 36, startTime: 0.0, duration: 0.5, velocity: 100 },
          { noteNumber: 99, startTime: 0.5, duration: 0.5, velocity: 100 },
          { noteNumber: 35, startTime: 1.0, duration: 0.5, velocity: 100 },
          { noteNumber: 100, startTime: 1.5, duration: 0.5, velocity: 100 },
        ],
      };
      
      const result = runSolver(boundaryNotes);
      
      expect(result).toBeDefined();
      expect(result).toHaveNoNaNs();
      expect(result.unplayableCount).toBeGreaterThanOrEqual(2);
      
      const unplayableEvents = result.debugEvents.filter(e => e.assignedHand === 'Unplayable');
      const playableEvents = result.debugEvents.filter(e => e.assignedHand !== 'Unplayable');
      
      expect(unplayableEvents.length).toBeGreaterThanOrEqual(2);
      expect(playableEvents.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Metadata Edge Cases', () => {
    it('should handle missing tempo', () => {
      const noTempo: Performance = {
        name: 'NoTempo',
        events: [
          { noteNumber: 36, startTime: 0.0, duration: 0.5, velocity: 100 },
        ],
      };
      
      const result = runSolver(noTempo);
      
      expect(result).toBeDefined();
      expect(result).toHaveNoNaNs();
    });

    it('should handle zero tempo', () => {
      const zeroTempo: Performance = {
        name: 'ZeroTempo',
        tempo: 0,
        events: [
          { noteNumber: 36, startTime: 0.0, duration: 0.5, velocity: 100 },
        ],
      };
      
      const result = runSolver(zeroTempo);
      
      expect(result).toBeDefined();
      expect(result).toHaveNoNaNs();
    });

    it('should handle very high tempo', () => {
      const highTempo: Performance = {
        name: 'HighTempo',
        tempo: 999,
        events: [
          { noteNumber: 36, startTime: 0.0, duration: 0.5, velocity: 100 },
          { noteNumber: 37, startTime: 0.1, duration: 0.5, velocity: 100 },
        ],
      };
      
      const result = runSolver(highTempo);
      
      expect(result).toBeDefined();
      expect(result).toHaveNoNaNs();
    });

    it('should handle missing name', () => {
      const noName: Performance = {
        tempo: 120,
        events: [
          { noteNumber: 36, startTime: 0.0, duration: 0.5, velocity: 100 },
        ],
      } as Performance;
      
      const result = runSolver(noName);
      
      expect(result).toBeDefined();
      expect(result).toHaveNoNaNs();
    });
  });

  describe('Ordering Edge Cases', () => {
    it('should handle out-of-order events (not sorted by startTime)', () => {
      const outOfOrder: Performance = {
        name: 'OutOfOrder',
        tempo: 120,
        events: [
          { noteNumber: 38, startTime: 1.0, duration: 0.5, velocity: 100 },
          { noteNumber: 36, startTime: 0.0, duration: 0.5, velocity: 100 },
          { noteNumber: 37, startTime: 0.5, duration: 0.5, velocity: 100 },
        ],
      };
      
      const result = runSolver(outOfOrder);
      
      expect(result).toBeDefined();
      expect(result).toHaveNoNaNs();
      expect(result.debugEvents.length).toBe(3);
    });
  });
});
