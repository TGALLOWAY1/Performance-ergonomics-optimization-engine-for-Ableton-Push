/**
 * Geometric feasibility checks for the biomechanical hand model.
 * Implements hard physical constraints that must be satisfied.
 */

import { GridPosition, calculateGridDistance } from './gridMath';
import { FingerID } from '../types/engine';
import { Hand, MAX_HAND_SPAN, MAX_REACH_GRID_UNITS } from './ergonomics';
import { FingerType, HandState, GridPos, DEFAULT_ENGINE_CONSTANTS } from './models';

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

/**
 * Reachability level for a grid cell from an anchor position.
 * - 'green': Easy reach (distance <= 3.0 grid units)
 * - 'yellow': Medium/Hard reach (3.0 < distance <= MAX_REACH_GRID_UNITS)
 * - 'gray': Unreachable (distance > MAX_REACH_GRID_UNITS)
 */
export type ReachabilityLevel = 'green' | 'yellow' | 'gray';

/**
 * Maps all 64 grid cells to their reachability level from an anchor position.
 * Used for the "Ghost Hand" visualization to show which cells are reachable
 * by a specific finger from a given anchor point.
 * 
 * @param anchorPos - The anchor position (where the finger is currently placed)
 * @param anchorFinger - The finger ID at the anchor position (1-5)
 * @param targetFinger - The finger ID we're checking reachability for (1-5)
 * @returns A map of cell keys ("row,col") to reachability levels
 */
export function getReachabilityMap(
  anchorPos: GridPosition,
  _anchorFinger: FingerID,
  _targetFinger: FingerID
): Record<string, ReachabilityLevel> {
  const map: Record<string, ReachabilityLevel> = {};
  
  // Generate all 64 cells (8x8 grid)
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const cellKey = `${row},${col}`;
      const targetPos: GridPosition = { row, col };
      
      // Calculate distance from anchor to target
      const distance = calculateGridDistance(anchorPos, targetPos);
      
      // Determine reachability level
      if (distance <= 3.0) {
        map[cellKey] = 'green';
      } else if (distance <= MAX_REACH_GRID_UNITS) {
        map[cellKey] = 'yellow';
      } else {
        map[cellKey] = 'gray';
      }
    }
  }
  
  return map;
}

/**
 * Calculates the Euclidean distance between two grid positions as tuples.
 * 
 * @param start - Starting position [row, col]
 * @param end - Ending position [row, col]
 * @returns The Euclidean distance between the two points
 */
function calculateDistance(start: GridPos, end: GridPos): number {
  const rowDiff = end[0] - start[0];
  const colDiff = end[1] - start[1];
  return Math.sqrt((rowDiff * rowDiff) + (colDiff * colDiff));
}

/**
 * Checks if a reach from start to end position is possible for a given finger.
 * Returns false if the distance exceeds the maximum reach constant.
 * 
 * @param start - Starting position [row, col]
 * @param end - Ending position [row, col]
 * @param finger - The finger type attempting the reach
 * @param constants - Engine constants (defaults to DEFAULT_ENGINE_CONSTANTS)
 * @returns true if the reach is possible, false if distance exceeds max reach
 */
export function isReachPossible(
  start: GridPos,
  end: GridPos,
  finger: FingerType,
  constants: typeof DEFAULT_ENGINE_CONSTANTS = DEFAULT_ENGINE_CONSTANTS
): boolean {
  const distance = calculateDistance(start, end);
  
  // Use maxReach as the maximum reach distance
  // All fingers use the same max reach for now, but this could be finger-specific
  return distance <= constants.maxReach;
}

/**
 * Checks if a new finger assignment violates geometric finger ordering constraints.
 * Returns false if the assignment would cause invalid geometry (e.g., index crossing over pinky,
 * thumb crossing above middle finger).
 * 
 * @param handState - Current state of the hand
 * @param newAssignment - The new finger assignment {finger: FingerType, pos: GridPos}
 * @param handSide - Which hand (left or right)
 * @returns true if the assignment is geometrically valid, false otherwise
 */
