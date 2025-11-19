/**
 * Layout and mapping types for the Designer interface.
 */

/**
 * Represents a sound asset that can be assigned to grid cells.
 */
export interface SoundAsset {
  /** Unique identifier (UUID) */
  id: string;
  /** Display name for the asset */
  name: string;
  /** Source type: MIDI track or audio slice */
  sourceType: 'midi_track' | 'audio_slice';
  /** Path or reference to the source file */
  sourceFile: string;
  /** Original MIDI note number (critical for multi-note split logic) */
  originalMidiNote: number | null;
  /** Color for UI display (hex code or CSS color) */
  color: string;
}

/**
 * Represents a grid mapping configuration.
 * Maps grid cells (row,col) to sound assets and finger constraints.
 */
export interface GridMapping {
  /** Unique identifier */
  id: string;
  /** Display name for this mapping */
  name: string;
  /** Mapping of "row,col" keys to SoundAsset objects */
  cells: Record<string, SoundAsset>;
  /** Finger constraints for each cell, e.g., "L1", "R5" */
  fingerConstraints: Record<string, string>;
  /** Cached performability score */
  scoreCache: number | null;
  /** Notes or description for this mapping */
  notes: string;
}

/**
 * Helper function to create a cell key from row and column.
 * @param row - Row index (0-based)
 * @param col - Column index (0-based)
 * @returns String key in format "row,col"
 */
export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

/**
 * Helper function to parse a cell key back to row and column.
 * @param key - String key in format "row,col"
 * @returns Object with row and col numbers, or null if invalid
 */
export function parseCellKey(key: string): { row: number; col: number } | null {
  const parts = key.split(',');
  if (parts.length !== 2) return null;
  const row = parseInt(parts[0], 10);
  const col = parseInt(parts[1], 10);
  if (isNaN(row) || isNaN(col)) return null;
  return { row, col };
}

