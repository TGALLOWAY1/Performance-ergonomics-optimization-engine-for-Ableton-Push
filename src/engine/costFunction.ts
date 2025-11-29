/**
 * Weighted cost calculators for the Performability Engine.
 * These functions calculate various cost components used in evaluating
 * candidate finger assignments for notes.
 * 
 * Includes:
 * - Legacy HandState-based costs (movement, stretch, drift, crossover)
 * - New HandPose-based costs (attractor, transition) for Beam Search solver
 */

import { FingerType, HandState, DEFAULT_ENGINE_CONSTANTS } from './models';
import { GridPosition, calculateGridDistance } from './gridMath';
import { FingerCoordinate, HandPose } from '../types/performance';

// ============================================================================
// Constants for Beam Search Solver (Attractor Model)
// ============================================================================

/**
 * Maximum physiological hand movement speed in grid units per second.
 * Based on Fitts's Law research - typical peak hand speed ~30-50 cm/s.
 * Mapped to grid: ~8-12 grid units/second for rapid movements.
 */
export const MAX_HAND_SPEED = 12.0;

/**
 * Weight factor for speed component in transition cost.
 * Higher values penalize fast movements more heavily.
 */
export const SPEED_COST_WEIGHT = 0.5;

/**
 * Minimum time delta to prevent division by zero.
 * Very small time deltas indicate simultaneous notes (chords).
 */
const MIN_TIME_DELTA = 0.001;

/**
 * Penalty applied to fallback grips that ignore biomechanical constraints.
 * This massive penalty ensures fallback grips are only used as a last resort.
 */
export const FALLBACK_GRIP_PENALTY = 1000;

/**
 * Calculates the Euclidean distance between two grid positions.
 * Uses GridPosition (object-based) for consistency.
 * 
 * @param from - Starting position
 * @param to - Ending position
 * @returns The Euclidean distance between the two points
 */
function calculateDistance(from: GridPosition, to: GridPosition): number {
  return calculateGridDistance(from, to);
}

/**
 * Calculates movement cost for a finger moving from one position to another.
 * Cost = Euclidean distance * finger strength weight.
 * Pinky moves are expensive (weight = 2.5), index moves are baseline (weight = 1.0).
 * 
 * @param from - Starting position (object-based), or null if finger is not placed
 * @param to - Target position (object-based)
 * @param finger - The finger type making the movement
 * @param constants - Engine constants (defaults to DEFAULT_ENGINE_CONSTANTS)
 * @returns The movement cost (distance * finger weight)
 */
export function calculateMovementCost(
  from: GridPosition | null,
  to: GridPosition,
  finger: FingerType,
  constants: typeof DEFAULT_ENGINE_CONSTANTS = DEFAULT_ENGINE_CONSTANTS
): number {
  // If finger is not placed, apply activation cost
  if (from === null) {
    return constants.activationCost;
  }

  const distance = calculateDistance(from, to);
  const fingerWeight = constants.fingerStrengthWeights[finger];

  return distance * fingerWeight;
}

/**
 * Calculates the center of gravity for a hand state.
 * CoG is the average position of all placed fingers.
 * 
 * @param handState - The current hand state
 * @returns The center of gravity (object-based), or null if no fingers are placed
 */
function calculateCenterOfGravity(handState: HandState): GridPosition | null {
  const placedFingers: GridPosition[] = [];

  for (const fingerType of ['thumb', 'index', 'middle', 'ring', 'pinky'] as FingerType[]) {
    const pos = handState.fingers[fingerType].currentGridPos;
    if (pos !== null) {
      placedFingers.push(pos);
    }
  }

  if (placedFingers.length === 0) {
    return null;
  }

  // Calculate average position
  const sumRow = placedFingers.reduce((sum, pos) => sum + pos.row, 0);
  const sumCol = placedFingers.reduce((sum, pos) => sum + pos.col, 0);

  return {
    row: sumRow / placedFingers.length,
    col: sumCol / placedFingers.length
  };
}

/**
 * Calculates the span width of a hand (distance between thumb and pinky).
 * 
 * @param handState - The current hand state
 * @returns The span width in grid cells, or 0 if thumb or pinky is not placed
 */