export function isValidFingerOrder(
  handState: HandState,
  newAssignment: { finger: FingerType; pos: GridPos },
  handSide: 'left' | 'right'
): boolean {
  const { finger: newFinger, pos: newPos } = newAssignment;
  
  // Create a temporary hand state with the new assignment
  const tempFingers: Record<FingerType, FingerState> = {
    ...handState.fingers,
    [newFinger]: {
      currentGridPos: newPos,
      fatigueLevel: handState.fingers[newFinger].fatigueLevel
    }
  };

  // Get all finger positions (including the new assignment)
  const thumbPos = tempFingers.thumb.currentGridPos;
  const indexPos = tempFingers.index.currentGridPos;
  const middlePos = tempFingers.middle.currentGridPos;
  const ringPos = tempFingers.ring.currentGridPos;
  const pinkyPos = tempFingers.pinky.currentGridPos;

  // Rule 1: Thumb and Pinky ordering
  // For right hand: thumb should be left (lower col) or bottom (lower row) of pinky
  // For left hand: thumb should be right (higher col) or bottom (lower row) of pinky
  if (thumbPos && pinkyPos) {
    if (handSide === 'right') {
      if (thumbPos[1] >= pinkyPos[1] && thumbPos[0] >= pinkyPos[0]) {
        return false; // Thumb is to the right and above pinky (invalid)
      }
    } else {
      // left hand
      if (thumbPos[1] <= pinkyPos[1] && thumbPos[0] >= pinkyPos[0]) {
        return false; // Thumb is to the left and above pinky (invalid)
      }
    }
  }

  // Rule 2: Index should not cross over pinky
  // For right hand: index should be to the right (higher col) of pinky
  // For left hand: index should be to the left (lower col) of pinky
  if (indexPos && pinkyPos) {
    if (handSide === 'right') {
      if (indexPos[1] < pinkyPos[1]) {
        return false; // Index is to the left of pinky (crossed over)
      }
    } else {
      // left hand
      if (indexPos[1] > pinkyPos[1]) {
        return false; // Index is to the right of pinky (crossed over)
      }
    }
  }

  // Rule 3: Thumb should not cross above middle finger
  // Thumb should generally be at the same row or below middle finger
  if (thumbPos && middlePos) {
    if (thumbPos[0] > middlePos[0]) {
      return false; // Thumb is above middle finger (invalid)
    }
  }

  // Rule 4: Finger sequence ordering (index < middle < ring < pinky in column for right hand)
  // For right hand: fingers should be in order left to right (index, middle, ring, pinky)
  // For left hand: fingers should be in order right to left (pinky, ring, middle, index)
  const fingerSequence: FingerType[] = handSide === 'right' 
    ? ['index', 'middle', 'ring', 'pinky']
    : ['pinky', 'ring', 'middle', 'index'];

  for (let i = 0; i < fingerSequence.length - 1; i++) {
    const finger1 = fingerSequence[i];
    const finger2 = fingerSequence[i + 1];
    const pos1 = tempFingers[finger1].currentGridPos;
    const pos2 = tempFingers[finger2].currentGridPos;

    if (pos1 && pos2) {
      if (handSide === 'right') {
        // Right hand: each finger should be to the right (higher col) of the previous
        if (pos1[1] >= pos2[1]) {
          return false; // Fingers are out of order
        }
      } else {
        // Left hand: each finger should be to the left (lower col) of the previous
        if (pos1[1] <= pos2[1]) {
          return false; // Fingers are out of order
        }
      }
    }
  }

  return true; // All geometric constraints satisfied
}

/**
 * Finger assignment for a chord.
 */
export interface ChordFingerAssignment {
  finger: FingerType;
  pos: GridPos;
}

