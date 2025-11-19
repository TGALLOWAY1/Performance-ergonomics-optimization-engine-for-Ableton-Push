/**
 * Engine types and interfaces for the Performability Engine.
 */

import { GridPosition } from '../engine/gridMath';

export type FingerID = 1 | 2 | 3 | 4 | 5;

/**
 * Finger mapping:
 * 1 = Thumb
 * 2 = Index
 * 3 = Middle
 * 4 = Ring
 * 5 = Pinky
 */

/**
 * Represents the state of a single finger in the biomechanical model.
 */
export interface FingerState {
  /** Current position of the finger tip, or null if not placed */
  pos: GridPosition | null;
  /** Fatigue level (0.0 = no fatigue, higher = more fatigued) */
  fatigue: number;
}
