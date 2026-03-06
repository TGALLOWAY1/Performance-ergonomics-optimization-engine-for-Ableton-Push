/**
 * Optimizer Coverage Tests
 *
 * Verifies that AnnealingSolver rejects unmapped candidates and fails early
 * when initial mapping is incomplete.
 */

import { describe, it, expect } from 'vitest';
import { createAnnealingSolver } from '../solvers/AnnealingSolver';
import { Performance, EngineConfiguration } from '../../types/performance';
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

const ENGINE_CONFIG: EngineConfiguration = {
  beamWidth: 5,
  stiffness: 0.3,
  restingPose: {
    left: {
      centroid: { x: 2, y: 2 },
      fingers: {},
    },
    right: {
      centroid: { x: 5, y: 2 },
      fingers: {},
    },
  },
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

describe('optimizer coverage', () => {
  it('should reject unmapped candidate in strict mode (evaluateMappingCost returns Infinity)', async () => {
    const perf: Performance = {
      events: [
        { noteNumber: 36, startTime: 0 },
        { noteNumber: 38, startTime: 0.5 },
        { noteNumber: 40, startTime: 1 },
      ],
    };
    // Mapping only has 36 and 38 - 40 is unmapped
    const incompleteMapping: GridMapping = {
      id: 'm1',
      name: 'Incomplete',
      cells: {
        '0,0': createVoice(36, 'Kick'),
        '0,1': createVoice(38, 'Snare'),
      },
      fingerConstraints: {},
      scoreCache: null,
      notes: '',
    };

    const solver = createAnnealingSolver({
      instrumentConfig: DEFAULT_CONFIG,
      gridMapping: incompleteMapping,
    });

    // The solver should throw because initial mapping doesn't cover 40
    await expect(solver.solve(perf, ENGINE_CONFIG)).rejects.toThrow(
      /does not cover all sounds|Seed the mapping/
    );
  });

  it('should fail early when initial mapping has unmapped notes', async () => {
    const perf: Performance = {
      events: [
        { noteNumber: 36, startTime: 0 },
        { noteNumber: 50, startTime: 0.5 },
      ],
    };
    const mapping: GridMapping = {
      id: 'm1',
      name: 'Partial',
      cells: { '0,0': createVoice(36, 'Kick') },
      fingerConstraints: {},
      scoreCache: null,
      notes: '',
    };

    const solver = createAnnealingSolver({
      instrumentConfig: DEFAULT_CONFIG,
      gridMapping: mapping,
    });

    await expect(solver.solve(perf, ENGINE_CONFIG)).rejects.toThrow(
      /does not cover all sounds|Seed the mapping/
    );
  });
});