function calculateSpanWidth(handState: HandState): number {
  const thumbPos = handState.fingers.thumb.currentGridPos;
  const pinkyPos = handState.fingers.pinky.currentGridPos;

  if (thumbPos === null || pinkyPos === null) {
    return 0;
  }

  return calculateGridDistance(thumbPos, pinkyPos);
}

/**
 * Calculates stretch penalty if the move expands the hand's total span beyond comfort zone.
 * Uses a non-linear penalty function that increases exponentially as span exceeds idealReach.
 * 
 * @param handState - Current hand state
 * @param newPos - New position being considered (object-based)
 * @param finger - The finger type being assigned to newPos
 * @param constants - Engine constants (defaults to DEFAULT_ENGINE_CONSTANTS)
 * @returns The stretch penalty (0 if within comfort zone, non-linear penalty if beyond)
 */
export function calculateStretchPenalty(
  handState: HandState,
  newPos: GridPosition,
  finger: FingerType,
  constants: typeof DEFAULT_ENGINE_CONSTANTS = DEFAULT_ENGINE_CONSTANTS
): number {
  // Create a temporary hand state with the new assignment
  const tempHandState: HandState = {
    ...handState,
    fingers: {
      ...handState.fingers,
      [finger]: {
        currentGridPos: newPos,
        fatigueLevel: handState.fingers[finger].fatigueLevel
      }
    }
  };

  // Calculate the new span width
  const newSpan = calculateSpanWidth(tempHandState);

  // If span is within comfort zone (idealReach), no penalty
  if (newSpan <= constants.idealReach) {
    return 0;
  }

  // Non-linear penalty: exponential increase as span exceeds comfort zone
  const excessSpan = newSpan - constants.idealReach;
  const maxExcess = constants.maxSpan - constants.idealReach;

  // Normalize excess (0 to 1)
  const normalizedExcess = Math.min(excessSpan / maxExcess, 1.0);

  // Exponential penalty: penalty = excess^2 * 10
  // This makes larger spans exponentially more expensive
  const penalty = Math.pow(normalizedExcess, 2) * 10;

  return penalty;
}

/**
 * Calculates drift penalty based on distance of the hand's Center of Gravity
 * from the section's home position (e.g., bottomLeftNote or defined home position).
 * 
 * @param handState - Current hand state
 * @param homePos - Home position (object-based) (e.g., position of bottomLeftNote)
 * @param constants - Engine constants (defaults to DEFAULT_ENGINE_CONSTANTS)
 * @returns The drift penalty (0 if CoG is at home, increasing with distance)
 */
export function calculateDriftPenalty(
  handState: HandState,
  homePos: GridPosition,
  constants: typeof DEFAULT_ENGINE_CONSTANTS = DEFAULT_ENGINE_CONSTANTS
): number {
  // Calculate current center of gravity
  const cog = calculateCenterOfGravity(handState);

  // If no fingers are placed, no drift penalty
  if (cog === null) {
    return 0;
  }

  // Calculate distance from CoG to home position
  const distance = calculateDistance(cog, homePos);

  // Linear penalty: drift penalty increases linearly with distance
  // Penalty = distance * 0.5 (adjustable multiplier)
  const driftMultiplier = 0.5;
  return distance * driftMultiplier;
}

/**
 * Note-to-finger assignment history for tracking finger bounce.
 * Maps note numbers to the finger that last played them.
 */
interface NoteFingerHistory {
  [noteNumber: number]: {
    finger: FingerType;
    timestamp: number; // Time when note was played (for recency weighting)
  };
}

/**
 * Global history tracker (could be made stateful in a real implementation).
 * In a full implementation, this would be passed as a parameter or stored in engine state.
 */
let noteHistory: NoteFingerHistory = {};

/**
 * Clears the note-to-finger history.
 * Useful for resetting between performances or sections.
 */
export function clearNoteHistory(): void {
  noteHistory = {};
}

/**
 * Records a note-to-finger assignment in history.
 * 
 * @param noteNumber - The MIDI note number
 * @param finger - The finger that played the note
 * @param timestamp - The time when the note was played (in seconds)
 */
