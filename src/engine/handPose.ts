/**
 * Hand Pose Configuration
 * 
 * Defines the neutral hand pose based on the user's natural Push 3 resting position.
 * This represents where each finger naturally sits when the hands are in a relaxed,
 * ready-to-play position on the grid.
 * 
 * The neutral pose is defined in musical note space (MIDI note numbers) and can be
 * resolved to actual pad positions (row/col) for any given grid layout.
 */

import { GridMapping, cellKey } from '../types/layout';
import { InstrumentConfig } from '../types/performance';
import { GridMapService } from './gridMapService';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Hand identifier: 'L' for left, 'R' for right.
 */
export type Hand = 'L' | 'R';

/**
 * Finger identifier combining hand and finger number.
 * Finger numbers: 1 = thumb, 2 = index, 3 = middle, 4 = ring, 5 = pinky
 */
export interface FingerId {
  hand: Hand;
  finger: 1 | 2 | 3 | 4 | 5;
}

/**
 * Neutral finger pose in musical note space.
 * Represents where a finger naturally rests in terms of MIDI note number.
 */
export interface NeutralFingerPose {
  /** Note name in format "D#-2", "G-1", "C0", etc. */
  noteName: string;
  /** MIDI note number (0-127) */
  noteNumber: number;
  /** Pad identifier "row,col" once mapped to layout (optional, populated by resolveNeutralPadPositions) */
  padId?: string;
}

/**
 * Neutral hand pose for all fingers.
 * Keys are finger identifiers: "L1", "L2", ..., "R5"
 * L1 = Left thumb, L2 = Left index, ..., R5 = Right pinky
 */
export type NeutralHandPose = Record<string, NeutralFingerPose>;

// ============================================================================
// Note Name to MIDI Conversion
// ============================================================================

/**
 * Note names in chromatic order (C, C#, D, D#, E, F, F#, G, G#, A, A#, B)
 */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Converts a note name string (e.g., "D#-2", "G-1", "C0") to a MIDI note number.
 * 
 * Format: "{note}{octave}" where:
 * - note: C, C#, D, D#, E, F, F#, G, G#, A, A#, B
 * - octave: integer (e.g., -2, -1, 0, 1, 2, ...)
 * 
 * MIDI note 0 = C-2 (lowest MIDI note)
 * MIDI note 60 = C3 (middle C)
 * Formula: midiNote = (octave + 2) * 12 + noteIndex
 * 
 * @param noteName - Note name string (e.g., "D#-2", "G-1", "C0")
 * @returns MIDI note number (0-127), or null if invalid
 */
function noteNameToMidi(noteName: string): number | null {
  // Parse note name: extract note and octave
  // Pattern: optional note name (C, C#, D, D#, etc.) followed by optional minus sign and octave number
  const match = noteName.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) {
    return null;
  }

  const notePart = match[1];
  const octave = parseInt(match[2], 10);

  // Find note index in NOTE_NAMES array
  const noteIndex = NOTE_NAMES.indexOf(notePart);
  if (noteIndex === -1) {
    return null;
  }

  // Calculate MIDI note number
  // MIDI 0 = C-2, so: midiNote = (octave + 2) * 12 + noteIndex
  const midiNote = (octave + 2) * 12 + noteIndex;

  // Validate range
  if (midiNote < 0 || midiNote > 127) {
    return null;
  }

  return midiNote;
}

// ============================================================================
// Default Neutral Hand Pose
// ============================================================================

/**
 * Default neutral hand pose for Push 3.
 * 
 * Defines the natural resting position for each finger in musical note space.
 * Based on ergonomic best practices for hand positioning on the Push 3 grid.
 * 
 * Left Hand:
 * - L1 (Thumb): D#-2
 * - L2 (Index): G-1
 * - L3 (Middle): D0
 * - L4 (Ring): C#0
 * - L5 (Pinky): C0
 * 
 * Right Hand:
 * - R1 (Thumb): E-2
 * - R2 (Index): G#-1
 * - R3 (Middle): F0
 * - R4 (Ring): F#0
 * - R5 (Pinky): G0
 */
export const DEFAULT_HAND_POSE: NeutralHandPose = {
  L1: { noteName: 'D#-2', noteNumber: noteNameToMidi('D#-2')! },
  L2: { noteName: 'G-1', noteNumber: noteNameToMidi('G-1')! },
  L3: { noteName: 'D0', noteNumber: noteNameToMidi('D0')! },
  L4: { noteName: 'C#0', noteNumber: noteNameToMidi('C#0')! },
  L5: { noteName: 'C0', noteNumber: noteNameToMidi('C0')! },
  
  R1: { noteName: 'E-2', noteNumber: noteNameToMidi('E-2')! },
  R2: { noteName: 'G#-1', noteNumber: noteNameToMidi('G#-1')! },
  R3: { noteName: 'F0', noteNumber: noteNameToMidi('F0')! },
  R4: { noteName: 'F#0', noteNumber: noteNameToMidi('F#0')! },
  R5: { noteName: 'G0', noteNumber: noteNameToMidi('G0')! },
};

