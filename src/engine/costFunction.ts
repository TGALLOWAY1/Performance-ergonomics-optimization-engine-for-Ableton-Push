/**
 * Weighted cost calculators for the Performability Engine.
 * These functions calculate various cost components used in evaluating
 * candidate finger assignments for notes.
 */

import { FingerType, HandState, DEFAULT_ENGINE_CONSTANTS, EngineConstants } from './models';
import { GridPosition, calculateGridDistance } from './gridMath';

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
  // If finger is not placed, assume zero movement cost (free entry)
  if (from === null) {
    return 0;
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