export function recordNoteAssignment(noteNumber: number, finger: FingerType, timestamp: number): void {
  noteHistory[noteNumber] = { finger, timestamp };
}

/**
 * Gets the finger bounce penalty for a note.
 * Checks previous history; if this note was played by a different finger recently,
 * adds a penalty (Stickiness Heuristic - encourages using the same finger for the same note).
 * 
 * @param noteNumber - The MIDI note number
 * @param assignedFinger - The finger being assigned to play this note
 * @param currentTime - Current time in seconds (for recency weighting)
 * @param recencyWindow - Time window in seconds for considering history (default: 5.0)
 * @returns The bounce penalty (0 if same finger or no history, penalty if different finger recently)
 */
export function getFingerBouncePenalty(
  noteNumber: number,
  assignedFinger: FingerType,
  currentTime: number,
  recencyWindow: number = 5.0
): number {
  const history = noteHistory[noteNumber];

  // No history for this note, no penalty
  if (!history) {
    return 0;
  }

  // Same finger as before, no penalty (stickiness reward)
  if (history.finger === assignedFinger) {
    return 0;
  }

  // Different finger - check if it was recent
  const timeSinceLastPlay = currentTime - history.timestamp;

  // If outside recency window, no penalty (old history doesn't matter)
  if (timeSinceLastPlay > recencyWindow) {
    return 0;
  }

  // Calculate penalty based on recency
  // More recent = higher penalty (stronger stickiness)
  const recencyFactor = 1.0 - (timeSinceLastPlay / recencyWindow); // 1.0 = very recent, 0.0 = at window edge
  const basePenalty = 2.0; // Base penalty for switching fingers
  const penalty = basePenalty * recencyFactor;

  return penalty;
}

/**
 * Calculates penalty for geometric crossovers (e.g. index crossing over pinky).
 * Instead of hard rejection, we apply a penalty to discourage but allow it.
 * 
 * @param handState - Current hand state
 * @param newPos - New position being considered (object-based)
 * @param finger - The finger type being assigned to newPos
 * @param handSide - Which hand (left or right)
 * @param constants - Engine constants
 * @returns The crossover penalty (0 if no crossover)
 */
export function calculateCrossoverCost(
  handState: HandState,
  newPos: GridPosition,
  finger: FingerType,
  handSide: 'left' | 'right',
  constants: typeof DEFAULT_ENGINE_CONSTANTS = DEFAULT_ENGINE_CONSTANTS
): number {
  let penalty = 0;

  // Create a temporary hand state with the new assignment
  const tempFingers = {
    ...handState.fingers,
    [finger]: {
      currentGridPos: newPos,
      fatigueLevel: handState.fingers[finger].fatigueLevel
    }
  };

  const thumbPos = tempFingers.thumb.currentGridPos;
  const indexPos = tempFingers.index.currentGridPos;
  const middlePos = tempFingers.middle.currentGridPos;
  const pinkyPos = tempFingers.pinky.currentGridPos;

  // Rule 1: Thumb and Pinky ordering
  if (thumbPos && pinkyPos) {
    if (handSide === 'right') {
      if (thumbPos.col >= pinkyPos.col && thumbPos.row >= pinkyPos.row) {
        penalty += constants.crossoverPenaltyWeight * 2; // Strong penalty for extreme crossover
      }
    } else {
      // left hand
      if (thumbPos.col <= pinkyPos.col && thumbPos.row >= pinkyPos.row) {
        penalty += constants.crossoverPenaltyWeight * 2;
      }
    }
  }

  // Rule 2: Index should not cross over pinky
  if (indexPos && pinkyPos) {
    if (handSide === 'right') {
      if (indexPos.col < pinkyPos.col) {
        penalty += constants.crossoverPenaltyWeight;
      }
    } else {
      // left hand
      if (indexPos.col > pinkyPos.col) {
        penalty += constants.crossoverPenaltyWeight;
      }
    }
  }

  // Rule 3: Thumb should not cross above middle finger
  if (thumbPos && middlePos) {
    if (thumbPos.row > middlePos.row) {
      penalty += constants.crossoverPenaltyWeight;
    }
  }

  // Rule 4: Finger sequence ordering
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
        if (pos1.col >= pos2.col) {
          penalty += constants.crossoverPenaltyWeight;
        }
      } else {
        if (pos1.col <= pos2.col) {
          penalty += constants.crossoverPenaltyWeight;
        }
      }
    }
  }

  return penalty;
}

