/**
 * Mapping Resolver - Single source of truth for note-to-pad resolution.
 *
 * Provides O(1) lookup via precomputed index. No iteration over cells per event.
 * Supports strict mode (no fallback) for optimization and allow-fallback for previews.
 */

import { GridMapping, Voice, parseCellKey } from '../types/layout';
import { InstrumentConfig } from '../types/performance';
import { GridMapService } from './gridMapService';

// ============================================================================
// Types
// ============================================================================

export interface PadCoord {
  row: number;
  col: number;
}

export type MappingResolution =
  | { source: 'mapping'; pad: PadCoord }
  | { source: 'unmapped' }
  | { source: 'fallback'; pad: PadCoord };

// ============================================================================
// Index Building (O(cells) once, O(1) per lookup)
// ============================================================================

/**
 * Builds a reverse index from noteNumber to pad coordinates.
 * Call once per mapping/solver run. Lookups are O(1).
 *
 * @param cells - Record of pad key -> Voice
 * @returns Map of noteNumber -> PadCoord (only voices with valid originalMidiNote)
 */
export function buildNoteToPadIndex(cells: Record<string, Voice>): Map<number, PadCoord> {
  const index = new Map<number, PadCoord>();

  for (const [key, voice] of Object.entries(cells)) {
    const note = voice.originalMidiNote;
    if (note === null || note === undefined) continue;

    const coord = parseCellKey(key);
    if (coord) {
      index.set(note, coord);
    }
  }

  return index;
}

// ============================================================================
// Resolution
// ============================================================================

/**
 * Resolves a note number to a pad using the precomputed index.
 *
 * @param noteNumber - MIDI note number to resolve
 * @param index - Precomputed note->pad index from buildNoteToPadIndex
 * @param instrumentConfig - Instrument config for fallback (noteToGrid)
 * @param mode - 'strict': unmapped returns unmapped; 'allow-fallback': use noteToGrid
 */
export function resolveNoteToPad(
  noteNumber: number,
  index: Map<number, PadCoord>,
  instrumentConfig: InstrumentConfig,
  mode: 'strict' | 'allow-fallback'
): MappingResolution {
  const fromMapping = index.get(noteNumber);
  if (fromMapping) {
    return { source: 'mapping', pad: fromMapping };
  }

  if (mode === 'allow-fallback') {
    const tuple = GridMapService.noteToGrid(noteNumber, instrumentConfig);
    if (tuple) {
      return { source: 'fallback', pad: { row: tuple[0], col: tuple[1] } };
    }
  }

  return { source: 'unmapped' };
}

// ============================================================================
// Hash Utility (for debug identity)
// ============================================================================

/**
 * Produces a stable hash of a GridMapping for debug identity.
 * Sorts cell keys for deterministic output.
 */
export function hashGridMapping(gridMapping: GridMapping): string {
  const keys = Object.keys(gridMapping.cells).sort();
  const entries = keys.map((k) => [k, gridMapping.cells[k]?.originalMidiNote ?? null]);
  return JSON.stringify(entries);
}
