/**
 * Mapping Coverage Tests
 *
 * Verifies coverage computation and unmapped note detection.
 */

import { describe, it, expect } from 'vitest';
import {
  getPerformanceNoteSet,
  computeMappingCoverage,
} from '../mappingCoverage';
import { GridMapping, Voice } from '../../types/layout';
import { Performance } from '../../types/performance';

function createVoice(note: number, name: string): Voice {
  return {
    id: `v-${note}`,
    name,
    sourceType: 'midi_track',
    sourceFile: 'test',
    originalMidiNote: note,
    color: '#000',
  };
}

describe('mappingCoverage', () => {
  describe('getPerformanceNoteSet', () => {
    it('should return unique note numbers', () => {
      const perf: Performance = {
        events: [
          { noteNumber: 36, startTime: 0 },
          { noteNumber: 36, startTime: 0.5 },
          { noteNumber: 38, startTime: 1 },
        ],
      };
      const set = getPerformanceNoteSet(perf);
      expect(set.size).toBe(2);
      expect(set.has(36)).toBe(true);
      expect(set.has(38)).toBe(true);
    });

    it('should return empty set for empty performance', () => {
      const set = getPerformanceNoteSet({ events: [] });
      expect(set.size).toBe(0);
    });
  });

  describe('computeMappingCoverage', () => {
    it('should detect full coverage', () => {
      const perf: Performance = {
        events: [
          { noteNumber: 36, startTime: 0 },
          { noteNumber: 38, startTime: 0.5 },
        ],
      };
      const mapping: GridMapping = {
        id: 'm1',
        name: 'Test',
        cells: {
          '0,0': createVoice(36, 'Kick'),
          '0,1': createVoice(38, 'Snare'),
        },
        fingerConstraints: {},
        scoreCache: null,
        notes: '',
      };
      const cov = computeMappingCoverage(perf, mapping);
      expect(cov.mappedNotes).toBe(2);
      expect(cov.totalNotes).toBe(2);
      expect(cov.unmappedNotes).toEqual([]);
      expect(cov.mappedEventCount).toBe(2);
      expect(cov.totalEventCount).toBe(2);
    });

    it('should detect unmapped notes', () => {
      const perf: Performance = {
        events: [
          { noteNumber: 36, startTime: 0 },
          { noteNumber: 38, startTime: 0.5 },
          { noteNumber: 40, startTime: 1 },
        ],
      };
      const mapping: GridMapping = {
        id: 'm1',
        name: 'Test',
        cells: {
          '0,0': createVoice(36, 'Kick'),
          '0,1': createVoice(38, 'Snare'),
        },
        fingerConstraints: {},
        scoreCache: null,
        notes: '',
      };
      const cov = computeMappingCoverage(perf, mapping);
      expect(cov.mappedNotes).toBe(2);
      expect(cov.totalNotes).toBe(3);
      expect(cov.unmappedNotes).toEqual([40]);
      expect(cov.mappedEventCount).toBe(2);
      expect(cov.totalEventCount).toBe(3);
    });

    it('should handle empty mapping', () => {
      const perf: Performance = {
        events: [{ noteNumber: 36, startTime: 0 }],
      };
      const mapping: GridMapping = {
        id: 'm1',
        name: 'Empty',
        cells: {},
        fingerConstraints: {},
        scoreCache: null,
        notes: '',
      };
      const cov = computeMappingCoverage(perf, mapping);
      expect(cov.mappedNotes).toBe(0);
      expect(cov.totalNotes).toBe(1);
      expect(cov.unmappedNotes).toEqual([36]);
    });
  });
});
