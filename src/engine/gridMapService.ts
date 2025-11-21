/**
 * GridMapService
 * 
 * Stateless service for mapping Voices (MIDI pitches) to Pads (grid positions) and vice versa.
 * Based on Ableton Push 3 Manual, Section 6.3 ("64-Pad Mode").
 * 
 * TERMINOLOGY (see TERMINOLOGY.md):
 * - Voice: MIDI pitch value (e.g., MIDI Note 36)
 * - Pad: Physical button coordinates {row: 0-7, col: 0-7}
 * - Assignment: Voice → Pad mapping relationship
 * 
 * ⚠️ CRITICAL: Voice (MIDI 36) ≠ Pad ([0,0]). Voice is pitch; Pad is physical location.
 */
import { InstrumentConfig } from '../types/performance';

export class GridMapService {
  /**
   * Calculates the Pad position [row, col] for a given Voice (MIDI note number).
   * 
   * Maps a Voice to its corresponding Pad using the InstrumentConfig's bottomLeftNote.
   * 
   * @param noteNumber - The Voice (MIDI note number, 0-127) to map.
   * @param config - The instrument configuration defining the Voice-to-Pad mapping.
   * @returns The Pad [row, col] position if the Voice is within the 8x8 window, or null if outside.
   */
  static noteToGrid(noteNumber: number, config: InstrumentConfig): [number, number] | null {
    const offset = noteNumber - config.bottomLeftNote;
    
    // Check if Voice is below the start of the grid
    if (offset < 0) {
      return null;
    }

    const row = Math.floor(offset / config.cols);
    const col = offset % config.cols;

    // Check if Voice maps to a Pad beyond the grid dimensions (8x8)
    if (row >= config.rows) {
      return null;
    }

    return [row, col];
  }

  /**
   * Legacy method for backward compatibility.
   * Calculates the Pad position for a given Voice (MIDI note number).
   * @deprecated Use noteToGrid instead.
   * 
   * @param noteNumber - The Voice (MIDI note number) to map.
   * @param config - The instrument configuration defining the Voice-to-Pad mapping.
   * @returns The Pad position {row, col} if the Voice is within the 8x8 window, or null if outside.
   */
  static getPositionForNote(noteNumber: number, config: InstrumentConfig): { row: number; col: number } | null {
    const result = this.noteToGrid(noteNumber, config);
    if (!result) return null;
    return { row: result[0], col: result[1] };
  }

  /**
   * Calculates the Voice (MIDI note number) for a given Pad position (row, col).
   * 
   * Maps a Pad to its corresponding Voice using the InstrumentConfig's bottomLeftNote.
   * 
   * @param row - The Pad row index (0-based, 0 is bottom).
   * @param col - The Pad column index (0-based, 0 is left).
   * @param config - The instrument configuration defining the Voice-to-Pad mapping.
   * @returns The Voice (MIDI note number, 0-127).
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