// ============================================================================
// HandPose-Based Cost Functions (Beam Search Solver)
// ============================================================================

/**
 * Calculates the Euclidean distance between two FingerCoordinates.
 * 
 * @param a - First coordinate
 * @param b - Second coordinate
 * @returns Euclidean distance
 */
function fingerCoordinateDistance(a: FingerCoordinate, b: FingerCoordinate): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates the "attractor" cost for a hand pose.
 * 
 * The attractor model represents the natural tendency of hands to return
 * to a resting position. The further a hand moves from its resting pose,
 * the more "energy" is required to maintain that position.
 * 
 * This implements a spring-like force: Cost = distance * stiffness
 * 
 * @param current - Current hand pose (centroid and finger positions)
 * @param resting - Resting/home hand pose (the "attractor" position)
 * @param stiffness - Spring stiffness coefficient (alpha). Range 0-1.
 *                    Higher values = stronger pull back to resting position.
 * @returns The attractor cost (0 if at resting position, increases with distance)
 * 
 * @example
 * // Hand at resting position - zero cost
 * const cost = calculateAttractorCost(restingPose, restingPose, 0.3);
 * // cost === 0
 * 
 * @example
 * // Hand 4 units away from resting with stiffness 0.3
 * // cost = 4 * 0.3 = 1.2
 */
export function calculateAttractorCost(
  current: HandPose,
  resting: HandPose,
  stiffness: number
): number {
  // Calculate distance between current and resting centroids
  const distance = fingerCoordinateDistance(current.centroid, resting.centroid);
  
  // Attractor force: linear spring model
  // Cost increases linearly with distance from resting position
  return distance * stiffness;
}

/**
 * Calculates the transition cost for moving from one hand pose to another.
 * 
 * Implements Fitts's Law principles:
 * - Movement time (and thus cost) increases with distance
 * - Faster movements are more difficult and error-prone
 * - Movements exceeding physiological speed limits are impossible
 * 
 * The cost function is: distance + (speed * weight)
 * If the required speed exceeds MAX_HAND_SPEED, returns Infinity.
 * 
 * @param prev - Previous hand pose
 * @param curr - Current (target) hand pose
 * @param timeDelta - Time available for the transition in seconds
 * @returns The transition cost, or Infinity if movement is physically impossible
 * 
 * @example
 * // Slow movement (plenty of time)
 * const cost = calculateTransitionCost(prevPose, currPose, 0.5);
 * // Returns distance + modest speed penalty
 * 
 * @example
 * // Impossible movement (too fast)
 * const cost = calculateTransitionCost(farPose, currPose, 0.01);
 * // Returns Infinity if speed > MAX_HAND_SPEED
 */
export function calculateTransitionCost(
  prev: HandPose,
  curr: HandPose,
  timeDelta: number
): number {
  // SAFETY GUARD: For simultaneous notes (chords), treat as zero-cost transition
  // This prevents issues when timeDelta is 0 or near-zero
  if (timeDelta <= MIN_TIME_DELTA) {
    return 0;
  }
  
  // Calculate the distance the centroid moved
  const distance = fingerCoordinateDistance(prev.centroid, curr.centroid);
  
  // Handle edge case: no movement
  if (distance === 0) {
    return 0;
  }
  
  // Calculate required speed
  const speed = distance / timeDelta;
  
  // Physiological constraint: if speed exceeds maximum, movement is impossible
  if (speed > MAX_HAND_SPEED) {
    return Infinity;
  }
  
  // Fitts's Law-inspired cost: base distance + speed penalty
  // This makes fast movements proportionally more expensive
  const speedPenalty = speed * SPEED_COST_WEIGHT;
  
  return distance + speedPenalty;
}

/**
 * Calculates the static grip cost for a HandPose based on finger spread.
 * 
 * Evaluates the ergonomic difficulty of maintaining a hand shape by
 * measuring how far fingers are spread apart. Large spreads are uncomfortable.
 * 
 * @param pose - The hand pose to evaluate
 * @param idealSpan - The ideal/comfortable span distance (default: 2.0 grid units)
 * @param maxSpan - The maximum possible span (default: 5.5 grid units)
 * @returns The grip difficulty cost (0 for comfortable, higher for stretched)
 */
