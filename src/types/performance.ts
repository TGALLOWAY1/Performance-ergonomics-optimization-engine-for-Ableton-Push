export interface NoteEvent {
  /** MIDI note number (0-127) */
  noteNumber: number;
  /** Absolute start time in seconds */
  startTime: number;
  /** Duration in seconds */
  duration?: number;
  /** MIDI velocity (0-127) */
  velocity?: number;
  /** MIDI channel (1-16) */
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
 * Configuration for the active 8x8 Push window.
 * Based on Ableton Push 3 Manual, Section 6.3 ("64-Pad Mode").
 */
export interface InstrumentConfig {
  id: string;
  name: string;
  /**
   * The MIDI note at row 0, col 0.
   * Default is typically 36 (C1).
   */
  bottomLeftNote: number;
  /**
   * Layout mode for the grid.
   * Currently only supports 'drum_64'. Future support planned for 'melodic_4th'.
   */
  layoutMode: 'drum_64';
  /**
   * Number of rows in the grid.
   * Default: 8
   */
  rows: number;
  /**
   * Number of columns in the grid.
   * Default: 8
   */
  cols: number;
}

/**
 * Maps a specific time range in the song to a specific grid configuration.
 * If a note falls within these measures, this specific instrumentConfig is used to calculate its grid position.
 */
export interface SectionMap {
  id: string;
  /** Start measure (1-based index) */
  startMeasure: number;
  /** End measure (1-based index) */
  endMeasure: number;
  /** The instrument configuration active during this section */
  instrumentConfig: InstrumentConfig;
}
