import { Performance, NoteEvent } from '../types/performance';

const DEFAULT_TEMPO = 120;
const SIXTEENTH_NOTE_DURATION = (60 / DEFAULT_TEMPO) / 4;

/**
 * Creates a "Snake" pattern: 16 notes from MIDI 36 to 51.
 * Placed on consecutive 16th note steps.
 * Used to verify grid wrapping (row to row).
 */
export const getSnakePattern = (): Performance => {
  const events: NoteEvent[] = [];
  const startNote = 36; // C1

  for (let i = 0; i < 16; i++) {
    events.push({
      noteNumber: startNote + i,
      startTime: i * SIXTEENTH_NOTE_DURATION,
      duration: SIXTEENTH_NOTE_DURATION,
      velocity: 100,
      channel: 1
    });
  }

  return {
    events,
    tempo: DEFAULT_TEMPO,
    name: 'Snake Pattern (36-51)'
  };
};

/**
 * Creates a "Corners" pattern: 4 notes at the corners of an 8x8 grid (Root 36).
 * - Bottom-Left: 36
 * - Bottom-Right: 43
 * - Top-Left: 92
 * - Top-Right: 99
 * Placed on steps 1, 5, 9, 13 (0-indexed: 0, 4, 8, 12).
 */
export const getCornersPattern = (): Performance => {
  const events: NoteEvent[] = [];
  
  // Step 1 (Index 0): Bottom-Left
  events.push({
    noteNumber: 36,
    startTime: 0 * SIXTEENTH_NOTE_DURATION,
    duration: SIXTEENTH_NOTE_DURATION,
    velocity: 100,
    channel: 1
  });

  // Step 5 (Index 4): Bottom-Right
  events.push({
    noteNumber: 43,
    startTime: 4 * SIXTEENTH_NOTE_DURATION,
    duration: SIXTEENTH_NOTE_DURATION,
    velocity: 100,
    channel: 1
  });

  // Step 9 (Index 8): Top-Left
  events.push({
    noteNumber: 92,
    startTime: 8 * SIXTEENTH_NOTE_DURATION,
    duration: SIXTEENTH_NOTE_DURATION,
    velocity: 100,
    channel: 1
  });

  // Step 13 (Index 12): Top-Right
  events.push({
    noteNumber: 99,
    startTime: 12 * SIXTEENTH_NOTE_DURATION,
    duration: SIXTEENTH_NOTE_DURATION,
    velocity: 100,
    channel: 1
  });

  return {
    events,
    tempo: DEFAULT_TEMPO,
    name: 'Corners Pattern (8x8)'
  };
};

/**
 * Creates a "Range Test" pattern:
 * - One very low note (MIDI 0)
 * - One very high note (MIDI 127)
 * Used to verify off-grid logic.
 */
export const getRangeTestPattern = (): Performance => {
  const events: NoteEvent[] = [];

  // Step 1: MIDI 0
  events.push({
    noteNumber: 0,
    startTime: 0,
    duration: SIXTEENTH_NOTE_DURATION,
    velocity: 100,
    channel: 1
  });

  // Step 2: MIDI 127
  events.push({
    noteNumber: 127,
    startTime: SIXTEENTH_NOTE_DURATION,
    duration: SIXTEENTH_NOTE_DURATION,
    velocity: 100,
    channel: 1
  });

  return {
    events,
    tempo: DEFAULT_TEMPO,
    name: 'Range Test (0 & 127)'
  };
};

