/**
 * Auto-layout utilities for organizing sounds on the grid.
 */

import { SoundAsset } from '../types/layout';
import { cellKey } from '../types/layout';

/**
 * Maps sound assets to 4x4 quadrants based on their original MIDI note numbers.
 * Uses absolute C-2 (Note 0) indexing to preserve Ableton Drum Rack spatial relationships.
 * 
 * The 8x8 grid is treated as four 4x4 Drum Rack banks:
 * - Bank 0, 4, 8... (notes 0-15, 64-79, 128-143...) -> Bottom-Left (rows 0-3, cols 0-3)
 * - Bank 1, 5, 9... (notes 16-31, 80-95, 144-159...) -> Bottom-Right (rows 0-3, cols 4-7)
 * - Bank 2, 6, 10... (notes 32-47, 96-111, 160-175...) -> Top-Left (rows 4-7, cols 0-3)
 * - Bank 3, 7, 11... (notes 48-63, 112-127, 176-191...) -> Top-Right (rows 4-7, cols 4-7)
 * 
 * Examples:
 * - Note 0 (C-2) -> [0,0] (Bank 0, Bottom-Left)
 * - Note 36 (C1) -> [4,0] (Bank 2, Top-Left)
 * - Note 51 (Eb1) -> [7,3] (Bank 3, Top-Left)
 * 
 * @param sounds - Array of SoundAssets with originalMidiNote set
 * @param _bottomLeftNote - Unused parameter (kept for API compatibility)
 * @returns A mapping of cell keys ("row,col") to SoundAsset objects
 */
export function mapToQuadrants(
  sounds: SoundAsset[],
  _bottomLeftNote: number
): Record<string, SoundAsset> {
  const assignments: Record<string, SoundAsset> = {};
  
  // Quadrant offsets (row, col) for each quadrant index
  const quadrantOffsets: Array<[number, number]> = [
    [0, 0],  // Quadrant 0: Bottom-Left
    [0, 4],  // Quadrant 1: Bottom-Right
    [4, 0],  // Quadrant 2: Top-Left
    [4, 4],  // Quadrant 3: Top-Right
  ];
  
  sounds.forEach(sound => {
    if (sound.originalMidiNote === null) {
      // Skip sounds without originalMidiNote
      return;
    }
    
    const note = sound.originalMidiNote;
    
    // Calculate bank index (which group of 16 notes)
    const bankIndex = Math.floor(note / 16);
    
    // Determine quadrant using modulo 4
    // Bank 0, 4, 8... -> Quadrant 0 (Bottom-Left)
    // Bank 1, 5, 9... -> Quadrant 1 (Bottom-Right)
    // Bank 2, 6, 10... -> Quadrant 2 (Top-Left)
    // Bank 3, 7, 11... -> Quadrant 3 (Top-Right)
    const quadrantIndex = bankIndex % 4;
    
    // Calculate local position within the bank (0-15)
    const localIndex = note % 16;
    
    // Calculate local row and column within the 4x4 quadrant
    // localIndex 0-15 maps to:
    // Row 0: 0-3, Row 1: 4-7, Row 2: 8-11, Row 3: 12-15
    const localRow = Math.floor(localIndex / 4);  // 0-3
    const localCol = localIndex % 4;              // 0-3
    
    // Get quadrant offset
    const [rowOffset, colOffset] = quadrantOffsets[quadrantIndex];
    
    // Calculate final grid position
    const targetRow = localRow + rowOffset;
    const targetCol = localCol + colOffset;
    
    // Validate bounds (should always be within 0-7 for 8x8 grid)
    if (targetRow >= 0 && targetRow < 8 && targetCol >= 0 && targetCol < 8) {
      const key = cellKey(targetRow, targetCol);
      assignments[key] = sound;
    }
  });
  
  return assignments;
}

