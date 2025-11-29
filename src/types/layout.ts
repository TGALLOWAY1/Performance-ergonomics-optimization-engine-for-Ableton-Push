/**
 * Layout and mapping types for the Designer interface.
 * 
 * TERMINOLOGY (see TERMINOLOGY.md):
 * - Voice: A unique MIDI pitch (e.g., MIDI Note 36) - formerly 'sound' or 'track'
 * - Cell: A slot in the 128 Drum Rack (Index 0-127) - formerly 'note' or 'pitch'
 * - Pad: A specific x/y coordinate on the 8x8 grid
 * - Assignment: The mapping of a Voice/Cell to a Pad
 */

/**
 * Voice: A unique MIDI pitch that can be assigned to a Pad on the grid.
 * 
 * Represents a distinct sound source (formerly 'sound' or 'track').
 * The Voice's Cell (MIDI note number) determines which Drum Rack slot it occupies.
 */
export interface Voice {
  /** Unique identifier (UUID) */
  id: string;
  /** Display name for the Voice */
  name: string;
  /** Source type: MIDI track or audio slice */
  sourceType: 'midi_track' | 'audio_slice';
  /** Path or reference to the source file */
  sourceFile: string;
  /** Cell: The MIDI note number (0-127) representing the Drum Rack slot for this Voice */
  originalMidiNote: number | null;
  /** Color for UI display (hex code or CSS color) */
  color: string;
}

/**
 * @deprecated Use Voice instead. This alias is removed - use Voice directly.
 * Kept for reference only - do not use in new code.
 */
// export type SoundAsset = Voice; // REMOVED: Use Voice directly

/**
 * Layout origin mode - tracks how the layout was created/modified.
 * Used for UI display and to understand the layout's history.
 */
export type LayoutMode = 'manual' | 'optimized' | 'random' | 'none';

/**
 * GridMapping: Represents a grid mapping configuration.
 * 
 * Assignment: Maps Pads (x/y coordinates on the 8x8 grid) to Voices and finger constraints.
 * This defines which Voice (via its Cell) is assigned to which Pad.
 */
export interface GridMapping {
  /** Unique identifier */
  id: string;
  /** Display name for this mapping */
  name: string;
  /** Assignment: Mapping of Pad keys ("row,col") to Voice objects */
  cells: Record<string, Voice>;
  /** Finger constraints for each Pad, e.g., "L1", "R5" */
  fingerConstraints: Record<string, string>;
  /** Cached performability score */
  scoreCache: number | null;
  /** Notes or description for this mapping */
  notes: string;
  /** 
   * Layout origin mode - tracks how the layout was created/modified.
   * - 'none': Empty grid, no assignments
   * - 'manual': User manually dragged sounds to pads
   * - 'random': "Assign Manually" button was used for random placement
   * - 'optimized': "Optimize Layout" button was used for biomechanical optimization
   */
  layoutMode?: LayoutMode;
  /** Version number for this layout (incremented on "Save Layout") */
  version?: number;
  /** Timestamp when this layout version was saved */
  savedAt?: string;
}

/**
 * Helper function to create a Pad key from row and column coordinates.
 * Pad: A specific x/y coordinate on the 8x8 grid.
 * @param row - Row index (0-based, 0 is bottom)
 * @param col - Column index (0-based, 0 is left)
 * @returns String key in format "row,col" representing a Pad
 */
export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

/**
 * Helper function to parse a Pad key back to row and column coordinates.
 * @param key - String key in format "row,col" representing a Pad
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

/**
 * TemplateSlot: Represents a template slot in a layout template.
 * 
 * Defines where a Voice should be assigned to a Pad (Assignment relationship).
 */
export interface TemplateSlot {
  /** Pad row position (0-7, 0 is bottom) */
  row: number;
  /** Pad column position (0-7, 0 is left) */
  col: number;
  /** Label to display (e.g., "Kick", "Snare") */
  label: string;
  /** Optional Cell (MIDI note number) suggestion for this Pad Assignment */
  suggestedNote?: number;
}

/**
 * Represents a layout template with predefined Pad assignments.
 */
export interface LayoutTemplate {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Template slots defining which Pads should be assigned Voices */
  slots: TemplateSlot[];
}

/**
 * Standard drum kit template.
 * 
 * Based on common Push 3 drum rack layouts with bottomLeftNote = 36 (C1).
 * Defines Pad Assignments for common drum Voices.
 */
export const STANDARD_KIT_TEMPLATE: LayoutTemplate = {
  id: 'standard-kit',
  name: 'Standard Kit',
  slots: [
    // Row 0 (Bottom row) - Core drums
    { row: 0, col: 0, label: 'Kick', suggestedNote: 36 },
    { row: 0, col: 1, label: 'Snare', suggestedNote: 38 },
    { row: 0, col: 2, label: 'Hi-Hat', suggestedNote: 42 },
    { row: 0, col: 3, label: 'Open Hat', suggestedNote: 46 },
    { row: 0, col: 4, label: 'Crash', suggestedNote: 49 },
    { row: 0, col: 5, label: 'Ride', suggestedNote: 51 },
    { row: 0, col: 6, label: 'Tom 1', suggestedNote: 48 },
    { row: 0, col: 7, label: 'Tom 2', suggestedNote: 47 },
    
    // Row 1 - Additional percussion
    { row: 1, col: 0, label: 'Clap', suggestedNote: 39 },
    { row: 1, col: 1, label: 'Rim', suggestedNote: 37 },
    { row: 1, col: 2, label: 'Shaker', suggestedNote: 70 },
    { row: 1, col: 3, label: 'Tamb', suggestedNote: 54 },
    { row: 1, col: 4, label: 'Cowbell', suggestedNote: 56 },
    { row: 1, col: 5, label: 'Wood', suggestedNote: 76 },
    { row: 1, col: 6, label: 'Tom 3', suggestedNote: 45 },
    { row: 1, col: 7, label: 'Tom 4', suggestedNote: 43 },
  ],
};

/**
 * Available layout templates.
 */
export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  STANDARD_KIT_TEMPLATE,
];

/**
 * Template ID type for type safety.
 */
export type TemplateId = 'none' | 'standard-kit';

