/**
 * Core data models for the Push Performance Optimizer.
 * These models define the structure for time-based mapping and instrument configuration.
 * 
 * TERMINOLOGY (see TERMINOLOGY.md):
 * - Voice: A unique MIDI pitch (e.g., MIDI Note 36)
 * - Cell: A slot in the 128 Drum Rack (Index 0-127)
 * - Pad: A specific x/y coordinate on the 8x8 grid
 * - Assignment: The mapping of a Voice/Cell to a Pad
 */

/**
 * NoteEvent: A specific instance in time where a Voice is triggered.
 * 
 * Represents a single MIDI note event in a performance.
 * Note: The Voice (MIDI pitch) maps to a Cell (Drum Rack slot) which is assigned to a Pad.
 */
export interface NoteEvent {
  /** Voice: The MIDI note number (0-127) representing the pitch that is triggered */
  noteNumber: number;
  /** Absolute start time in seconds when this Voice is triggered */
  startTime: number;
}

/**
 * InstrumentConfig: Configuration for the active 8x8 Pad grid window.
 * 
 * Defines the Voice-to-Pad mapping for the Push 3's 64-Pad Drum Mode.
 * Based on Ableton Push 3 Manual, Section 6.3 ("64-Pad Mode").
 * 
 * This config establishes the Assignment relationship: which Voice (Cell) maps to which Pad.
 */
export interface InstrumentConfig {
  id: string;
  name: string;
  /** Number of Pad rows in the grid. Fixed at 8 for 64-pad mode. */
  rows: 8;
  /** Number of Pad columns in the grid. Fixed at 8 for 64-pad mode. */
  cols: 8;
  /** Cell: The MIDI note number (0-127) assigned to Pad [0,0] (bottom-left Pad). 
   * This is the root Cell that determines the Voice-to-Pad Assignment mapping. */
  bottomLeftNote: number;
}

/**
 * SectionMap: Maps a specific time range in the song to a specific Pad grid configuration.
 * 
 * If a Voice (Cell) falls within these measures, this InstrumentConfig is used to calculate 
 * its Pad position via the Voice-to-Pad Assignment mapping.
 */
export interface SectionMap {
  id: string;
  name: string;
  /** Start measure (1-based index) */
  startMeasure: number;
  /** Length of the section in measures. End measure is calculated as: startMeasure + lengthInMeasures - 1 */
  lengthInMeasures: number;
  /** The instrument configuration active during this section (defines Voice-to-Pad Assignment mapping) */
  instrumentConfig: InstrumentConfig;
}

