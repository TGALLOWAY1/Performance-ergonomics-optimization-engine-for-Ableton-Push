import { InstrumentConfig } from '../data/models';

/**
 * Stateless service for mapping Cells (MIDI notes) to Pads (grid positions) and vice versa.
 * Based on Ableton Push 3 Manual, Section 6.3 ("64-Pad Mode").
 */
export class GridMapService {
  /**
   * A4: Refactored to noteToGrid function.
   * Calculates the Pad position [row, col] for a given Cell (MIDI note number).
   * 
   * @param noteNumber - The Cell (MIDI note number, 0-127) to map.
   * @param config - The instrument configuration defining the Cell-to-Pad mapping.
   * @returns The Pad [row, col] position if the Cell is within the 8x8 window, or null if outside.
   */
  static noteToGrid(noteNumber: number, config: InstrumentConfig): [number, number] | null {
    const offset = noteNumber - config.bottomLeftNote;
    
    // Check if Cell is below the start of the grid
    if (offset < 0) {
      return null;
    }

    const row = Math.floor(offset / config.cols);
    const col = offset % config.cols;

    // Check if Cell maps to a Pad beyond the grid dimensions (8x8)
    if (row >= config.rows) {
      return null;
    }

    return [row, col];
  }

  /**
   * Legacy method for backward compatibility.
   * Calculates the Pad position for a given Cell (MIDI note number).
   * @deprecated Use noteToGrid instead.
   * 
   * @param noteNumber - The Cell (MIDI note number) to map.
   * @param config - The instrument configuration defining the Cell-to-Pad mapping.
   * @returns The Pad position {row, col} if the Cell is within the 8x8 window, or null if outside.
   */
  static getPositionForNote(noteNumber: number, config: InstrumentConfig): { row: number; col: number } | null {
    const result = this.noteToGrid(noteNumber, config);
    if (!result) return null;
    return { row: result[0], col: result[1] };
  }

  /**
   * Calculates the Cell (MIDI note number) for a given Pad position (row, col).
   * 
   * @param row - The Pad row index (0-based, 0 is bottom).
   * @param col - The Pad column index (0-based, 0 is left).
   * @param config - The instrument configuration defining the Cell-to-Pad mapping.
   * @returns The Cell (MIDI note number, 0-127).
   */
  static getNoteForPosition(row: number, col: number, config: InstrumentConfig): number {
    // Ensure row and col are within bounds (optional safety check, though logic holds without it)
    // We assume valid Pad coordinates are passed, but could return -1 or throw if strict bounds needed.
    // For now, we just calculate the linear index.
    
    // Linear index = row * width + col
    const offset = (row * config.cols) + col;
    return config.bottomLeftNote + offset;
  }
}

