/**
 * BiomechanicalSolver - Core performability engine that assigns fingers to notes
 * based on biomechanical constraints and instrument configuration.
 */

import { Performance, NoteEvent } from '../types/performance';
import { InstrumentConfig } from '../types/performance';
import { GridMapService } from './gridMapService';
import { FingerType, HandState, DEFAULT_ENGINE_CONSTANTS, EngineConstants } from './models';
import { isReachPossible, isValidFingerOrder } from './feasibility';
import {
  calculateMovementCost,
  calculateStretchPenalty,
  calculateDriftPenalty,
  getFingerBouncePenalty,
  recordNoteAssignment,
  clearNoteHistory,
} from './costFunction';
import { GridPosition, calculateGridDistance } from './gridMath';

/**
 * Engine debug event with assignment details.
 */
export interface EngineDebugEvent {
  noteNumber: number;
  startTime: number;
  assignedHand: 'left' | 'right' | 'Unplayable';
  finger: FingerType | null;
  cost: number;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Unplayable';
  row?: number;
  col?: number;
}

/**
 * Finger usage statistics breakdown.
 */
export interface FingerUsageStats {
  /** Usage count for each finger: "L-Thumb", "L-Index", "R-Thumb", etc. */
  [fingerKey: string]: number;
}

/**
 * Fatigue map: heat map value per finger (0.0 = no fatigue, higher = more fatigued).
 */
export interface FatigueMap {
  /** Fatigue level for each finger: "L-Thumb", "L-Index", "R-Thumb", etc. */
  [fingerKey: string]: number;
}

/**
 * Engine result containing score and debug events.
 */
export interface EngineResult {
  score: number;
  unplayableCount: number;
  hardCount: number;
  debugEvents: EngineDebugEvent[];
  /** Breakdown of how many times each finger was used */
  fingerUsageStats: FingerUsageStats;
  /** Heat map value per finger (fatigue levels) */
  fatigueMap: FatigueMap;
  /** Average drift distance from home positions */
  averageDrift: number;
}

/**
 * Candidate finger assignment for evaluation.
 */
interface FingerCandidate {
  hand: 'left' | 'right';
  finger: FingerType;
  handState: HandState;
  cost: number;
}

/**
 * Helper to convert GridPosition to tuple format for compatibility.
 * @deprecated Use GridPosition directly instead of tuples
 */
function gridPosToTuple(pos: GridPosition): [number, number] {
  return [pos.row, pos.col];
}

/**
 * Helper to convert tuple to GridPosition.
 * @deprecated Use GridPosition directly instead of tuples
 */
function tupleToGridPos(pos: [number, number]): GridPosition {
  return { row: pos[0], col: pos[1] };
}

/**
 * Calculates the center of gravity for a hand state.
 * Returns GridPosition (object-based) instead of tuple.
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

  const sumRow = placedFingers.reduce((sum, pos) => sum + pos.row, 0);
  const sumCol = placedFingers.reduce((sum, pos) => sum + pos.col, 0);

  return {
    row: sumRow / placedFingers.length,
    col: sumCol / placedFingers.length
  };
}

/**
 * Calculates the span width of a hand (distance between thumb and pinky).
 */
function calculateSpanWidth(handState: HandState): number {
  const thumbPos = handState.fingers.thumb.currentGridPos;
  const pinkyPos = handState.fingers.pinky.currentGridPos;

  if (thumbPos === null || pinkyPos === null) {
    return 0;
  }

  const thumb = thumbPos;
  const pinky = pinkyPos;

  return calculateGridDistance(thumb, pinky);
}

/**
 * Updates hand state's center of gravity and span width.
 */
function updateHandStateMetrics(handState: HandState): void {
  handState.centerOfGravity = calculateCenterOfGravity(handState);
  handState.spanWidth = calculateSpanWidth(handState);
}

/**
 * Creates an initial hand state with all fingers unplaced.
 * Note: HandState still uses GridPos (tuple) for backward compatibility with models.ts,
 * but we'll convert internally to GridPosition where needed.
 */
