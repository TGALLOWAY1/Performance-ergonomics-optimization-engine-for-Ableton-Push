/**
 * Unit tests for Event Metrics Calculation Engine
 * 
 * Tests verify that:
 * - Adjacent pads → low anatomical stretch score
 * - Large jumps → higher stretch score
 * - Composite difficulty reflects higher scores for "worse" events
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeEvents,
  computeEventAnatomicalStretchScore,
  computeCompositeDifficultyScore,
  getPadForDebugEvent,
  computeRawDistance,
  createDefaultAnatomicalStretchTable,
} from '../eventMetrics';
import type { EngineResult, EngineDebugEvent } from '../core';
import type { AnalyzedEvent } from '../../types/eventAnalysis';

describe('eventMetrics', () => {
  describe('getPadForDebugEvent', () => {
    it('should return pad key for event with row and col', () => {
      const event: EngineDebugEvent = {
        noteNumber: 36,
        startTime: 0.0,
        assignedHand: 'left',
        finger: 'index',
        cost: 2.0,
        difficulty: 'Easy',
        row: 0,
        col: 1,
      };
      
      const padKey = getPadForDebugEvent(event);
      expect(padKey).toBe('0,1');
    });
    
    it('should return null for event without position', () => {
      const event: EngineDebugEvent = {
        noteNumber: 36,
        startTime: 0.0,
        assignedHand: 'left',
        finger: 'index',
        cost: 2.0,
        difficulty: 'Easy',
      };
      
      const padKey = getPadForDebugEvent(event);
      expect(padKey).toBeNull();
    });
  });
  
  describe('computeRawDistance', () => {
    it('should calculate distance between adjacent pads', () => {
      const distance = computeRawDistance('0,0', '0,1');
      expect(distance).toBeCloseTo(1.0, 2);
    });
    
    it('should calculate distance for diagonal movement', () => {
      const distance = computeRawDistance('0,0', '1,1');
      expect(distance).toBeCloseTo(Math.sqrt(2), 2); // ~1.414
    });
    
    it('should return Infinity for invalid pad keys', () => {
      const distance = computeRawDistance('invalid', '0,1');
      expect(distance).toBe(Infinity);
    });
  });
  
  describe('computeEventAnatomicalStretchScore', () => {
    it('should return low stretch score for event near home position', () => {
      const event: EngineDebugEvent = {
        noteNumber: 36,
        startTime: 0.0,
        assignedHand: 'left',
        finger: 'index',
        cost: 1.0,
        difficulty: 'Easy',
        row: 0,
        col: 1, // Left hand home position
      };
      
      const stretchScore = computeEventAnatomicalStretchScore(event);
      expect(stretchScore).toBeLessThan(0.3); // Should be low (near home)
    });
    
    it('should return higher stretch score for event far from home', () => {
      const event: EngineDebugEvent = {
        noteNumber: 60,
        startTime: 0.0,
        assignedHand: 'left',
        finger: 'pinky',
        cost: 15.0,
        difficulty: 'Hard',
        row: 7,
        col: 7, // Far from left hand home (0,1)
      };
      
      const stretchScore = computeEventAnatomicalStretchScore(event);
      expect(stretchScore).toBeGreaterThan(0.5); // Should be higher (far from home)
    });
    
    it('should use costBreakdown.stretch if available', () => {
      const event: EngineDebugEvent = {
        noteNumber: 36,
        startTime: 0.0,
        assignedHand: 'left',
        finger: 'index',
        cost: 10.0,
        costBreakdown: {
          movement: 2.0,
          stretch: 8.0, // High stretch penalty
          drift: 1.0,
          bounce: 0.0,
          fatigue: 0.5,
          crossover: 0.0,
          total: 10.0,
        },
        difficulty: 'Hard',
        row: 3,
        col: 3,
      };
      
      const stretchScore = computeEventAnatomicalStretchScore(event);
      // Should normalize 8.0 / 10.0 = 0.8
      expect(stretchScore).toBeCloseTo(0.8, 1);
    });
    
    it('should return 1.0 for unplayable events', () => {
      const event: EngineDebugEvent = {
        noteNumber: 36,
        startTime: 0.0,
        assignedHand: 'Unplayable',
        finger: null,
        cost: Infinity,
        difficulty: 'Unplayable',
      };
      
      const stretchScore = computeEventAnatomicalStretchScore(event);
      expect(stretchScore).toBe(1.0);
    });
  });
  
  describe('computeCompositeDifficultyScore', () => {
    it('should return 1.0 for unplayable events', () => {
      const event: EngineDebugEvent = {
        noteNumber: 36,
        startTime: 0.0,
        assignedHand: 'Unplayable',
        finger: null,
        cost: Infinity,
        difficulty: 'Unplayable',
      };
      
      const score = computeCompositeDifficultyScore(event, 0.5);
      expect(score).toBe(1.0);
    });
    
    it('should return low score for easy events', () => {
      const event: EngineDebugEvent = {
        noteNumber: 36,
        startTime: 0.0,
        assignedHand: 'left',
        finger: 'index',
        cost: 1.0,
        difficulty: 'Easy',
        row: 0,
        col: 1,
      };
      
      const score = computeCompositeDifficultyScore(event, 0.1); // Low stretch
      expect(score).toBeLessThan(0.3);
    });
    
    it('should return higher score for hard events', () => {
      const event: EngineDebugEvent = {
        noteNumber: 60,
        startTime: 0.0,
        assignedHand: 'left',
        finger: 'pinky',
        cost: 15.0,
        costBreakdown: {
          movement: 5.0,
          stretch: 6.0,
          drift: 2.0,
          bounce: 1.0,
          fatigue: 1.0,
          crossover: 0.0,
          total: 15.0,
        },
        difficulty: 'Hard',
        row: 7,
        col: 7,
      };
      
      const score = computeCompositeDifficultyScore(event, 0.8); // High stretch
      expect(score).toBeGreaterThan(0.7);
    });
    
    it('should increase score with higher cost', () => {
      const easyEvent: EngineDebugEvent = {
        noteNumber: 36,
        startTime: 0.0,
        assignedHand: 'left',
        finger: 'index',
        cost: 2.0,
        difficulty: 'Easy',
        row: 0,
        col: 1,
      };
      
      const expensiveEvent: EngineDebugEvent = {
        noteNumber: 36,
        startTime: 0.0,
        assignedHand: 'left',
        finger: 'index',
        cost: 12.0,
        difficulty: 'Easy',
        row: 0,
        col: 1,
      };
      
      const easyScore = computeCompositeDifficultyScore(easyEvent, 0.1);
      const expensiveScore = computeCompositeDifficultyScore(expensiveEvent, 0.1);
      
      expect(expensiveScore).toBeGreaterThan(easyScore);
    });
  });
  
  describe('analyzeEvents', () => {
    it('should convert EngineDebugEvent[] to AnalyzedEvent[]', () => {
      const engineResult: EngineResult = {
        score: 80,
        unplayableCount: 0,
        hardCount: 1,
        debugEvents: [
          {
            noteNumber: 36,
            startTime: 0.0,
            assignedHand: 'left',
            finger: 'index',
            cost: 2.0,
            difficulty: 'Easy',
            row: 0,
            col: 1,
          },
          {
            noteNumber: 38,
            startTime: 0.5,
            assignedHand: 'left',
            finger: 'middle',
            cost: 3.0,
            difficulty: 'Medium',
            row: 0,
            col: 2,
          },
        ],
        fingerUsageStats: {},
        fatigueMap: {},
        averageDrift: 0.0,
        averageMetrics: {
          movement: 0,
          stretch: 0,
          drift: 0,
          bounce: 0,
          fatigue: 0,
          crossover: 0,
          total: 0,
        },
      };
      
      const analyzedEvents = analyzeEvents(engineResult);
      
      expect(analyzedEvents).toHaveLength(2);
      expect(analyzedEvents[0]).toHaveProperty('anatomicalStretchScore');
      expect(analyzedEvents[0]).toHaveProperty('compositeDifficultyScore');
      expect(analyzedEvents[0].anatomicalStretchScore).toBeGreaterThanOrEqual(0);
      expect(analyzedEvents[0].anatomicalStretchScore).toBeLessThanOrEqual(1);
      expect(analyzedEvents[0].compositeDifficultyScore).toBeGreaterThanOrEqual(0);
      expect(analyzedEvents[0].compositeDifficultyScore).toBeLessThanOrEqual(1);
    });
    
    it('should handle events with different difficulty levels', () => {
      const engineResult: EngineResult = {
        score: 50,
        unplayableCount: 1,
        hardCount: 1,
        debugEvents: [
          {
            noteNumber: 36,
            startTime: 0.0,
            assignedHand: 'left',
            finger: 'index',
            cost: 1.0,
            difficulty: 'Easy',
            row: 0,
            col: 1,
          },
          {
            noteNumber: 60,
            startTime: 1.0,
            assignedHand: 'left',
            finger: 'pinky',
            cost: 15.0,
            difficulty: 'Hard',
            row: 7,
            col: 7,
          },
          {
            noteNumber: 99,
            startTime: 2.0,
            assignedHand: 'Unplayable',
            finger: null,
            cost: Infinity,
            difficulty: 'Unplayable',
          },
        ],
        fingerUsageStats: {},
        fatigueMap: {},
        averageDrift: 0.0,
        averageMetrics: {
          movement: 0,
          stretch: 0,
          drift: 0,
          bounce: 0,
          fatigue: 0,
          crossover: 0,
          total: 0,
        },
      };
      
      const analyzedEvents = analyzeEvents(engineResult);
      
      // Easy event should have lower composite difficulty
      expect(analyzedEvents[0].compositeDifficultyScore).toBeLessThan(0.3);
      
      // Hard event should have higher composite difficulty
      expect(analyzedEvents[1].compositeDifficultyScore).toBeGreaterThan(0.7);
      
      // Unplayable event should have maximum difficulty
      expect(analyzedEvents[2].compositeDifficultyScore).toBe(1.0);
    });
  });
  
  describe('createDefaultAnatomicalStretchTable', () => {
    it('should create a table with expected finger pairs', () => {
      const table = createDefaultAnatomicalStretchTable();
      
      expect(table['L_INDEX-L_MIDDLE']).toBe(0.8);
      expect(table['L_RING-L_PINKY']).toBe(1.8);
      expect(table['R_THUMB-R_INDEX']).toBe(0.5);
      expect(table['R_MIDDLE-R_PINKY']).toBe(2.0);
    });
    
    it('should have symmetric values for left and right hands', () => {
      const table = createDefaultAnatomicalStretchTable();
      
      expect(table['L_INDEX-L_MIDDLE']).toBe(table['R_INDEX-R_MIDDLE']);
      expect(table['L_RING-L_PINKY']).toBe(table['R_RING-R_PINKY']);
    });
  });
});

