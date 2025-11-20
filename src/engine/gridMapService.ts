import { InstrumentConfig } from '../data/models';

/**
 * Stateless service for mapping MIDI notes to grid positions and vice versa.
 * Based on Ableton Push 3 Manual, Section 6.3 ("64-Pad Mode").
 */
export class GridMapService {
  /**
   * A4: Refactored to noteToGrid function.
   * Calculates the grid position [row, col] for a given MIDI note number.
   * 
   * @param noteNumber - The MIDI note number to map.
   * @param config - The instrument configuration defining the grid layout.
   * @returns The [row, col] position if the note is within the 8x8 window, or null if outside.
   */
  static noteToGrid(noteNumber: number, config: InstrumentConfig): [number, number] | null {
    const offset = noteNumber - config.bottomLeftNote;
    
    // Check if note is below the start of the grid
    if (offset < 0) {
      return null;
    }

    const row = Math.floor(offset / config.cols);
    const col = offset % config.cols;

    // Check if note is beyond the grid dimensions (8x8)
    if (row >= config.rows) {
      return null;
    }

    return [row, col];
  }

  /**
   * Legacy method for backward compatibility.
   * @deprecated Use noteToGrid instead.
   */
  static getPositionForNote(noteNumber: number, config: InstrumentConfig): { row: number; col: number } | null {
    const result = this.noteToGrid(noteNumber, config);
    if (!result) return null;
    return { row: result[0], col: result[1] };
  }

  /**
   * Calculates the MIDI note number for a given grid position (row, col).
   * 
   * @param row - The row index (0-based, 0 is bottom).
   * @param col - The column index (0-based, 0 is left).
   * @param config - The instrument configuration defining the grid layout.
   * @returns The MIDI note number.
   */
  static getNoteForPosition(row: number, col: number, config: InstrumentConfig): number {
    // Ensure row and col are within bounds (optional safety check, though logic holds without it)
    // We assume valid grid coordinates are passed, but could return -1 or throw if strict bounds needed.
    // For now, we just calculate the linear index.
    
    // Linear index = row * width + col
    const offset = (row * config.cols) + col;
    return config.bottomLeftNote + offset;
  }
}

