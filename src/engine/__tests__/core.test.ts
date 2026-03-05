/**
 * Tests for BiomechanicalSolver core engine.
 * 
 * Critical tests for preventing the same finger from being assigned
 * to multiple simultaneous notes (physically impossible).
 */

import { describe, it, expect } from 'vitest';
import { BiomechanicalSolver } from '../core';
import { Performance } from '../../types/performance';
import { GridMapping } from '../../types/layout';
import { InstrumentConfig } from '../../types/performance';

// Default test instrument config (standard Push 3 layout)
const testInstrumentConfig: InstrumentConfig = {
  id: 'test-config',
  name: 'Test Config',
  rows: 8,
  cols: 8,
  bottomLeftNote: 36,
  layoutMode: 'drum_64',
};

// Empty grid mapping for tests
const emptyMapping: GridMapping = {
  id: 'test-mapping',
  name: 'Test Mapping',
  cells: {},
  fingerConstraints: {},
};

describe('BiomechanicalSolver', () => {
  describe('simultaneous note handling', () => {
    it('should NOT assign the same finger to multiple simultaneous notes', () => {
      const solver = new BiomechanicalSolver(testInstrumentConfig, emptyMapping);
      
      // Create a chord with 3 notes at exactly the same time
      const performance: Performance = {
        name: 'Test Chord',
        tempo: 120,
        events: [
          { noteNumber: 36, startTime: 0.0, duration: 0.5, velocity: 100 }, // C1
          { noteNumber: 37, startTime: 0.0, duration: 0.5, velocity: 100 }, // C#1
          { noteNumber: 38, startTime: 0.0, duration: 0.5, velocity: 100 }, // D1
        ],
      };
      
      const result = solver.solve(performance);
      
      // Get all playable events at time 0
      const simultaneousEvents = result.debugEvents.filter(
        e => e.startTime === 0.0 && e.assignedHand !== 'Unplayable' && e.finger !== null
      );
      
      // Check that no two events have the same (hand, finger) combination
      const usedFingers = new Set<string>();
      for (const event of simultaneousEvents) {
        const key = `${event.assignedHand}-${event.finger}`;
        expect(usedFingers.has(key)).toBe(false); // Should NOT have duplicate
        usedFingers.add(key);
      }
      
      // We should have 3 unique finger assignments
      expect(usedFingers.size).toBe(simultaneousEvents.length);
    });

    it('should handle chords that span both hands', () => {
      const solver = new BiomechanicalSolver(testInstrumentConfig, emptyMapping);
      
      // Create a wide chord that requires both hands
      const performance: Performance = {
        name: 'Two Hand Chord',
        tempo: 120,
        events: [
          { noteNumber: 36, startTime: 0.0, duration: 0.5, velocity: 100 }, // Left side
          { noteNumber: 43, startTime: 0.0, duration: 0.5, velocity: 100 }, // Right side (one octave up)
        ],
      };
      
      const result = solver.solve(performance);
      
      // Get all playable events at time 0
      const simultaneousEvents = result.debugEvents.filter(
        e => e.startTime === 0.0 && e.assignedHand !== 'Unplayable' && e.finger !== null
      );
      
      // No finger should be used twice
      const fingerKeys = simultaneousEvents.map(e => `${e.assignedHand}-${e.finger}`);
      const uniqueKeys = new Set(fingerKeys);
      expect(uniqueKeys.size).toBe(fingerKeys.length);
    });

    it('should reset used fingers for notes at different times', () => {
      const solver = new BiomechanicalSolver(testInstrumentConfig, emptyMapping);
      
      // Create two separate single notes at different times
      // Both should be able to use the same finger since they're not simultaneous
      const performance: Performance = {
        name: 'Sequential Notes',
        tempo: 120,
        events: [
          { noteNumber: 36, startTime: 0.0, duration: 0.5, velocity: 100 },
          { noteNumber: 36, startTime: 1.0, duration: 0.5, velocity: 100 }, // Same note, 1 second later
        ],
      };
      
      const result = solver.solve(performance);
      
      // Both notes should have debug events (check total events, not just playable)
      expect(result.debugEvents.length).toBe(2);
      
      // Get playable events
      const playableEvents = result.debugEvents.filter(e => e.assignedHand !== 'Unplayable');
      
      // If both are playable, they CAN use the same finger since they're at different times
      if (playableEvents.length === 2) {
        // Verify that both have valid finger assignments
        expect(playableEvents[0].finger).not.toBeNull();
        expect(playableEvents[1].finger).not.toBeNull();
      }
    });

    it('should handle large chord without crashing', () => {
      const solver = new BiomechanicalSolver(testInstrumentConfig, emptyMapping);
      
      // Create a chord with 11 notes (more than 10 fingers!)
      const performance: Performance = {
        name: 'Large Chord',
        tempo: 120,
        events: Array.from({ length: 11 }, (_, i) => ({
          noteNumber: 36 + i,
          startTime: 0.0,
          duration: 0.5,
          velocity: 100,
        })),
      };
      
      const result = solver.solve(performance);
      
      // Verify we have all debug events
      expect(result.debugEvents.length).toBe(11);
      
      // Verify result has no NaN values
      expect(Number.isNaN(result.score)).toBe(false);
      expect(Number.isNaN(result.unplayableCount)).toBe(false);
      expect(Number.isNaN(result.hardCount)).toBe(false);
    });
  });
});

