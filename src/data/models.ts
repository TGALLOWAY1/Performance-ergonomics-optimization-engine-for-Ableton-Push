/**
 * Core data models for the Push Performance Optimizer.
 * These models define the structure for time-based mapping and instrument configuration.
 */

/**
 * A1: Simplified NoteEvent - removed duration field for MVP
 * Represents a single MIDI note event in a performance.
 */
export interface NoteEvent {
  /** MIDI note number (0-127) */
  noteNumber: number;
  /** Absolute start time in seconds */
  startTime: number;
}

/**
 * A2: InstrumentConfig
 * Configuration for the active 8x8 Push window.
 * Based on Ableton Push 3 Manual, Section 6.3 ("64-Pad Mode").
 */
export interface InstrumentConfig {
  id: string;
  name: string;
  /** Number of rows in the grid. Fixed at 8 for 64-pad mode. */
  rows: 8;
  /** Number of columns in the grid. Fixed at 8 for 64-pad mode. */
  cols: 8;
  /** The MIDI note at row 0, col 0 (bottom-left corner). */
  bottomLeftNote: number;
}

/**
 * A3: SectionMap
 * Maps a specific time range in the song to a specific grid configuration.
 * If a note falls within these measures, this specific instrumentConfig is used to calculate its grid position.
 */
export interface SectionMap {
  id: string;
  name: string;
  /** Start measure (1-based index) */
  startMeasure: number;
  /** End measure (1-based index) */
  endMeasure: number;
  /** The instrument configuration active during this section */
  instrumentConfig: InstrumentConfig;
}

