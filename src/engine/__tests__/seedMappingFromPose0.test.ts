/**
 * Seed Mapping from Pose0 Tests
 */

import { describe, it, expect } from 'vitest';
import { seedMappingFromPose0 } from '../seedMappingFromPose0';
import { createDefaultPose0 } from '../../types/naturalHandPose';
import { computeMappingCoverage } from '../mappingCoverage';
import { Performance } from '../../types/performance';
import { InstrumentConfig } from '../../types/performance';

const DEFAULT_CONFIG: InstrumentConfig = {
  id: 'test',
  name: 'Test',
  rows: 8,
  cols: 8,
  bottomLeftNote: 36,
  layoutMode: 'drum_64',
};

describe('seedMappingFromPose0', () => {
  it('should produce full coverage for performance notes', () => {
    const perf: Performance = {
      events: [
        { noteNumber: 36, startTime: 0 },
        { noteNumber: 38, startTime: 0.5 },
        { noteNumber: 40, startTime: 1 },
      ],
    };
    const pose0 = createDefaultPose0();
    const mapping = seedMappingFromPose0(perf, pose0, DEFAULT_CONFIG, 0);
    const coverage = computeMappingCoverage(perf, mapping);
    expect(coverage.unmappedNotes).toEqual([]);
    expect(coverage.mappedNotes).toBe(3);
    expect(coverage.totalNotes).toBe(3);
  });

  it('should be deterministic (same inputs same output)', () => {
    const perf: Performance = {
      events: [
        { noteNumber: 36, startTime: 0 },
        { noteNumber: 38, startTime: 0.5 },
      ],
    };
    const pose0 = createDefaultPose0();
    const m1 = seedMappingFromPose0(perf, pose0, DEFAULT_CONFIG, 0);
    const m2 = seedMappingFromPose0(perf, pose0, DEFAULT_CONFIG, 0);
    expect(Object.keys(m1.cells).sort()).toEqual(Object.keys(m2.cells).sort());
    for (const key of Object.keys(m1.cells)) {
      expect(m1.cells[key].originalMidiNote).toBe(m2.cells[key].originalMidiNote);
    }
  });

  it('should assign voices to cells', () => {
    const perf: Performance = { events: [{ noteNumber: 36, startTime: 0 }] };
    const pose0 = createDefaultPose0();
    const mapping = seedMappingFromPose0(perf, pose0, DEFAULT_CONFIG, 0);
    expect(Object.keys(mapping.cells).length).toBe(1);
    const [key] = Object.keys(mapping.cells);
    expect(mapping.cells[key].originalMidiNote).toBe(36);
  });
});
