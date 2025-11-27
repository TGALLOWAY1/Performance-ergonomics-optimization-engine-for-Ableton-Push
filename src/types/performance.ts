/**
 * Unified data models for the Push Performance Optimizer.
 * This is the single source of truth for all performance, instrument, and section types.
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
  /** Duration in seconds (optional) */
  duration?: number;
  /** MIDI velocity (0-127, optional) */
  velocity?: number;
  /** MIDI channel (1-16, optional) */
  channel?: number;
}

/**
 * Represents the "ground truth" of the musical data to be analyzed.
 * This structure holds the raw performance data before any ergonomic analysis or hand assignment.
 */
export interface Performance {
  /**
   * List of note events in the performance.
   * MUST be strictly sorted by startTime ascending.
   */
  events: NoteEvent[];
  /** Optional tempo in Beats Per Minute (BPM) */
  tempo?: number;
  /** Optional name or title of the performance */
  name?: string;
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
   * This is the root Cell that determines the Voice-to-Pad Assignment mapping.
   * Default is typically 36 (C1). */
  bottomLeftNote: number;
  /**
   * Layout mode for the grid.
   * Currently only supports 'drum_64'. Future support planned for 'melodic_4th'.
   * Defaults to 'drum_64' if not specified.
   */
  layoutMode?: 'drum_64';
}


