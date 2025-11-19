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

/**
 * Represents a template slot in a layout template.
 * Defines where a standard sound should be placed.
 */
export interface TemplateSlot {
  /** Row position (0-7) */
  row: number;
  /** Column position (0-7) */
  col: number;
  /** Label to display (e.g., "Kick", "Snare") */
  label: string;
  /** Optional MIDI note number suggestion */
  suggestedNote?: number;
}

/**
 * Represents a layout template with predefined slot positions.
 */
export interface LayoutTemplate {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Template slots defining where sounds should be placed */
  slots: TemplateSlot[];
}

/**
 * Standard drum kit template.
 * Based on common Push 3 drum rack layouts with bottomLeftNote = 36 (C1).
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