export function calculateGripStretchCost(
  pose: HandPose,
  idealSpan: number = 2.0,
  maxSpan: number = 5.5
): number {
  const fingerEntries = Object.entries(pose.fingers) as [FingerType, FingerCoordinate][];
  
  // Need at least 2 fingers to calculate span
  if (fingerEntries.length < 2) {
    return 0;
  }
  
  // Find maximum distance between any two fingers
  let maxDistance = 0;
  for (let i = 0; i < fingerEntries.length; i++) {
    for (let j = i + 1; j < fingerEntries.length; j++) {
      const [, posA] = fingerEntries[i];
      const [, posB] = fingerEntries[j];
      const dist = fingerCoordinateDistance(posA, posB);
      maxDistance = Math.max(maxDistance, dist);
    }
  }
  
  // If within ideal span, no penalty
  if (maxDistance <= idealSpan) {
    return 0;
  }
  
  // Non-linear penalty for excessive spread
  const excessSpan = maxDistance - idealSpan;
  const maxExcess = maxSpan - idealSpan;
  
  // Normalize and apply quadratic penalty
  const normalizedExcess = Math.min(excessSpan / maxExcess, 1.0);
  const penalty = Math.pow(normalizedExcess, 2) * 10;
  
  return penalty;
}

/**
 * Calculates the total biomechanical cost for a grip transition.
 * 
 * Combines multiple cost components:
 * 1. Transition cost (movement + speed)
 * 2. Attractor cost (distance from resting position)
 * 3. Grip stretch cost (finger spread difficulty)
 * 
 * @param prev - Previous hand pose
 * @param curr - Current hand pose
 * @param resting - Resting/home hand pose
 * @param timeDelta - Time available for transition in seconds
 * @param stiffness - Attractor stiffness coefficient
 * @returns Total cost, or Infinity if transition is impossible
 */
export function calculateTotalGripCost(
  prev: HandPose,
  curr: HandPose,
  resting: HandPose,
  timeDelta: number,
  stiffness: number
): number {
  // Calculate individual cost components
  const transitionCost = calculateTransitionCost(prev, curr, timeDelta);
  
  // If transition is impossible, return immediately
  if (transitionCost === Infinity) {
    return Infinity;
  }
  
  const attractorCost = calculateAttractorCost(curr, resting, stiffness);
  const stretchCost = calculateGripStretchCost(curr);
  
  // Combine costs with equal weighting
  // Could be extended with configurable weights
  return transitionCost + attractorCost + stretchCost;
}

/**
 * Converts a legacy HandState to a HandPose for compatibility.
 * 
 * @param handState - Legacy HandState object
 * @returns Equivalent HandPose object
 */
export function handStateToHandPose(handState: HandState): HandPose {
  const fingers: Partial<Record<FingerType, FingerCoordinate>> = {};
  
  // Convert each placed finger
  const fingerTypes: FingerType[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
  for (const fingerType of fingerTypes) {
    const gridPos = handState.fingers[fingerType].currentGridPos;
    if (gridPos !== null) {
      fingers[fingerType] = {
        x: gridPos.col,
        y: gridPos.row,
      };
    }
  }
  
  // Calculate centroid from placed fingers
  const placedPositions = Object.values(fingers);
  let centroid: FingerCoordinate;
  
  if (placedPositions.length > 0) {
    const sumX = placedPositions.reduce((sum, pos) => sum + pos.x, 0);
    const sumY = placedPositions.reduce((sum, pos) => sum + pos.y, 0);
    centroid = {
      x: sumX / placedPositions.length,
      y: sumY / placedPositions.length,
    };
  } else if (handState.centerOfGravity) {
    // Use existing CoG if available
    centroid = {
      x: handState.centerOfGravity.col,
      y: handState.centerOfGravity.row,
    };
  } else {
    // Default to grid center
    centroid = { x: 3.5, y: 3.5 };
  }
  
  return { centroid, fingers };
}

