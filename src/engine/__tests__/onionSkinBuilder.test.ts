/**
 * Unit tests for Onion Skin Builder
 * 
 * Tests verify that:
 * - Simple two-event case where a finger holds and another moves
 * - Last-event case where nextEvent is absent but model still returns
 * - Pad sets are computed correctly (shared, current-only, next-only)
 * - Finger moves are built correctly with holds and movements
 */

import { describe, it, expect } from 'vitest';
import {
  buildOnionSkinModel,
  type OnionSkinInput,
} from '../onionSkinBuilder';
import type { AnalyzedEvent, Transition } from '../../types/eventAnalysis';

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

/**
 * Helper to create a test Transition
 */
function createTestTransition(
  fromIndex: number,
  toIndex: number,
  fromEvent: AnalyzedEvent,
  toEvent: AnalyzedEvent
): Transition {
  return {
    fromIndex,
    toIndex,
    fromEvent,
    toEvent,
    metrics: {
      timeDeltaMs: (toEvent.startTime - fromEvent.startTime) * 1000,
      gridDistance: 1.0,
      handSwitch: false,
      fingerChange: false,
      speedPressure: 0.5,
      anatomicalStretchScore: 0.3,
      compositeDifficultyScore: 0.4,
    },
  };
}

describe('onionSkinBuilder', () => {
  describe('buildOnionSkinModel', () => {
    it('should return null for out-of-range index', () => {
      const input: OnionSkinInput = {
        events: [createTestEvent(36, 0.0, 0, 0)],
        transitions: [],
      };
      
      const model = buildOnionSkinModel(input, 5); // Out of range
      
      expect(model).toBeNull();
    });
    
    it('should return null for negative index', () => {
      const input: OnionSkinInput = {
        events: [createTestEvent(36, 0.0, 0, 0)],
        transitions: [],
      };
      
      const model = buildOnionSkinModel(input, -1);
      
      expect(model).toBeNull();
    });
    
    it('should build model for first event (no previous)', () => {
      const event1 = createTestEvent(36, 0.0, 0, 0);
      const event2 = createTestEvent(38, 0.1, 0, 1);
      
      const input: OnionSkinInput = {
        events: [event1, event2],
        transitions: [createTestTransition(0, 1, event1, event2)],
      };
      
      const model = buildOnionSkinModel(input, 0);
      
      expect(model).not.toBeNull();
      expect(model!.currentEventIndex).toBe(0);
      expect(model!.currentEvent).toBe(event1);
      expect(model!.previousEvent).toBeNull();
      expect(model!.nextEvent).toBe(event2);
    });
    
    it('should build model for last event (no next)', () => {
      const event1 = createTestEvent(36, 0.0, 0, 0);
      const event2 = createTestEvent(38, 0.1, 0, 1);
      
      const input: OnionSkinInput = {
        events: [event1, event2],
        transitions: [createTestTransition(0, 1, event1, event2)],
      };
      
      const model = buildOnionSkinModel(input, 1);
      
      expect(model).not.toBeNull();
      expect(model!.currentEventIndex).toBe(1);
      expect(model!.currentEvent).toBe(event2);
      expect(model!.previousEvent).toBe(event1);
      expect(model!.nextEvent).toBeNull();
    });
    
    it('should build model for middle event (both previous and next)', () => {
      const event1 = createTestEvent(36, 0.0, 0, 0);
      const event2 = createTestEvent(38, 0.1, 0, 1);
      const event3 = createTestEvent(40, 0.2, 0, 2);
      
      const input: OnionSkinInput = {
        events: [event1, event2, event3],
        transitions: [
          createTestTransition(0, 1, event1, event2),
          createTestTransition(1, 2, event2, event3),
        ],
      };
      
      const model = buildOnionSkinModel(input, 1);
      
      expect(model).not.toBeNull();
      expect(model!.currentEventIndex).toBe(1);
      expect(model!.currentEvent).toBe(event2);
      expect(model!.previousEvent).toBe(event1);
      expect(model!.nextEvent).toBe(event3);
    });
    
    it('should compute pad sets correctly for different pads', () => {
      const event1 = createTestEvent(36, 0.0, 0, 0); // Pad "0,0"
      const event2 = createTestEvent(38, 0.1, 0, 1); // Pad "0,1"
      
      const input: OnionSkinInput = {
        events: [event1, event2],
        transitions: [createTestTransition(0, 1, event1, event2)],
      };
      
      const model = buildOnionSkinModel(input, 0);
      
      expect(model).not.toBeNull();
      // Current pad is "0,0", next pad is "0,1" - no shared pads
      expect(model!.sharedPads).toHaveLength(0);
      expect(model!.currentOnlyPads).toContain('0,0');
      expect(model!.nextOnlyPads).toContain('0,1');
    });
    
    it('should compute pad sets correctly for same pad (hold)', () => {
      const event1 = createTestEvent(36, 0.0, 0, 0); // Pad "0,0"
      const event2 = createTestEvent(36, 0.1, 0, 0); // Same pad "0,0"
      
      const input: OnionSkinInput = {
        events: [event1, event2],
        transitions: [createTestTransition(0, 1, event1, event2)],
      };
      
      const model = buildOnionSkinModel(input, 0);
      
      expect(model).not.toBeNull();
      // Same pad - should be shared
      expect(model!.sharedPads).toContain('0,0');
      expect(model!.currentOnlyPads).toHaveLength(0);
      expect(model!.nextOnlyPads).toHaveLength(0);
    });
    
    it('should create finger move for hold (same pad, same finger)', () => {
      const event1 = createTestEvent(36, 0.0, 0, 0, 'left', 'index');
      const event2 = createTestEvent(36, 0.1, 0, 0, 'left', 'index'); // Same pad, same finger
      
      const input: OnionSkinInput = {
        events: [event1, event2],
        transitions: [createTestTransition(0, 1, event1, event2)],
      };
      
      const model = buildOnionSkinModel(input, 0);
      
      expect(model).not.toBeNull();
      expect(model!.fingerMoves).toHaveLength(1);
      
      const move = model!.fingerMoves[0];
      expect(move.finger).toBe('index');
      expect(move.hand).toBe('left');
      expect(move.fromPad).toBe('0,0');
      expect(move.toPad).toBe('0,0');
      expect(move.isHold).toBe(true);
      expect(move.isImpossible).toBe(false);
    });
    
    it('should create finger move for movement (different pad, same finger)', () => {
      const event1 = createTestEvent(36, 0.0, 0, 0, 'left', 'index');
      const event2 = createTestEvent(38, 0.1, 0, 1, 'left', 'index'); // Different pad, same finger
      
      const input: OnionSkinInput = {
        events: [event1, event2],
        transitions: [createTestTransition(0, 1, event1, event2)],
      };
      
      const model = buildOnionSkinModel(input, 0);
      
      expect(model).not.toBeNull();
      expect(model!.fingerMoves).toHaveLength(1);
      
      const move = model!.fingerMoves[0];
      expect(move.finger).toBe('index');
      expect(move.hand).toBe('left');
      expect(move.fromPad).toBe('0,0');
      expect(move.toPad).toBe('0,1');
      expect(move.isHold).toBe(false);
      expect(move.rawDistance).toBeCloseTo(1.0, 2);
      expect(move.isImpossible).toBe(false); // Distance 1.0 < MAX_REACH (4.0)
    });
    
    it('should mark impossible moves for large distances', () => {
      const event1 = createTestEvent(36, 0.0, 0, 0, 'left', 'index');
      const event2 = createTestEvent(60, 0.1, 7, 7, 'left', 'index'); // Far corner
      
      const input: OnionSkinInput = {
        events: [event1, event2],
        transitions: [createTestTransition(0, 1, event1, event2)],
      };
      
      const model = buildOnionSkinModel(input, 0);
      
      expect(model).not.toBeNull();
      expect(model!.fingerMoves).toHaveLength(1);
      
      const move = model!.fingerMoves[0];
      expect(move.isImpossible).toBe(true); // Distance ~9.9 > MAX_REACH (4.0)
      expect(move.rawDistance).toBeGreaterThan(4.0);
    });
    
    it('should handle finger change (same hand, different finger)', () => {
      const event1 = createTestEvent(36, 0.0, 0, 0, 'left', 'index');
      const event2 = createTestEvent(38, 0.1, 0, 1, 'left', 'middle'); // Same hand, different finger
      
      const input: OnionSkinInput = {
        events: [event1, event2],
        transitions: [createTestTransition(0, 1, event1, event2)],
      };
      
      const model = buildOnionSkinModel(input, 0);
      
      expect(model).not.toBeNull();
      expect(model!.fingerMoves).toHaveLength(1);
      
      const move = model!.fingerMoves[0];
      // Should track the new finger (middle)
      expect(move.finger).toBe('middle');
      expect(move.hand).toBe('left');
      expect(move.fromPad).toBeNull(); // Previous finger was different
      expect(move.toPad).toBe('0,1');
      expect(move.isHold).toBe(false);
    });
    
    it('should handle hand switch (different hand)', () => {
      const event1 = createTestEvent(36, 0.0, 0, 0, 'left', 'index');
      const event2 = createTestEvent(38, 0.1, 0, 5, 'right', 'index'); // Different hand
      
      const input: OnionSkinInput = {
        events: [event1, event2],
        transitions: [createTestTransition(0, 1, event1, event2)],
      };
      
      const model = buildOnionSkinModel(input, 0);
      
      expect(model).not.toBeNull();
      expect(model!.fingerMoves).toHaveLength(1);
      
      const move = model!.fingerMoves[0];
      // Should track the new hand's finger
      expect(move.finger).toBe('index');
      expect(move.hand).toBe('right');
      expect(move.fromPad).toBeNull(); // Finger wasn't on right hand before
      expect(move.toPad).toBe('0,5');
      expect(move.isHold).toBe(false);
    });
    
    it('should handle last event with previous event but no next', () => {
      const event1 = createTestEvent(36, 0.0, 0, 0, 'left', 'index');
      const event2 = createTestEvent(38, 0.1, 0, 1, 'left', 'index');
      
      const input: OnionSkinInput = {
        events: [event1, event2],
        transitions: [createTestTransition(0, 1, event1, event2)],
      };
      
      const model = buildOnionSkinModel(input, 1); // Last event
      
      expect(model).not.toBeNull();
      expect(model!.currentEventIndex).toBe(1);
      expect(model!.currentEvent).toBe(event2);
      expect(model!.previousEvent).toBe(event1);
      expect(model!.nextEvent).toBeNull();
      
      // No next event, so no finger moves
      expect(model!.fingerMoves).toHaveLength(0);
      
      // Pad sets should only have current pad
      expect(model!.currentOnlyPads).toContain('0,1');
      expect(model!.nextOnlyPads).toHaveLength(0);
      expect(model!.sharedPads).toHaveLength(0);
    });
    
    it('should handle unplayable events', () => {
      const event1 = createTestEvent(36, 0.0, 0, 0, 'left', 'index');
      const event2: AnalyzedEvent = {
        noteNumber: 99,
        startTime: 0.1,
        assignedHand: 'Unplayable',
        finger: null,
        cost: Infinity,
        difficulty: 'Unplayable',
        anatomicalStretchScore: 1.0,
        compositeDifficultyScore: 1.0,
      };
      
      const input: OnionSkinInput = {
        events: [event1, event2],
        transitions: [createTestTransition(0, 1, event1, event2)],
      };
      
      const model = buildOnionSkinModel(input, 0);
      
      expect(model).not.toBeNull();
      // Unplayable events don't create finger moves
      expect(model!.fingerMoves).toHaveLength(0);
    });
  });
});