// ============================================================================
// Pad Position Resolution
// ============================================================================

/**
 * Neutral pad position for a finger.
 * Represents where a finger naturally sits on the current grid layout.
 */
export interface NeutralPadPosition {
  /** Pad row (0-7, 0 is bottom) */
  row: number;
  /** Pad column (0-7, 0 is left) */
  col: number;
  /** Pad identifier in format "row,col" */
  padId: string;
  /** MIDI note number for this finger's neutral position */
  noteNumber: number;
  /** Note name for this finger's neutral position */
  noteName: string;
}

/**
 * Neutral pad positions for all fingers.
 * Keys are finger identifiers: "L1", "L2", ..., "R5"
 */
export type NeutralPadPositions = Record<string, NeutralPadPosition>;

/**
 * Resolves the neutral hand pose to actual pad positions for the current grid layout.
 * 
 * This function maps each finger's natural resting position (defined in MIDI note space)
 * to the corresponding pad coordinates (row/col) based on the current grid mapping
 * and instrument configuration.
 * 
 * If a note doesn't exist in the current layout (outside the 8x8 grid window),
 * that finger's position is skipped (not included in the result).
 * 
 * @param layout - The current grid mapping configuration
 * @param instrumentConfig - The instrument configuration defining the Voice-to-Pad mapping
 * @returns Record of finger keys ("L1", ..., "R5") to their pad positions, or empty if layout is invalid
 */
export function resolveNeutralPadPositions(
  layout: GridMapping,
  instrumentConfig: InstrumentConfig
): NeutralPadPositions {
  const result: NeutralPadPositions = {};

  for (const [fingerKey, pose] of Object.entries(DEFAULT_HAND_POSE)) {
    // Get pad position for this note number using GridMapService
    const padPosition = GridMapService.noteToGrid(pose.noteNumber, instrumentConfig);
    
    // Skip if the note doesn't exist in this layout (outside the 8x8 grid)
    if (!padPosition) {
      continue;
    }

    const [row, col] = padPosition;
    const padId = cellKey(row, col);

    result[fingerKey] = {
      row,
      col,
      padId,
      noteNumber: pose.noteNumber,
      noteName: pose.noteName,
    };
  }

  return result;
}

// ============================================================================
// Neutral Hand Centers
// ============================================================================

/**
 * Neutral hand centers derived from the default hand pose.
 * Represents the "home" position for each hand based on the natural resting pose.
 */
export interface NeutralHandCenters {
  /** Center of gravity for the left hand (centroid of L1-L5 neutral pads) */
  leftCenter: { x: number; y: number } | null;
  /** Center of gravity for the right hand (centroid of R1-R5 neutral pads) */
  rightCenter: { x: number; y: number } | null;
  /** Neutral pad positions for all fingers */
  neutralPads: NeutralPadPositions;
}

/**
 * Computes neutral hand centers from neutral pad positions.
 * 
 * Calculates the centroid (center of gravity) for each hand by averaging
 * the positions of all available neutral pads for that hand.
 * 
 * @param neutralPads - Neutral pad positions for all fingers
 * @returns Neutral hand centers with left/right centroids
 */
export function computeNeutralHandCenters(
  neutralPads: NeutralPadPositions
): NeutralHandCenters {
  // Compute left hand center (from L1-L5)
  const leftPads: NeutralPadPosition[] = [];
  for (let i = 1; i <= 5; i++) {
    const key = `L${i}`;
    if (neutralPads[key]) {
      leftPads.push(neutralPads[key]);
    }
  }
  
  const leftCenter = leftPads.length > 0
    ? {
        x: leftPads.reduce((sum, p) => sum + p.col, 0) / leftPads.length,
        y: leftPads.reduce((sum, p) => sum + p.row, 0) / leftPads.length,
      }
    : null;

  // Compute right hand center (from R1-R5)
  const rightPads: NeutralPadPosition[] = [];
  for (let i = 1; i <= 5; i++) {
    const key = `R${i}`;
    if (neutralPads[key]) {
      rightPads.push(neutralPads[key]);
    }
  }
  
  const rightCenter = rightPads.length > 0
    ? {
        x: rightPads.reduce((sum, p) => sum + p.col, 0) / rightPads.length,
        y: rightPads.reduce((sum, p) => sum + p.row, 0) / rightPads.length,
      }
    : null;

  return {
    leftCenter,
    rightCenter,
    neutralPads,
  };
}

/**
 * Computes neutral hand centers for a given layout and instrument configuration.
 * 
 * This is a convenience function that resolves neutral pads and computes centers
 * in one step.
 * 
 * @param layout - The current grid mapping configuration
 * @param instrumentConfig - The instrument configuration defining Voice-to-Pad mapping
 * @returns Neutral hand centers with left/right centroids and pad positions
 */
export function getNeutralHandCenters(
  layout: GridMapping,
  instrumentConfig: InstrumentConfig
): NeutralHandCenters {
  const neutralPads = resolveNeutralPadPositions(layout, instrumentConfig);
  return computeNeutralHandCenters(neutralPads);
}

