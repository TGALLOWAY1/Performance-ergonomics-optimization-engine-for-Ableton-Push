/**
 * Mapping Resolver Tests
 *
 * Verifies strict mode, fallback behavior, and index building.
 */

import { describe, it, expect } from 'vitest';
import {
  buildNoteToPadIndex,
  resolveNoteToPad,
  hashGridMapping,
} from '../mappingResolver';
import { GridMapping, Voice } from '../../types/layout';
import { InstrumentConfig } from '../../types/performance';

const DEFAULT_CONFIG: InstrumentConfig = {
  id: 'test',
  name: 'Test',
  rows: 8,
  cols: 8,
  bottomLeftNote: 36,
  layoutMode: 'drum_64',
};

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

describe('mappingResolver', () => {
  describe('buildNoteToPadIndex', () => {
    it('should build index from cells', () => {
      const cells: Record<string, Voice> = {
        '0,0': createVoice(36, 'Kick'),
        '0,1': createVoice(38, 'Snare'),
      };
      const index = buildNoteToPadIndex(cells);
      expect(index.size).toBe(2);
      expect(index.get(36)).toEqual({ row: 0, col: 0 });
      expect(index.get(38)).toEqual({ row: 0, col: 1 });
    });

    it('should skip voices with null originalMidiNote', () => {
      const cells: Record<string, Voice> = {
        '0,0': { ...createVoice(36, 'Kick'), originalMidiNote: null },
      };
      const index = buildNoteToPadIndex(cells);
      expect(index.size).toBe(0);
    });

    it('should return empty map for empty cells', () => {
      const index = buildNoteToPadIndex({});
      expect(index.size).toBe(0);
    });
  });

  describe('resolveNoteToPad', () => {
    it('strict mode: mapped note returns mapping source', () => {
      const index = buildNoteToPadIndex({ '1,2': createVoice(44, 'Hat') });
      const res = resolveNoteToPad(44, index, DEFAULT_CONFIG, 'strict');
      expect(res.source).toBe('mapping');
      expect(res.source !== 'unmapped' && 'pad' in res && res.pad).toEqual({
        row: 1,
        col: 2,
      });
    });

    it('strict mode: unmapped note returns unmapped', () => {
      const index = buildNoteToPadIndex({});
      const res = resolveNoteToPad(36, index, DEFAULT_CONFIG, 'strict');
      expect(res.source).toBe('unmapped');
    });

    it('strict mode: note not in mapping returns unmapped even if in grid', () => {
      const index = buildNoteToPadIndex({ '0,0': createVoice(36, 'Kick') });
      const res = resolveNoteToPad(37, index, DEFAULT_CONFIG, 'strict');
      expect(res.source).toBe('unmapped');
    });

    it('allow-fallback: unmapped note uses noteToGrid', () => {
      const index = buildNoteToPadIndex({});
      const res = resolveNoteToPad(36, index, DEFAULT_CONFIG, 'allow-fallback');
      expect(res.source).toBe('fallback');
      expect(res.source !== 'unmapped' && 'pad' in res && res.pad).toEqual({
        row: 0,
        col: 0,
      });
    });

    it('allow-fallback: note outside grid returns unmapped', () => {
      const index = buildNoteToPadIndex({});
      const res = resolveNoteToPad(200, index, DEFAULT_CONFIG, 'allow-fallback');
      expect(res.source).toBe('unmapped');
    });
  });

  describe('hashGridMapping', () => {
    it('should produce stable hash for same mapping', () => {
      const mapping: GridMapping = {
        id: 'm1',
        name: 'Test',
        cells: { '0,0': createVoice(36, 'Kick'), '0,1': createVoice(38, 'Snare') },
        fingerConstraints: {},
        scoreCache: null,
        notes: '',
      };
      const h1 = hashGridMapping(mapping);
      const h2 = hashGridMapping(mapping);
      expect(h1).toBe(h2);
    });

    it('should produce different hash for different cells', () => {
      const m1: GridMapping = {
        id: 'm1',
        name: 'Test',
        cells: { '0,0': createVoice(36, 'Kick') },
        fingerConstraints: {},
        scoreCache: null,
        notes: '',
      };
      const m2: GridMapping = {
        ...m1,
        cells: { '0,0': createVoice(38, 'Snare') },
      };
      expect(hashGridMapping(m1)).not.toBe(hashGridMapping(m2));
    });
  });
});
