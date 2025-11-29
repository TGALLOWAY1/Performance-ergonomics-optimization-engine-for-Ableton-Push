/**
 * Unit tests for Transition Analysis Engine
 * 
 * Tests verify that:
 * - Short vs long gaps → different timeDeltaMs and speedPressure
 * - Increasing distances → higher gridDistance and difficulty
 * - Hand switches and finger changes are detected correctly
 * - Composite difficulty reflects transition complexity
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeTransition,
  analyzeAllTransitions,
} from '../transitionAnalyzer';
import type { AnalyzedEvent } from '../../types/eventAnalysis';

/**
 * Helper to create a test AnalyzedEvent
 */
function createTestEvent(
  noteNumber: number,
  startTime: number,
  row: number,
  col: number,
  assignedHand: 'left' | 'right' | 'Unplayable' = 'left',
  finger: 'thumb' | 'index' | 'middle' | 'ring' | 'pinky' | null = 'index',
  anatomicalStretchScore: number = 0.2,
  compositeDifficultyScore: number = 0.3
): AnalyzedEvent {
  return {
    noteNumber,
    startTime,
    assignedHand,
    finger,
    cost: 2.0,
    difficulty: 'Easy',
    row,
    col,
    anatomicalStretchScore,
    compositeDifficultyScore,
  };
}

