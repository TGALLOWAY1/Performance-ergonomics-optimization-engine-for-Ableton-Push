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
import { InstrumentConfig, RestingPose, HandPose, FingerCoordinate } from '../types/performance';
import { GridMapService } from './gridMapService';
import { FingerType } from './models';
import {
  NaturalHandPose,
  fingerIdToEngineKey,
  getPose0PadsWithOffset,
  getMaxSafeOffset,
  poseHasAssignments,
} from '../types/naturalHandPose';

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
  _layout: GridMapping,
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

/**
 * Converts a Natural Hand Pose (Pose 0) to NeutralPadPositions format.
 * 
 * This allows the solver to use user-defined finger positions instead of
 * the default musical-note-based positions.
 * 
 * @param pose - The Natural Hand Pose configuration
 * @param offsetRow - Vertical offset to apply (signed, [-4, +4]). If not provided, uses max safe offset.
 * @param instrumentConfig - Instrument configuration for deriving note numbers
 * @returns NeutralPadPositions or null if pose has no assignments
 */
export function getNeutralPadPositionsFromPose0(
  pose: NaturalHandPose,
  offsetRow?: number,
  instrumentConfig?: InstrumentConfig
): NeutralPadPositions | null {
  if (!poseHasAssignments(pose)) {
    return null;
  }

  // Use provided offset or calculate max safe offset
  const effectiveOffset = offsetRow ?? getMaxSafeOffset(pose, true);
  
  // Get pads with offset applied (clamped to grid)
  const padsWithOffset = getPose0PadsWithOffset(pose, effectiveOffset, true);
  
  const result: NeutralPadPositions = {};
  
  for (const { fingerId, row, col } of padsWithOffset) {
    // Convert FingerId to engine key (e.g., "L_INDEX" -> "L2")
    const engineKey = fingerIdToEngineKey(fingerId);
    const padId = cellKey(row, col);
    
    // Calculate MIDI note number if instrument config is provided
    let noteNumber = 0;
    let noteName = '';
    if (instrumentConfig) {
      noteNumber = GridMapService.getNoteForPosition(row, col, instrumentConfig) ?? 0;
      noteName = midiToNoteName(noteNumber);
    }
    
    result[engineKey] = {
      row,
      col,
      padId,
      noteNumber,
      noteName,
    };
  }
  
  return result;
}

/**
 * Converts a MIDI note number to a note name string.
 * @param midiNote - MIDI note number (0-127)
 * @returns Note name in format "C0", "D#2", etc.
 */
function midiToNoteName(midiNote: number): string {
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const note = NOTE_NAMES[midiNote % 12];
  const octave = Math.floor(midiNote / 12) - 2;
  return `${note}${octave}`;
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

/** Engine key (L1..R5) to FingerType for building HandPose.fingers */
const ENGINE_KEY_TO_FINGER: Record<string, FingerType> = {
  L1: 'thumb', L2: 'index', L3: 'middle', L4: 'ring', L5: 'pinky',
  R1: 'thumb', R2: 'index', R3: 'middle', R4: 'ring', R5: 'pinky',
};

/**
 * Builds a RestingPose from NeutralPadPositions (e.g. from Pose 0).
 * Used so the attractor cost in the solver pulls toward the user's natural hand pose
 * instead of the default claw.
 *
 * @param neutralPads - Per-finger pad positions (L1..R5)
 * @returns RestingPose with left/right HandPose (centroid + fingers), or null if empty
 */
export function restingPoseFromNeutralPadPositions(
  neutralPads: NeutralPadPositions
): RestingPose | null {
  const leftFingers: Partial<Record<FingerType, FingerCoordinate>> = {};
  const rightFingers: Partial<Record<FingerType, FingerCoordinate>> = {};
  let leftSumX = 0, leftSumY = 0, leftCount = 0;
  let rightSumX = 0, rightSumY = 0, rightCount = 0;

  for (const [key, pos] of Object.entries(neutralPads)) {
    const finger = ENGINE_KEY_TO_FINGER[key];
    if (!finger) continue;
    const coord: FingerCoordinate = { x: pos.col, y: pos.row };
    if (key.startsWith('L')) {
      leftFingers[finger] = coord;
      leftSumX += pos.col;
      leftSumY += pos.row;
      leftCount++;
    } else {
      rightFingers[finger] = coord;
      rightSumX += pos.col;
      rightSumY += pos.row;
      rightCount++;
    }
  }

  const leftCenter: FingerCoordinate = leftCount > 0
    ? { x: leftSumX / leftCount, y: leftSumY / leftCount }
    : { x: 2, y: 2 };
  const rightCenter: FingerCoordinate = rightCount > 0
    ? { x: rightSumX / rightCount, y: rightSumY / rightCount }
    : { x: 5, y: 2 };

  const leftPose: HandPose = { centroid: leftCenter, fingers: leftFingers };
  const rightPose: HandPose = { centroid: rightCenter, fingers: rightFingers };

  return {
    left: leftPose,
    right: rightPose,
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

