/**
 * Time Units Consistency Tests
 * 
 * Verifies that fixtures store time in seconds (canonical unit) and that
 * the solver interprets them correctly without additional tempo conversion.
 * 
 * This catches "seconds-vs-beats" mismatches silently.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  DEFAULT_TEST_CONFIG,
  runSolver,
  beatsToSeconds,
  assertPerformanceUnits,
} from './helpers/testHelpers';
import { loadPerformanceFixture } from './helpers/fixtureLoader';
import { Performance } from '../../types/performance';

describe('Time Units Consistency', () => {
  describe('F01 - 16ths at 140 BPM', () => {
    let performance: Performance;

    beforeAll(() => {
      performance = loadPerformanceFixture('F01');
    });

    it('should have valid time units (seconds, finite, non-negative)', () => {
      expect(() => assertPerformanceUnits(performance)).not.toThrow();
    });

    it('should have 16 events (1 bar of 16ths)', () => {
      expect(performance.events.length).toBe(16);
    });

    it('should have correct inter-onset interval for 16ths at 140 BPM', () => {
      const bpm = 140;
      const expectedIntervalBeats = 0.25;
      const expectedIntervalSeconds = beatsToSeconds(expectedIntervalBeats, bpm);
      
      for (let i = 1; i < performance.events.length; i++) {
        const actualInterval = performance.events[i].startTime - performance.events[i - 1].startTime;
        expect(actualInterval).toBeCloseTo(expectedIntervalSeconds, 6);
      }
    });

    it('should have correct total duration for 1 bar at 140 BPM', () => {
      const bpm = 140;
      const firstEvent = performance.events[0];
      const lastEvent = performance.events[performance.events.length - 1];
      
      const expectedBarDurationSeconds = beatsToSeconds(4, bpm);
      const actualSpan = lastEvent.startTime - firstEvent.startTime;
      const expectedSpanFor16Events = beatsToSeconds(15 * 0.25, bpm);
      
      expect(actualSpan).toBeCloseTo(expectedSpanFor16Events, 6);
    });

    it('should verify tempo is informational only (not used for conversion)', () => {
      expect(performance.tempo).toBe(140);
      
      const result = runSolver(performance);
      
      for (const debugEvent of result.debugEvents) {
        expect(debugEvent.startTime).toBeCloseTo(
          performance.events.find(e => e.eventKey === debugEvent.eventKey)?.startTime ?? debugEvent.startTime,
          6
        );
      }
    });
  });

  describe('Cross-fixture time unit verification', () => {
    const fixtureConfigs = [
      { id: 'F02', bpm: 120, noteDuration: 1, bars: 8, expectedEventCount: 32 },
      { id: 'F03', bpm: 120, noteDuration: 0.5, bars: 2, expectedEventCount: 16 },
      { id: 'I01', bpm: 120, noteDuration: 0.125, bars: 1, expectedEventCount: 32 },
    ];

    fixtureConfigs.forEach(({ id, bpm, noteDuration, expectedEventCount }) => {
      it(`${id} should have correct inter-onset intervals`, () => {
        const performance = loadPerformanceFixture(id);
        assertPerformanceUnits(performance);
        
        expect(performance.events.length).toBe(expectedEventCount);
        
        if (performance.events.length > 1) {
          const firstInterval = performance.events[1].startTime - performance.events[0].startTime;
          const expectedInterval = beatsToSeconds(noteDuration, bpm);
          expect(firstInterval).toBeCloseTo(expectedInterval, 5);
        }
      });
    });
  });

  describe('Solver does not re-interpret tempo', () => {
    it('should produce same debug event times as input events', () => {
      const performance = loadPerformanceFixture('F01');
      const result = runSolver(performance);
      
      for (const inputEvent of performance.events) {
        const debugEvent = result.debugEvents.find(
          d => d.eventKey === inputEvent.eventKey || d.startTime === inputEvent.startTime
        );
        
        expect(debugEvent).toBeDefined();
        if (debugEvent) {
          expect(debugEvent.startTime).toBeCloseTo(inputEvent.startTime, 6);
        }
      }
    });

    it('should handle different tempos without affecting startTime interpretation', () => {
      const performance80bpm = {
        name: 'Tempo80',
        tempo: 80,
        events: [
          { noteNumber: 36, startTime: 0.0, duration: 0.5, velocity: 100, eventKey: '0:0:36:1' },
          { noteNumber: 36, startTime: 0.75, duration: 0.5, velocity: 100, eventKey: '1:0.75:36:1' },
        ],
      };

      const performance160bpm = {
        name: 'Tempo160',
        tempo: 160,
        events: [
          { noteNumber: 36, startTime: 0.0, duration: 0.5, velocity: 100, eventKey: '0:0:36:1' },
          { noteNumber: 36, startTime: 0.75, duration: 0.5, velocity: 100, eventKey: '1:0.75:36:1' },
        ],
      };

      const result80 = runSolver(performance80bpm);
      const result160 = runSolver(performance160bpm);

      expect(result80.debugEvents[0].startTime).toBeCloseTo(0.0, 6);
      expect(result80.debugEvents[1].startTime).toBeCloseTo(0.75, 6);
      expect(result160.debugEvents[0].startTime).toBeCloseTo(0.0, 6);
      expect(result160.debugEvents[1].startTime).toBeCloseTo(0.75, 6);
    });
  });
});
