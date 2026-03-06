/**
 * Mapping Coverage - Computes how well a mapping covers performance notes.
 *
 * Coverage is keyed by noteNumber only (channel ignored for this iteration).
 * Resolver and coverage use the same identity.
 */

import { GridMapping } from '../types/layout';
import { Performance } from '../types/performance';
import { buildNoteToPadIndex } from './mappingResolver';

// ============================================================================
// Note Set
// ============================================================================

/**
 * Returns the set of unique note numbers used in the performance.
 * Identity: noteNumber only (channel ignored).
 */
export function getPerformanceNoteSet(performance: Performance): Set<number> {
  const set = new Set<number>();
  for (const event of performance.events) {
    set.add(event.noteNumber);
  }
  return set;
}

// ============================================================================
// Coverage
// ============================================================================

export interface MappingCoverageResult {
  /** Number of unique note numbers that are mapped */
  mappedNotes: number;
  /** Total unique note numbers in performance */
  totalNotes: number;
  /** Note numbers that are not in the mapping */
  unmappedNotes: number[];
  /** Number of events that land on mapped pads */
  mappedEventCount: number;
  /** Total event count */
  totalEventCount: number;
}

/**
 * Computes how well a mapping covers the notes used in a performance.
 *
 * @param performance - The performance to check
 * @param gridMapping - The mapping to evaluate
 * @returns Coverage stats including unmapped note list
 */
export function computeMappingCoverage(
  performance: Performance,
  gridMapping: GridMapping
): MappingCoverageResult {
  const requiredNotes = getPerformanceNoteSet(performance);
  const index = buildNoteToPadIndex(gridMapping.cells);

  const unmappedNotes: number[] = [];
  let mappedNotes = 0;

  for (const note of requiredNotes) {
    if (index.has(note)) {
      mappedNotes++;
    } else {
      unmappedNotes.push(note);
    }
  }

  // Event-level: count events that resolve to a mapped pad
  let mappedEventCount = 0;
  for (const event of performance.events) {
    if (index.has(event.noteNumber)) {
      mappedEventCount++;
    }
  }

  unmappedNotes.sort((a, b) => a - b);

  return {
    mappedNotes,
    totalNotes: requiredNotes.size,
    unmappedNotes,
    mappedEventCount,
    totalEventCount: performance.events.length,
  };
}