describe('transitionAnalyzer', () => {
  describe('analyzeTransition', () => {
    it('should calculate timeDeltaMs correctly for short gap', () => {
      const fromEvent = createTestEvent(36, 0.0, 0, 0);
      const toEvent = createTestEvent(38, 0.1, 0, 1); // 100ms gap
      
      const transition = analyzeTransition(fromEvent, toEvent);
      
      expect(transition.metrics.timeDeltaMs).toBeCloseTo(100, 0);
    });
    
    it('should calculate timeDeltaMs correctly for long gap', () => {
      const fromEvent = createTestEvent(36, 0.0, 0, 0);
      const toEvent = createTestEvent(38, 2.5, 0, 1); // 2500ms gap
      
      const transition = analyzeTransition(fromEvent, toEvent);
      
      expect(transition.metrics.timeDeltaMs).toBeCloseTo(2500, 0);
    });
    
    it('should calculate gridDistance for adjacent pads', () => {
      const fromEvent = createTestEvent(36, 0.0, 0, 0);
      const toEvent = createTestEvent(38, 0.1, 0, 1); // Adjacent horizontally
      
      const transition = analyzeTransition(fromEvent, toEvent);
      
      expect(transition.metrics.gridDistance).toBeCloseTo(1.0, 2);
    });
    
    it('should calculate gridDistance for diagonal movement', () => {
      const fromEvent = createTestEvent(36, 0.0, 0, 0);
      const toEvent = createTestEvent(38, 0.1, 1, 1); // Diagonal
      
      const transition = analyzeTransition(fromEvent, toEvent);
      
      expect(transition.metrics.gridDistance).toBeCloseTo(Math.sqrt(2), 2); // ~1.414
    });
    
    it('should calculate higher gridDistance for larger jumps', () => {
      const fromEvent = createTestEvent(36, 0.0, 0, 0);
      const toEvent = createTestEvent(60, 0.1, 7, 7); // Far corner
      
      const transition = analyzeTransition(fromEvent, toEvent);
      
      expect(transition.metrics.gridDistance).toBeGreaterThan(5.0);
    });
    
    it('should detect hand switch', () => {
      const fromEvent = createTestEvent(36, 0.0, 0, 0, 'left', 'index');
      const toEvent = createTestEvent(38, 0.1, 0, 5, 'right', 'index');
      
      const transition = analyzeTransition(fromEvent, toEvent);
      
      expect(transition.metrics.handSwitch).toBe(true);
    });
    
    it('should not detect hand switch for same hand', () => {
      const fromEvent = createTestEvent(36, 0.0, 0, 0, 'left', 'index');
      const toEvent = createTestEvent(38, 0.1, 0, 1, 'left', 'middle');
      
      const transition = analyzeTransition(fromEvent, toEvent);
      
      expect(transition.metrics.handSwitch).toBe(false);
    });
    
    it('should detect finger change', () => {
      const fromEvent = createTestEvent(36, 0.0, 0, 0, 'left', 'index');
      const toEvent = createTestEvent(38, 0.1, 0, 1, 'left', 'middle'); // Same hand, different finger
      
      const transition = analyzeTransition(fromEvent, toEvent);
      
      expect(transition.metrics.fingerChange).toBe(true);
    });
    
    it('should not detect finger change for same finger', () => {
      const fromEvent = createTestEvent(36, 0.0, 0, 0, 'left', 'index');
      const toEvent = createTestEvent(38, 0.1, 0, 1, 'left', 'index'); // Same finger
      
      const transition = analyzeTransition(fromEvent, toEvent);
      
      expect(transition.metrics.fingerChange).toBe(false);
    });
    
    it('should calculate higher speedPressure for short time gaps', () => {
      const fromEvent = createTestEvent(36, 0.0, 0, 0);
      const toEvent = createTestEvent(38, 0.01, 0, 1); // Very short gap (10ms)
      
      const transition = analyzeTransition(fromEvent, toEvent);
      
      expect(transition.metrics.speedPressure).toBeGreaterThan(0.5);
    });
    
    it('should calculate lower speedPressure for long time gaps', () => {
      const fromEvent = createTestEvent(36, 0.0, 0, 0);
      const toEvent = createTestEvent(38, 2.0, 0, 1); // Long gap (2000ms)
      
      const transition = analyzeTransition(fromEvent, toEvent);
      
      expect(transition.metrics.speedPressure).toBeLessThan(0.3);
    });
    
    it('should aggregate anatomical stretch score (max of both events)', () => {
      const fromEvent = createTestEvent(36, 0.0, 0, 0, 'left', 'index', 0.3);
      const toEvent = createTestEvent(38, 0.1, 0, 1, 'left', 'middle', 0.7);
      
      const transition = analyzeTransition(fromEvent, toEvent);
      
      expect(transition.metrics.anatomicalStretchScore).toBe(0.7); // Max of 0.3 and 0.7
    });
    
    it('should calculate higher composite difficulty for complex transitions', () => {
      // Simple transition: adjacent pads, long time, same hand/finger
      const simpleFrom = createTestEvent(36, 0.0, 0, 0, 'left', 'index', 0.2, 0.2);
      const simpleTo = createTestEvent(38, 1.0, 0, 1, 'left', 'index', 0.2, 0.2);
      const simpleTransition = analyzeTransition(simpleFrom, simpleTo);
      
      // Complex transition: far distance, short time, hand switch, high stretch
      const complexFrom = createTestEvent(36, 0.0, 0, 0, 'left', 'index', 0.8, 0.8);
      const complexTo = createTestEvent(60, 0.05, 7, 7, 'right', 'pinky', 0.9, 0.9);
      const complexTransition = analyzeTransition(complexFrom, complexTo);
      
      expect(complexTransition.metrics.compositeDifficultyScore)
        .toBeGreaterThan(simpleTransition.metrics.compositeDifficultyScore);
    });
    
    it('should handle unplayable events', () => {
      const fromEvent = createTestEvent(36, 0.0, 0, 0, 'left', 'index');
      const toEvent: AnalyzedEvent = {
        noteNumber: 99,
        startTime: 0.1,
        assignedHand: 'Unplayable',
        finger: null,
        cost: Infinity,
        difficulty: 'Unplayable',
        anatomicalStretchScore: 1.0,
        compositeDifficultyScore: 1.0,
      };
      
      const transition = analyzeTransition(fromEvent, toEvent);
      
      // Hand switch should be false (can't switch from/to unplayable)
      expect(transition.metrics.handSwitch).toBe(false);
      // Speed pressure should be high (unplayable = maximum difficulty)
      expect(transition.metrics.speedPressure).toBe(1.0);
    });
  });
  
  describe('analyzeAllTransitions', () => {
    it('should return empty array for less than 2 events', () => {
      const events: AnalyzedEvent[] = [
        createTestEvent(36, 0.0, 0, 0),
      ];
      
      const transitions = analyzeAllTransitions(events);
      
      expect(transitions).toHaveLength(0);
    });
    
    it('should return empty array for empty events array', () => {
      const transitions = analyzeAllTransitions([]);
      
      expect(transitions).toHaveLength(0);
    });
    
    it('should create transitions for consecutive events', () => {
      const events: AnalyzedEvent[] = [
        createTestEvent(36, 0.0, 0, 0),
        createTestEvent(38, 0.1, 0, 1),
        createTestEvent(40, 0.2, 0, 2),
      ];
      
      const transitions = analyzeAllTransitions(events);
      
      expect(transitions).toHaveLength(2);
      expect(transitions[0].fromIndex).toBe(0);
      expect(transitions[0].toIndex).toBe(1);
      expect(transitions[1].fromIndex).toBe(1);
      expect(transitions[1].toIndex).toBe(2);
    });
    
    it('should correctly set event references', () => {
      const events: AnalyzedEvent[] = [
        createTestEvent(36, 0.0, 0, 0),
        createTestEvent(38, 0.1, 0, 1),
      ];
      
      const transitions = analyzeAllTransitions(events);
      
      expect(transitions[0].fromEvent.noteNumber).toBe(36);
      expect(transitions[0].toEvent.noteNumber).toBe(38);
    });
    
    it('should handle events with increasing distances', () => {
      const events: AnalyzedEvent[] = [
        createTestEvent(36, 0.0, 0, 0), // Start
        createTestEvent(38, 0.1, 0, 1), // Distance: 1.0
        createTestEvent(40, 0.2, 0, 3), // Distance: 2.0
        createTestEvent(42, 0.3, 3, 3), // Distance: ~3.16
      ];
      
      const transitions = analyzeAllTransitions(events);
      
      expect(transitions[0].metrics.gridDistance).toBeCloseTo(1.0, 2);
      expect(transitions[1].metrics.gridDistance).toBeCloseTo(2.0, 2);
      expect(transitions[2].metrics.gridDistance).toBeGreaterThan(3.0);
      
      // Later transitions should generally have higher difficulty (due to distance)
      expect(transitions[2].metrics.compositeDifficultyScore)
        .toBeGreaterThanOrEqual(transitions[0].metrics.compositeDifficultyScore);
    });
    
    it('should handle events with varying time gaps', () => {
      const events: AnalyzedEvent[] = [
        createTestEvent(36, 0.0, 0, 0),
        createTestEvent(38, 0.01, 0, 1), // Very short gap (10ms)
        createTestEvent(40, 1.0, 0, 2),  // Long gap (990ms)
        createTestEvent(42, 1.05, 0, 3), // Short gap (50ms)
      ];
      
      const transitions = analyzeAllTransitions(events);
      
      // First transition: short gap → high speed pressure
      expect(transitions[0].metrics.speedPressure).toBeGreaterThan(0.5);
      expect(transitions[0].metrics.timeDeltaMs).toBeCloseTo(10, 0);
      
      // Second transition: long gap → low speed pressure
      expect(transitions[1].metrics.speedPressure).toBeLessThan(0.3);
      expect(transitions[1].metrics.timeDeltaMs).toBeCloseTo(990, 0);
      
      // Third transition: short gap again → high speed pressure
      expect(transitions[2].metrics.speedPressure).toBeGreaterThan(0.3);
      expect(transitions[2].metrics.timeDeltaMs).toBeCloseTo(50, 0);
    });
  });
});

