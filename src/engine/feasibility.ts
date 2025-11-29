/**
 * Geometric feasibility checks for the biomechanical hand model.
 * Implements hard physical constraints that must be satisfied.
 * 
 * Includes Constraint Logic Programming (CLP) based grip generation
 * for the Beam Search solver.
 */

import { GridPosition, calculateGridDistance } from './gridMath';
import { FingerID } from '../types/engine';
import { Hand, MAX_HAND_SPAN, MAX_REACH_GRID_UNITS } from './ergonomics';
import { FingerType, FingerState, HandState, DEFAULT_ENGINE_CONSTANTS } from './models';
import { FingerCoordinate, HandPose } from '../types/performance';

// ============================================================================
// Pad Type Definition
// ============================================================================

/**
 * Pad: Represents a physical pad coordinate on the 8x8 Push grid.
 * Row 0 is bottom, Row 7 is top. Col 0 is left, Col 7 is right.
 */
export interface Pad {
  row: number;
  col: number;
}

// ============================================================================
// Constraint Constants for Valid Grip Generation
// ============================================================================

/**
 * Tier 1 (Strict): Maximum Euclidean distance between any two active fingers.
 * Based on biomechanical hand span limits (~5.5 grid units).
 */
const MAX_FINGER_SPAN_STRICT = 5.5;

/**
 * Tier 2 (Relaxed): Extended maximum span for difficult chords.
 * Allows slightly wider reach for complex chord shapes.
 */
const MAX_FINGER_SPAN_RELAXED = 7.5;

/**
 * Delta tolerance for thumb position relative to index finger.
 * Allows thumb to be slightly beyond index in X direction.
 */
const THUMB_DELTA = 1.0;

/**
 * Relaxed delta for Tier 2 constraints.
 */
const THUMB_DELTA_RELAXED = 2.0;

/**
 * Ordered list of fingers for constraint checking.
 * Order: pinky (0) -> ring (1) -> middle (2) -> index (3) -> thumb (4)
 */
const FINGER_ORDER: FingerType[] = ['pinky', 'ring', 'middle', 'index', 'thumb'];

/**
 * Constraint tier for grip generation.
 */
export type ConstraintTier = 'strict' | 'relaxed' | 'fallback';

/**
 * Extended HandPose that includes metadata about constraint tier used.
 */
export interface GripResult {
  /** The hand pose/grip */
  pose: HandPose;
  /** Which constraint tier was used to generate this grip */
  tier: ConstraintTier;
  /** True if this is a fallback grip that ignores constraints */
  isFallback: boolean;
}

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
 * Calculates the Euclidean distance between two grid positions.
 * Uses GridPosition (object-based) for consistency.
 * 
 * @param start - Starting position
 * @param end - Ending position
 * @returns The Euclidean distance between the two points
 */
function calculateDistance(start: GridPosition, end: GridPosition): number {
  return calculateGridDistance(start, end);
}

/**
 * Checks if a reach from start to end position is possible for a given finger.
 * Returns false if the distance exceeds the maximum reach constant.
 * 
 * @param start - Starting position (object-based)
 * @param end - Ending position (object-based)
 * @param finger - The finger type attempting the reach
 * @param constants - Engine constants (defaults to DEFAULT_ENGINE_CONSTANTS)
 * @returns true if the reach is possible, false if distance exceeds max reach
 */
