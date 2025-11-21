/**
 * Layout utility functions for mapping Cells (MIDI notes) to Pads (grid positions).
 */

import { GridMapping } from '../types/layout';
import { GridPosition } from '../engine/gridMath';
import { parseCellKey } from '../types/layout';

/**
 * Finds the Pad position for a Cell (MIDI note) based on the active mapping.
 * 
 * Iterates through all Pad assignments in the mapping to find a Voice where
 * `voice.originalMidiNote === midiNote`, then returns that Pad's position.
 * 
 * @param midiNote - The Cell (MIDI note number, 0-127) to find
 * @param mapping - The GridMapping containing Pad-to-Voice Assignments
 * @returns The Pad GridPosition (row, col) if found, or null if the Cell is unmapped
 */
export function getPositionForMidi(
  midiNote: number,
  mapping: GridMapping
): GridPosition | null {
  // Iterate through all Pad assignments in the mapping
  for (const [cellKey, sound] of Object.entries(mapping.cells)) {
    // Check if this Voice's Cell (originalMidiNote) matches
    if (sound.originalMidiNote === midiNote) {
      // Parse the Pad key to get row and col
      const position = parseCellKey(cellKey);
      if (position) {
        return { row: position.row, col: position.col };
      }
    }
  }
  
  // Cell not found in mapping (no Pad assignment for this Cell)
  return null;
}