function createInitialHandState(): HandState {
  return {
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
}

/**
 * Determines home position for a hand based on InstrumentConfig.
 * Left hand home is typically at the bottom-left area (C1/C2).
 * Right hand home is typically offset to the right (F2/G2).
 * 
 * @param instrumentConfig - The instrument configuration
 * @param hand - Which hand ('left' or 'right')
 * @returns Home position (object-based) for the hand
 */
function getHomePosition(instrumentConfig: InstrumentConfig, hand: 'left' | 'right'): GridPosition {
  // Base home position: bottom-left corner (row 0, col 0) = bottomLeftNote
  // Left hand: stays near bottom-left (row 0-1, col 0-2)
  // Right hand: offset to the right (row 0-1, col 4-6)

  if (hand === 'left') {
    // Left hand home: bottom-left area (C1/C2 region)
    // Position: row 0 (bottom), col 1 (slightly right of left edge)
    return { row: 0, col: 1 };
  } else {
    // Right hand home: right side of bottom row (F2/G2 region)
    // Position: row 0 (bottom), col 5 (right side)
    return { row: 0, col: 5 };
  }
}

/**
 * BiomechanicalSolver - Main solver class.
 */
export class BiomechanicalSolver {
  private leftHandState: HandState;
  private rightHandState: HandState;
  private instrumentConfig: InstrumentConfig;
  private constants: EngineConstants;
  private lastEventTime: number;

  constructor(instrumentConfig: InstrumentConfig, constants: EngineConstants = DEFAULT_ENGINE_CONSTANTS) {
    this.instrumentConfig = instrumentConfig;
    this.constants = constants;
    this.leftHandState = createInitialHandState();
    this.rightHandState = createInitialHandState();
    this.lastEventTime = -1;

    // Clear note history on initialization
    clearNoteHistory();
  }

  /**
   * Identifies candidate hands using left/right split heuristic.
   * For an 8x8 grid, typically: left half (cols 0-3) = left hand, right half (cols 4-7) = right hand.
   * 
   * @param targetPos - Target position (object-based)
   * @returns Array of candidate hands
   */
  private identifyCandidateHands(targetPos: GridPosition): ('left' | 'right')[] {
    const col = targetPos.col;

    // Simple split: left half (cols 0-3) = left hand, right half (cols 4-7) = right hand
    // But allow both hands as candidates for flexibility (hands can cross over)
    if (col <= 3) {
      return ['left', 'right']; // Prefer left, but allow right
    } else {
      return ['right', 'left']; // Prefer right, but allow left
    }
  }

  /**
   * Generates candidate fingers that can reach the target position.
   * 
   * @param handState - Current hand state
   * @param targetPos - Target position (object-based)
   * @param hand - Which hand
   * @returns Array of candidate finger types that can reach
   */
  private generateCandidateFingers(
    handState: HandState,
    targetPos: GridPosition,
    hand: 'left' | 'right'
  ): FingerType[] {
    const candidates: FingerType[] = [];
    const allFingers: FingerType[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];

    for (const finger of allFingers) {
      const currentPos = handState.fingers[finger].currentGridPos;

      // If finger is not placed, use center of gravity or home position as start
      const startPos: GridPosition = currentPos || handState.centerOfGravity || { row: 0, col: 0 };

      // Check if reach is possible
      if (isReachPossible(startPos, targetPos, finger, this.constants)) {
        candidates.push(finger);
      }
    }

    return candidates;
  }

  /**
   * Calculates total cost for a candidate assignment.
   * 
   * @param candidate - The candidate assignment
   * @param targetPos - Target position (object-based)
   * @param currentTime - Current time in seconds
   * @param noteNumber - MIDI note number
   * @returns Total cost for this candidate
   */
  private calculateTotalCost(
    candidate: FingerCandidate,
    targetPos: GridPosition,
    currentTime: number,
    noteNumber: number
  ): number {
    const { hand, finger, handState } = candidate;
    const currentPos = handState.fingers[finger].currentGridPos;

    // 1. Movement cost
    const movementCost = calculateMovementCost(currentPos, targetPos, finger, this.constants);

    // 2. Stretch penalty
    const stretchPenalty = calculateStretchPenalty(handState, targetPos, finger, this.constants);

    // 3. Drift penalty (distance from home)
    const homePos = getHomePosition(this.instrumentConfig, hand);
    const driftPenalty = calculateDriftPenalty(handState, homePos, this.constants);

    // 4. Finger bounce penalty (stickiness heuristic)
    const bouncePenalty = getFingerBouncePenalty(noteNumber, finger, currentTime);

    // 5. Fatigue penalty (add fatigue level as cost)
    const fatiguePenalty = handState.fingers[finger].fatigueLevel;

    // Total cost
    return movementCost + stretchPenalty + driftPenalty + bouncePenalty + fatiguePenalty;
  }

  /**
   * Calculates future cost penalty by looking ahead at the next note.
   * If current choice makes next note impossible/expensive, add penalty.
   * 
   * @param currentCandidate - Current candidate assignment
   * @param currentTargetPos - Current note's target position (object-based)
   * @param nextNote - Next note event (if available)
   * @param currentTime - Current time
   * @returns Future cost penalty (0 if no penalty)
   */
  private calculateFutureCost(
    currentCandidate: FingerCandidate,
    currentTargetPos: GridPosition,
    nextNote: NoteEvent | null,
    currentTime: number
  ): number {
    if (!nextNote) {
      return 0; // No next note, no future cost
    }

    // Get target position for next note
    const nextTargetTuple = GridMapService.noteToGrid(nextNote.noteNumber, this.instrumentConfig);
    if (!nextTargetTuple) {
      return 0; // Next note is unmapped, no penalty
    }
    const nextTargetPos: GridPosition = { row: nextTargetTuple[0], col: nextTargetTuple[1] };

    // Create temporary hand state with current assignment applied
    const tempHandState: HandState = {
      ...currentCandidate.handState,
      fingers: {
        ...currentCandidate.handState.fingers,
        [currentCandidate.finger]: {
          currentGridPos: currentTargetPos, // Current assignment applied
          fatigueLevel: currentCandidate.handState.fingers[currentCandidate.finger].fatigueLevel + 0.1 // Fatigue accumulated
        }
      }
    };
    updateHandStateMetrics(tempHandState);

    // Check if next note would be reachable/feasible with this hand state
    const nextCandidates = this.generateCandidateFingers(
      tempHandState,
      nextTargetPos,
      currentCandidate.hand
    );

    // If no fingers can reach next note, add penalty
    if (nextCandidates.length === 0) {
      return 10.0; // High penalty for making next note impossible
    }

    // Calculate cost for best next note assignment
    let minNextCost = Infinity;
    for (const nextFinger of nextCandidates) {
      // Check feasibility for next finger assignment
      const nextTempHandState: HandState = {
        ...tempHandState,
        fingers: {
          ...tempHandState.fingers,
          [nextFinger]: {
            currentGridPos: nextTargetPos,
            fatigueLevel: tempHandState.fingers[nextFinger].fatigueLevel
          }
        }
      };
      updateHandStateMetrics(nextTempHandState);

      if (!isValidFingerOrder(nextTempHandState, { finger: nextFinger, pos: nextTargetPos }, currentCandidate.hand)) {
        continue; // Skip invalid assignments
      }

      const nextCandidate: FingerCandidate = {
        hand: currentCandidate.hand,
        finger: nextFinger,
        handState: tempHandState,
        cost: 0
      };
      const nextCost = this.calculateTotalCost(
        nextCandidate,
        nextTargetPos,
        nextNote.startTime,
        nextNote.noteNumber
      );
      minNextCost = Math.min(minNextCost, nextCost);
    }

    // If next note would be expensive or impossible, add penalty
    if (minNextCost === Infinity) {
      return 10.0; // High penalty for making next note impossible
    } else if (minNextCost > 5.0) {
      return minNextCost * 0.1; // 10% of future cost as penalty
    }

    return 0; // Next note is feasible and cheap, no penalty
  }

  /**
   * Updates hand state after assigning a finger to a position.
   * 
   * @param handState - Hand state to update
   * @param finger - Finger being assigned
   * @param targetPos - Target position (object-based)
   * @param timeDelta - Time since last event
   */
  private updateHandState(
    handState: HandState,
    finger: FingerType,
    targetPos: GridPosition,
    timeDelta: number
  ): void {
    // Decay fatigue for all fingers
    for (const fingerType of ['thumb', 'index', 'middle', 'ring', 'pinky'] as FingerType[]) {
      if (timeDelta > 0) {
        // Simple fatigue decay: reduce by 0.05 per second
        handState.fingers[fingerType].fatigueLevel = Math.max(
          0,
          handState.fingers[fingerType].fatigueLevel - (0.05 * timeDelta)
        );
      }
    }

    // Update assigned finger position
    handState.fingers[finger].currentGridPos = targetPos;

    // Accumulate fatigue for used finger (simple: add 0.1 per use)
    handState.fingers[finger].fatigueLevel += 0.1;

    // Update center of gravity and span width
    updateHandStateMetrics(handState);
  }

  /**
   * Determines difficulty label based on cost.
   */
  private getDifficulty(cost: number): 'Easy' | 'Medium' | 'Hard' | 'Unplayable' {
    if (cost === Infinity || cost > 100) {
      return 'Unplayable';
    } else if (cost > 10) {
      return 'Hard';
    } else if (cost > 3) {
      return 'Medium';
    } else {
      return 'Easy';
    }
  }

  /**
   * Solves the performance and assigns fingers to notes.
   * 
   * @param performance - The performance to solve
   * @returns Engine result with assignments and scores
   */
  solve(performance: Performance): EngineResult {
    const sortedEvents = [...performance.events].sort((a, b) => a.startTime - b.startTime);
    const debugEvents: EngineDebugEvent[] = [];
    let unplayableCount = 0;
    let hardCount = 0;

    // Initialize home positions
    const leftHome = getHomePosition(this.instrumentConfig, 'left');
    const rightHome = getHomePosition(this.instrumentConfig, 'right');
    // Set initial center of gravity to home positions
    this.leftHandState.centerOfGravity = leftHome;
    this.rightHandState.centerOfGravity = rightHome;

    // Event loop: process each note
    for (let i = 0; i < sortedEvents.length; i++) {
      const note = sortedEvents[i];
      const nextNote = i < sortedEvents.length - 1 ? sortedEvents[i + 1] : null;

      // Get target position for this note
      const targetTuple = GridMapService.noteToGrid(note.noteNumber, this.instrumentConfig);
      if (!targetTuple) {
        // Note is outside grid, mark as unplayable
        unplayableCount++;
        debugEvents.push({
          noteNumber: note.noteNumber,
          startTime: note.startTime,
          assignedHand: 'Unplayable',
          finger: null,
          cost: Infinity,
          difficulty: 'Unplayable',
        });
        continue;
      }
      const targetPos: GridPosition = { row: targetTuple[0], col: targetTuple[1] };

      // Calculate time delta
      const timeDelta = this.lastEventTime >= 0 ? note.startTime - this.lastEventTime : 0;

      // Identify candidate hands
      const candidateHands = this.identifyCandidateHands(targetPos);

      // Generate and evaluate candidates
      const candidates: FingerCandidate[] = [];

      for (const hand of candidateHands) {
        const handState = hand === 'left' ? this.leftHandState : this.rightHandState;

        // Generate candidate fingers
        const candidateFingers = this.generateCandidateFingers(handState, targetPos, hand);

        for (const finger of candidateFingers) {
          // Filter by feasibility: check finger ordering
          const tempHandState: HandState = {
            ...handState,
            fingers: {
              ...handState.fingers,
              [finger]: {
                currentGridPos: targetPos,
                fatigueLevel: handState.fingers[finger].fatigueLevel
              }
            }
          };
          updateHandStateMetrics(tempHandState);

          // Check if finger order is valid
          if (!isValidFingerOrder(tempHandState, { finger, pos: targetPos }, hand)) {
            continue; // Skip invalid assignments
          }

          // Calculate costs
          const candidate: FingerCandidate = {
            hand,
            finger,
            handState,
            cost: 0
          };

          const baseCost = this.calculateTotalCost(
            candidate,
            targetPos,
            note.startTime,
            note.noteNumber
          );

          // Add future cost penalty (lookahead)
          const futureCost = this.calculateFutureCost(candidate, targetPos, nextNote, note.startTime);

          candidate.cost = baseCost + futureCost;
          candidates.push(candidate);
        }
      }

      // Find winner (lowest cost)
      if (candidates.length === 0) {
        // No feasible candidates
        unplayableCount++;
        debugEvents.push({
          noteNumber: note.noteNumber,
          startTime: note.startTime,
          assignedHand: 'Unplayable',
          finger: null,
          cost: Infinity,
          difficulty: 'Unplayable',
          row: targetPos.row,
          col: targetPos.col,
        });
        continue;
      }

      const winner = candidates.reduce((best, candidate) =>
        candidate.cost < best.cost ? candidate : best
      );

      // Update hand state
      const winnerHandState = winner.hand === 'left' ? this.leftHandState : this.rightHandState;
      this.updateHandState(winnerHandState, winner.finger, targetPos, timeDelta);

      // Record note assignment in history
      recordNoteAssignment(note.noteNumber, winner.finger, note.startTime);

      // Determine difficulty
      const difficulty = this.getDifficulty(winner.cost);
      if (difficulty === 'Hard') {
        hardCount++;
      }

      // Record debug event
      debugEvents.push({
        noteNumber: note.noteNumber,
        startTime: note.startTime,
        assignedHand: winner.hand,
        finger: winner.finger,
        cost: winner.cost,
        difficulty,
        row: targetPos.row,
        col: targetPos.col,
      });

      this.lastEventTime = note.startTime;
    }

    // Calculate score (0-100)
    let score = 100 - (5 * hardCount) - (20 * unplayableCount);
    if (score < 0) score = 0;

    // Calculate finger usage stats
    const fingerUsageStats: FingerUsageStats = {};
    debugEvents.forEach(event => {
      if (event.assignedHand !== 'Unplayable' && event.finger !== null) {
        const fingerKey = `${event.assignedHand === 'left' ? 'L' : 'R'}-${event.finger.charAt(0).toUpperCase() + event.finger.slice(1)}`;
        fingerUsageStats[fingerKey] = (fingerUsageStats[fingerKey] || 0) + 1;
      }
    });

    // Calculate fatigue map (final fatigue levels from hand states)
    const fatigueMap: FatigueMap = {};
    const fingerTypes: FingerType[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];

    // Left hand fatigue
    fingerTypes.forEach(finger => {
      const fingerKey = `L-${finger.charAt(0).toUpperCase() + finger.slice(1)}`;
      fatigueMap[fingerKey] = this.leftHandState.fingers[finger].fatigueLevel;
    });

    // Right hand fatigue
    fingerTypes.forEach(finger => {
      const fingerKey = `R-${finger.charAt(0).toUpperCase() + finger.slice(1)}`;
      fatigueMap[fingerKey] = this.rightHandState.fingers[finger].fatigueLevel;
    });

    // Calculate average drift from home positions
    let totalDrift = 0;
    let driftCount = 0;

    debugEvents.forEach(event => {
      if (event.row !== undefined && event.col !== undefined && event.assignedHand !== 'Unplayable') {
        const eventPos: GridPosition = { row: event.row, col: event.col };
        const homePos = (event.assignedHand === 'left') ? leftHome : rightHome;
        const drift = calculateGridDistance(eventPos, homePos);
        totalDrift += drift;
        driftCount++;
      }
    });

    const averageDrift = driftCount > 0 ? totalDrift / driftCount : 0;

    return {
      score,
      unplayableCount,
      hardCount,
      debugEvents,
      fingerUsageStats,
      fatigueMap,
      averageDrift,
    };
  }
}

