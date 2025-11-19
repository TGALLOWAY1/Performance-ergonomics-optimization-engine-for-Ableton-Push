/**
 * Geometric feasibility checks for the biomechanical hand model.
 * Implements hard physical constraints that must be satisfied.
 */

import { GridPosition, calculateGridDistance } from './gridMath';
import { FingerID } from '../types/engine';
import { Hand, MAX_HAND_SPAN } from './ergonomics';

/**
 * Checks if the distance from wrist to target position is within the maximum hand span.
 * 
 * @param wristPosition - Current wrist position (base of the hand)
 * @param targetPosition - Target position to reach
 * @returns true if the span is valid (distance < MAX_HAND_SPAN), false otherwise
 */
export function isSpanValid(
  wristPosition: GridPosition | null,
  targetPosition: GridPosition
): boolean {
  if (wristPosition === null) {
    // If wrist is floating, assume valid (hand can start anywhere)
    return true;
  }
  
  const distance = calculateGridDistance(wristPosition, targetPosition);
  return distance <= MAX_HAND_SPAN;
}

/**
 * Checks if finger ordering is valid based on hand orientation.
 * Ensures Thumb (1) is to the Left/Bottom of Pinky (5) relative to the hand's orientation.
 * 
 * For Right Hand (RH):
 * - Thumb should be to the left (lower col) or bottom (lower row) of Pinky
 * 
 * For Left Hand (LH):
 * - Thumb should be to the right (higher col) or bottom (lower row) of Pinky
 * 
 * @param hand - 'LH' or 'RH'
 * @param thumbPos - Position of Thumb (finger 1)
 * @param pinkyPos - Position of Pinky (finger 5)
 * @returns true if ordering is valid, false otherwise
 */
export function isFingerOrderingValid(
  hand: Hand,
  thumbPos: GridPosition | null,
  pinkyPos: GridPosition | null
): boolean {
  // If either finger is not placed, ordering is trivially valid
  if (thumbPos === null || pinkyPos === null) {
    return true;
  }
  
  if (hand === 'RH') {
    // Right Hand: Thumb should be left (lower col) OR bottom (lower row) of Pinky
    return thumbPos.col < pinkyPos.col || thumbPos.row < pinkyPos.row;
  } else {
    // Left Hand: Thumb should be right (higher col) OR bottom (lower row) of Pinky
    return thumbPos.col > pinkyPos.col || thumbPos.row < pinkyPos.row;
  }
}

/**
 * Checks if two fingers are occupying the same grid cell (collision).
 * 
 * @param pos1 - Position of first finger (or null if not placed)
 * @param pos2 - Position of second finger (or null if not placed)
 * @returns true if there is a collision (both fingers at same position), false otherwise
 */
export function isCollision(
  pos1: GridPosition | null,
  pos2: GridPosition | null
): boolean {
  // No collision if either finger is not placed
  if (pos1 === null || pos2 === null) {
    return false;
  }
  
  // Collision if both positions are identical
  return pos1.row === pos2.row && pos1.col === pos2.col;
}

/**
 * Checks if a finger position collides with any other active finger in a hand.
 * 
 * @param fingerId - The finger ID to check (1-5)
 * @param fingerPos - The position of the finger to check
 * @param allFingers - Record of all finger states in the hand
 * @returns true if there is a collision with another finger, false otherwise
 */
export function hasFingerCollision(
  fingerId: FingerID,
  fingerPos: GridPosition,
  allFingers: Record<FingerID, { pos: GridPosition | null; fatigue: number }>
): boolean {
  const allFingerIds: FingerID[] = [1, 2, 3, 4, 5];
  
  for (const fid of allFingerIds) {
    // Skip the finger we're checking
    if (fid === fingerId) continue;
    
    if (isCollision(fingerPos, allFingers[fid].pos)) {
      return true;
    }
  }
  
  return false;
}