/**
 * Checks chord feasibility and returns valid finger combinations.
 * Rejects combinations that require overlapping fingers or impossible spans.
 * 
 * @param notes - Array of note positions [row, col] in the chord
 * @param handSide - Which hand (left or right)
 * @param constants - Engine constants (defaults to DEFAULT_ENGINE_CONSTANTS)
 * @returns Array of valid finger assignment combinations, or empty array if no valid combination exists
 */
export function checkChordFeasibility(
  notes: GridPos[],
  handSide: 'left' | 'right',
  constants: typeof DEFAULT_ENGINE_CONSTANTS = DEFAULT_ENGINE_CONSTANTS
): ChordFingerAssignment[][] {
  if (notes.length === 0) {
    return [];
  }

  // If more notes than fingers, chord is impossible
  if (notes.length > 5) {
    return [];
  }

  const allFingers: FingerType[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
  const validCombinations: ChordFingerAssignment[][] = [];

  // Generate all possible finger-to-note assignments
  // We'll use a recursive approach to generate permutations
  function generateAssignments(
    remainingNotes: GridPos[],
    remainingFingers: FingerType[],
    currentAssignment: ChordFingerAssignment[]
  ): void {
    // Base case: all notes assigned
    if (remainingNotes.length === 0) {
      // Check if this assignment is valid
      if (isChordAssignmentValid(currentAssignment, handSide, constants)) {
        validCombinations.push([...currentAssignment]);
      }
      return;
    }

    // Try assigning each remaining finger to the first remaining note
    for (let i = 0; i < remainingFingers.length; i++) {
      const finger = remainingFingers[i];
      const note = remainingNotes[0];
      
      const newAssignment: ChordFingerAssignment[] = [
        ...currentAssignment,
        { finger, pos: note }
      ];

      // Recursively assign remaining notes to remaining fingers
      generateAssignments(
        remainingNotes.slice(1),
        [...remainingFingers.slice(0, i), ...remainingFingers.slice(i + 1)],
        newAssignment
      );
    }
  }

  generateAssignments(notes, allFingers, []);

  return validCombinations;
}

/**
 * Helper function to check if a chord assignment is valid.
 * Checks for overlapping fingers and impossible spans.
 */
function isChordAssignmentValid(
  assignment: ChordFingerAssignment[],
  handSide: 'left' | 'right',
  constants: typeof DEFAULT_ENGINE_CONSTANTS
): boolean {
  // Check 1: No overlapping fingers (same position)
  const positions = new Set<string>();
  for (const { pos } of assignment) {
    const posKey = `${pos[0]},${pos[1]}`;
    if (positions.has(posKey)) {
      return false; // Overlapping fingers
    }
    positions.add(posKey);
  }

  // Check 2: Span width is within limits
  const thumbAssignment = assignment.find(a => a.finger === 'thumb');
  const pinkyAssignment = assignment.find(a => a.finger === 'pinky');

  if (thumbAssignment && pinkyAssignment) {
    const spanDistance = calculateDistance(thumbAssignment.pos, pinkyAssignment.pos);
    if (spanDistance > constants.maxSpan) {
      return false; // Span too wide
    }
  }

  // Check 3: Finger ordering is valid
  // Create a temporary hand state for validation
  const tempHandState: HandState = {
    fingers: {
      thumb: { currentGridPos: null, fatigueLevel: 0 },
      index: { currentGridPos: null, fatigueLevel: 0 },
      middle: { currentGridPos: null, fatigueLevel: 0 },
      ring: { currentGridPos: null, fatigueLevel: 0 },
      pinky: { currentGridPos: null, fatigueLevel: 0 },
    },
    centerOfGravity: null,
    spanWidth: 0,
  };

  // Apply all assignments to temp hand state
  for (const { finger, pos } of assignment) {
    tempHandState.fingers[finger].currentGridPos = pos;
  }

  // Check each assignment for valid finger order
  for (const { finger, pos } of assignment) {
    if (!isValidFingerOrder(tempHandState, { finger, pos }, handSide)) {
      return false; // Invalid finger ordering
    }
  }

  return true; // All checks passed
}