export function isReachPossible(
  start: GridPosition,
  end: GridPosition,
  finger: FingerType,
  constants: typeof DEFAULT_ENGINE_CONSTANTS = DEFAULT_ENGINE_CONSTANTS
): boolean {
  const distance = calculateGridDistance(start, end);
  
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
 * @param newAssignment - The new finger assignment {finger: FingerType, pos: GridPosition}
 * @param handSide - Which hand (left or right)
 * @returns true if the assignment is geometrically valid, false otherwise
 */
export function isValidFingerOrder(
  handState: HandState,
  newAssignment: { finger: FingerType; pos: GridPosition },
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
      if (thumbPos.col >= pinkyPos.col && thumbPos.row >= pinkyPos.row) {
        return false; // Thumb is to the right and above pinky (invalid)
      }
    } else {
      // left hand
      if (thumbPos.col <= pinkyPos.col && thumbPos.row >= pinkyPos.row) {
        return false; // Thumb is to the left and above pinky (invalid)
      }
    }
  }

  // Rule 2: Index should not cross over pinky
  // For right hand: index should be to the right (higher col) of pinky
  // For left hand: index should be to the left (lower col) of pinky
  if (indexPos && pinkyPos) {
    if (handSide === 'right') {
      if (indexPos.col < pinkyPos.col) {
        return false; // Index is to the left of pinky (crossed over)
      }
    } else {
      // left hand
      if (indexPos.col > pinkyPos.col) {
        return false; // Index is to the right of pinky (crossed over)
      }
    }
  }

  // Rule 3: Thumb should not cross above middle finger
  // Thumb should generally be at the same row or below middle finger
  if (thumbPos && middlePos) {
    if (thumbPos.row > middlePos.row) {
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
        if (pos1.col >= pos2.col) {
          return false; // Fingers are out of order
        }
      } else {
        // Left hand: each finger should be to the left (lower col) of the previous
        if (pos1.col <= pos2.col) {
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
  pos: GridPosition;
}

/**
 * Checks chord feasibility and returns valid finger combinations.
 * Rejects combinations that require overlapping fingers or impossible spans.
 * 
 * @param notes - Array of note positions (object-based) in the chord
 * @param handSide - Which hand (left or right)
 * @param constants - Engine constants (defaults to DEFAULT_ENGINE_CONSTANTS)
 * @returns Array of valid finger assignment combinations, or empty array if no valid combination exists
 */
export function checkChordFeasibility(
  notes: GridPosition[],
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
    remainingNotes: GridPosition[],
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
    const posKey = `${pos.row},${pos.col}`;
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

// ============================================================================
// Valid Grip Generator (Constraint Logic Programming Approach)
// ============================================================================

/**
 * Converts a Pad coordinate to a FingerCoordinate.
 * Pad uses {row, col}, FingerCoordinate uses {x, y} where x=col, y=row.
 */
function padToFingerCoordinate(pad: Pad): FingerCoordinate {
  return { x: pad.col, y: pad.row };
}

/**
 * Calculates Euclidean distance between two FingerCoordinates.
 */
function fingerDistance(a: FingerCoordinate, b: FingerCoordinate): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Checks if the span constraint is satisfied.
 * Constraint: The Euclidean distance between any two active fingers
 * must not exceed the specified max span.
 * 
 * @param fingerPositions - Map of finger types to their coordinates
 * @param maxSpan - Maximum allowed span (default: strict limit)
 * @returns true if all pairwise distances are within the span limit
 */
function satisfiesSpanConstraint(
  fingerPositions: Partial<Record<FingerType, FingerCoordinate>>,
  maxSpan: number = MAX_FINGER_SPAN_STRICT
): boolean {
  const entries = Object.entries(fingerPositions) as [FingerType, FingerCoordinate][];
  
  // Check all pairs of fingers
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [, posA] = entries[i];
      const [, posB] = entries[j];
      
      const distance = fingerDistance(posA, posB);
      if (distance > maxSpan) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Checks if the topological constraint is satisfied for the LEFT hand.
 * Left hand ordering (left-to-right on grid): pinky <= ring <= middle <= index <= thumb + delta
 * 
 * This enforces natural finger ordering where fingers don't cross over each other.
 * 
 * @param fingerPositions - Map of finger types to their coordinates
 * @param thumbDelta - Tolerance for thumb position (default: strict)
 * @param allowOverlap - If true, allows fingers at the same X position
 * @returns true if the left-to-right ordering is valid for a left hand
 */
function satisfiesLeftHandTopology(
  fingerPositions: Partial<Record<FingerType, FingerCoordinate>>,
  thumbDelta: number = THUMB_DELTA,
  allowOverlap: boolean = false
): boolean {
  // Get X positions for each finger that is assigned
  const xPositions: { finger: FingerType; x: number }[] = [];
  
  for (const finger of FINGER_ORDER) {
    const pos = fingerPositions[finger];
    if (pos !== undefined) {
      xPositions.push({ finger, x: pos.x });
    }
  }
  
  // Check ordering: for left hand, fingers should be ordered left-to-right
  // in the sequence: pinky, ring, middle, index, thumb
  for (let i = 0; i < xPositions.length - 1; i++) {
    const current = xPositions[i];
    const next = xPositions[i + 1];
    
    // Get the expected order indices
    const currentOrderIndex = FINGER_ORDER.indexOf(current.finger);
    const nextOrderIndex = FINGER_ORDER.indexOf(next.finger);
    
    // If current finger should be "before" next in the ordering
    if (currentOrderIndex < nextOrderIndex) {
      // For left hand: earlier fingers (pinky side) should have x <= later fingers (thumb side)
      // Allow thumb to be slightly beyond index with delta tolerance
      const delta = next.finger === 'thumb' ? thumbDelta : (allowOverlap ? 0.5 : 0);
      if (current.x > next.x + delta) {
        return false; // Ordering violated
      }
    } else {
      // currentOrderIndex > nextOrderIndex (shouldn't happen with sorted input, but handle it)
      const delta = current.finger === 'thumb' ? thumbDelta : (allowOverlap ? 0.5 : 0);
      if (next.x > current.x + delta) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Checks if the topological constraint is satisfied for the RIGHT hand.
 * Right hand ordering (left-to-right on grid): thumb - delta <= index <= middle <= ring <= pinky
 * 
 * This is the inverse of the left hand ordering.
 * 
 * @param fingerPositions - Map of finger types to their coordinates
 * @param thumbDelta - Tolerance for thumb position (default: strict)
 * @param allowOverlap - If true, allows fingers at the same X position
 * @returns true if the left-to-right ordering is valid for a right hand
 */
function satisfiesRightHandTopology(
  fingerPositions: Partial<Record<FingerType, FingerCoordinate>>,
  thumbDelta: number = THUMB_DELTA,
  allowOverlap: boolean = false
): boolean {
  // Get X positions for each finger that is assigned
  const xPositions: { finger: FingerType; x: number }[] = [];
  
  for (const finger of FINGER_ORDER) {
    const pos = fingerPositions[finger];
    if (pos !== undefined) {
      xPositions.push({ finger, x: pos.x });
    }
  }
  
  // Check ordering: for right hand, fingers should be ordered right-to-left
  // in the sequence: pinky, ring, middle, index, thumb
  // i.e., pinky has highest x, thumb has lowest x
  for (let i = 0; i < xPositions.length - 1; i++) {
    const current = xPositions[i];
    const next = xPositions[i + 1];
    
    // Get the expected order indices
    const currentOrderIndex = FINGER_ORDER.indexOf(current.finger);
    const nextOrderIndex = FINGER_ORDER.indexOf(next.finger);
    
    // For right hand: earlier fingers (pinky side) should have x >= later fingers (thumb side)
    if (currentOrderIndex < nextOrderIndex) {
      // Current is "before" next in ordering (pinky side)
      // For right hand: pinky should be to the right (higher x) of thumb
      const delta = next.finger === 'thumb' ? thumbDelta : (allowOverlap ? 0.5 : 0);
      if (current.x < next.x - delta) {
        return false; // Ordering violated
      }
    } else {
      const delta = current.finger === 'thumb' ? thumbDelta : (allowOverlap ? 0.5 : 0);
      if (next.x < current.x - delta) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Calculates the centroid (center of mass) of a set of finger positions.
 * 
 * @param fingerPositions - Map of finger types to their coordinates
 * @returns The centroid coordinate
 */
function calculateCentroid(
  fingerPositions: Partial<Record<FingerType, FingerCoordinate>>
): FingerCoordinate {
  const positions = Object.values(fingerPositions);
  
  if (positions.length === 0) {
    return { x: 3.5, y: 3.5 }; // Center of grid as default
  }
  
  const sumX = positions.reduce((sum, pos) => sum + pos.x, 0);
  const sumY = positions.reduce((sum, pos) => sum + pos.y, 0);
  
  return {
    x: sumX / positions.length,
    y: sumY / positions.length,
  };
}

/**
 * Internal function to generate grips with configurable constraints.
 * 
 * @param activePads - Array of Pad coordinates that need to be pressed
 * @param hand - Which hand ('left' or 'right')
 * @param maxSpan - Maximum allowed finger span
 * @param thumbDelta - Thumb position tolerance
 * @param allowOverlap - Allow slight topology overlap
 * @returns Array of valid HandPose objects
 */
function generateGripsWithConstraints(
  activePads: Pad[],
  hand: 'left' | 'right',
  maxSpan: number,
  thumbDelta: number,
  allowOverlap: boolean
): HandPose[] {
  if (activePads.length === 0) {
    return [];
  }
  
  // Cannot play more than 5 pads with one hand (5 fingers max)
  if (activePads.length > 5) {
    return [];
  }
  
  const validGrips: HandPose[] = [];
  const availableFingers: FingerType[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
  
  // Convert pads to finger coordinates
  const padCoords = activePads.map(padToFingerCoordinate);
  
  function generatePermutations(
    padIndex: number,
    remainingFingers: FingerType[],
    currentAssignment: Partial<Record<FingerType, FingerCoordinate>>
  ): void {
    // Base case: all pads assigned
    if (padIndex === padCoords.length) {
      // Validate the complete assignment against constraints
      if (!satisfiesSpanConstraint(currentAssignment, maxSpan)) {
        return; // Span constraint violated
      }
      
      const topologyValid = hand === 'left'
        ? satisfiesLeftHandTopology(currentAssignment, thumbDelta, allowOverlap)
        : satisfiesRightHandTopology(currentAssignment, thumbDelta, allowOverlap);
      
      if (!topologyValid) {
        return; // Topological constraint violated
      }
      
      // All constraints satisfied - create HandPose
      const centroid = calculateCentroid(currentAssignment);
      const handPose: HandPose = {
        centroid,
        fingers: { ...currentAssignment },
      };
      
      validGrips.push(handPose);
      return;
    }
    
    // Recursive case: try assigning each remaining finger to current pad
    const currentPadCoord = padCoords[padIndex];
    
    for (let i = 0; i < remainingFingers.length; i++) {
      const finger = remainingFingers[i];
      
      // Create new assignment with this finger
      const newAssignment: Partial<Record<FingerType, FingerCoordinate>> = {
        ...currentAssignment,
        [finger]: currentPadCoord,
      };
      
      // Early pruning: check span constraint incrementally
      let valid = true;
      for (const [, existingPos] of Object.entries(currentAssignment)) {
        if (fingerDistance(existingPos, currentPadCoord) > maxSpan) {
          valid = false;
          break;
        }
      }
      
      if (!valid) {
        continue; // Skip this branch - span already violated
      }
      
      // Remove this finger from available fingers for next level
      const newRemainingFingers = [
        ...remainingFingers.slice(0, i),
        ...remainingFingers.slice(i + 1),
      ];
      
      // Recurse
      generatePermutations(padIndex + 1, newRemainingFingers, newAssignment);
    }
  }
  
  // Start the recursive generation
  generatePermutations(0, availableFingers, {});
  
  return validGrips;
}

/**
 * Creates a fallback grip by assigning fingers by proximity.
 * This ignores all biomechanical constraints and just assigns fingers
 * in order of their natural position (left-to-right for right hand, vice versa).
 * 
 * @param activePads - Array of Pad coordinates
 * @param hand - Which hand
 * @returns A fallback HandPose
 */
function createFallbackGrip(
  activePads: Pad[],
  hand: 'left' | 'right'
): HandPose {
  // Sort pads by x coordinate (column)
  const sortedPads = [...activePads].sort((a, b) => {
    // For left hand: assign from left to right (pinky on left, thumb on right)
    // For right hand: assign from right to left (pinky on right, thumb on left)
    return hand === 'left' ? a.col - b.col : b.col - a.col;
  });
  
  // Available fingers in order: prefer strong fingers first
  const fingerPriority: FingerType[] = ['index', 'middle', 'ring', 'thumb', 'pinky'];
  
  const fingers: Partial<Record<FingerType, FingerCoordinate>> = {};
  
  for (let i = 0; i < sortedPads.length && i < fingerPriority.length; i++) {
    const pad = sortedPads[i];
    const finger = fingerPriority[i];
    fingers[finger] = padToFingerCoordinate(pad);
  }
  
  const centroid = calculateCentroid(fingers);
  
  return {
    centroid,
    fingers,
  };
}

/**
 * Generates all valid hand grips for a given set of active pads.
 * Uses a tiered constraint system to ALWAYS return at least one grip.
 * 
 * **Tiered Approach:**
 * - **Tier 1 (Strict):** Standard constraints (span < 5.5, strict topology)
 * - **Tier 2 (Relaxed):** Extended span (< 7.5), allow slight topology overlap
 * - **Tier 3 (Fallback):** Ignore constraints, assign by proximity
 * 
 * @param activePads - Array of Pad coordinates that need to be pressed
 * @param hand - Which hand ('left' or 'right')
 * @returns Array of valid HandPose objects (NEVER empty)
 */
export function generateValidGrips(
  activePads: Pad[],
  hand: 'left' | 'right'
): HandPose[] {
  // Edge case: no pads
  if (activePads.length === 0) {
    return [];
  }
  
  // Tier 1: Strict constraints
  const tier1Results = generateGripsWithConstraints(
    activePads,
    hand,
    MAX_FINGER_SPAN_STRICT,
    THUMB_DELTA,
    false
  );
  
  if (tier1Results.length > 0) {
    return tier1Results;
  }
  
  // Tier 2: Relaxed constraints
  const tier2Results = generateGripsWithConstraints(
    activePads,
    hand,
    MAX_FINGER_SPAN_RELAXED,
    THUMB_DELTA_RELAXED,
    true
  );
  
  if (tier2Results.length > 0) {
    return tier2Results;
  }
  
  // Tier 3: Fallback - create a best-effort grip
  const fallbackGrip = createFallbackGrip(activePads, hand);
  return [fallbackGrip];
}

/**
 * Generates valid grips with GripResult metadata indicating which tier was used.
 * This is useful for applying penalties to relaxed/fallback grips.
 * 
 * @param activePads - Array of Pad coordinates
 * @param hand - Which hand ('left' or 'right')
 * @returns Array of GripResult objects with tier metadata
 */
export function generateValidGripsWithTier(
  activePads: Pad[],
  hand: 'left' | 'right'
): GripResult[] {
  // Edge case: no pads
  if (activePads.length === 0) {
    return [];
  }
  
  // Tier 1: Strict constraints
  const tier1Results = generateGripsWithConstraints(
    activePads,
    hand,
    MAX_FINGER_SPAN_STRICT,
    THUMB_DELTA,
    false
  );
  
  if (tier1Results.length > 0) {
    return tier1Results.map(pose => ({
      pose,
      tier: 'strict' as ConstraintTier,
      isFallback: false,
    }));
  }
  
  // Tier 2: Relaxed constraints
  const tier2Results = generateGripsWithConstraints(
    activePads,
    hand,
    MAX_FINGER_SPAN_RELAXED,
    THUMB_DELTA_RELAXED,
    true
  );
  
  if (tier2Results.length > 0) {
    return tier2Results.map(pose => ({
      pose,
      tier: 'relaxed' as ConstraintTier,
      isFallback: false,
    }));
  }
  
  // Tier 3: Fallback
  const fallbackGrip = createFallbackGrip(activePads, hand);
  return [{
    pose: fallbackGrip,
    tier: 'fallback' as ConstraintTier,
    isFallback: true,
  }];
}

/**
 * Generates valid grips using GridPosition format (for compatibility with existing code).
 * This is a convenience wrapper around generateValidGrips.
 * 
 * @param positions - Array of GridPosition coordinates
 * @param hand - Which hand ('left' or 'right')
 * @returns Array of valid HandPose objects
 */
export function generateValidGripsFromPositions(
  positions: GridPosition[],
  hand: 'left' | 'right'
): HandPose[] {
  // Convert GridPosition to Pad format
  const pads: Pad[] = positions.map(pos => ({
    row: pos.row,
    col: pos.col,
  }));
  
  return generateValidGrips(pads, hand);
}

