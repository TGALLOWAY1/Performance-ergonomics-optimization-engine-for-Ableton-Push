/**
 * Layout utility functions for mapping MIDI notes to grid positions.
 */

import { GridMapping } from '../types/layout';
import { GridPosition } from '../engine/gridMath';
import { parseCellKey } from '../types/layout';

/**
 * Finds the grid position for a MIDI note based on the active mapping.
 * 
 * Iterates through all cells in the mapping to find a SoundAsset where
 * `asset.originalMidiNote === midiNote`, then returns that cell's position.
 * 
 * @param midiNote - The MIDI note number to find
 * @param mapping - The GridMapping containing cell assignments
 * @returns The GridPosition (row, col) if found, or null if the note is unmapped
 */
export function getPositionForMidi(
  midiNote: number,
  mapping: GridMapping
): GridPosition | null {
  // Iterate through all cells in the mapping
  for (const [cellKey, sound] of Object.entries(mapping.cells)) {
    // Check if this sound's originalMidiNote matches
    if (sound.originalMidiNote === midiNote) {
      // Parse the cell key to get row and col
      const position = parseCellKey(cellKey);
      if (position) {
        return { row: position.row, col: position.col };
      }
    }
  }
  
  // Note not found in mapping
  return null;
}

