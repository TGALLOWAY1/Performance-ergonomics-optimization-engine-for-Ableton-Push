/**
 * BiomechanicalSolver - Core performability engine that assigns fingers to notes
 * based on biomechanical constraints and instrument configuration.
 */

import { Performance, NoteEvent } from '../types/performance';
import { InstrumentConfig } from '../types/performance';
import { GridMapService } from './gridMapService';
import { FingerType, HandState, DEFAULT_ENGINE_CONSTANTS, EngineConstants } from './models';
import { GridMapping } from '../types/layout';
import { isReachPossible, isValidFingerOrder } from './feasibility';
import {
  calculateMovementCost,
  calculateStretchPenalty,
  calculateDriftPenalty,
  calculateCrossoverCost,
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
  costBreakdown?: CostBreakdown;
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
 * Detailed breakdown of cost components.
 */
export interface CostBreakdown {
  movement: number;
  stretch: number;
  drift: number;
  bounce: number;
  fatigue: number;
  crossover: number;
  total: number;
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
  /** Average cost metrics across the performance */
  averageMetrics: CostBreakdown;
}

/**
 * Candidate finger assignment for evaluation.
 */
interface FingerCandidate {
  hand: 'left' | 'right';
  finger: FingerType;
  handState: HandState;
  cost: number;
  costBreakdown?: CostBreakdown;
}

/**
 * Helper to convert GridPosition to tuple format for compatibility.
 * @deprecated Use GridPosition directly instead of tuples
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
function getHomePosition(hand: 'left' | 'right'): GridPosition {
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
  private gridMapping: GridMapping | null;
  private constants: EngineConstants;
  private lastEventTime: number;

  constructor(
    instrumentConfig: InstrumentConfig,
    gridMapping: GridMapping | null = null,
    constants: EngineConstants = DEFAULT_ENGINE_CONSTANTS
  ) {
    this.instrumentConfig = instrumentConfig;
    this.gridMapping = gridMapping;
    this.constants = constants;
    this.leftHandState = createInitialHandState();
    this.rightHandState = createInitialHandState();
    this.lastEventTime = -1;

    // Clear note history on initialization
    clearNoteHistory();
  }

  /**
   * Gets the grid position for a MIDI note.
   * Prioritizes the custom GridMapping if available.
   * Falls back to algorithmic GridMapService if not found or no mapping provided.
   */
  private getNotePosition(noteNumber: number): GridPosition | null {
    // 1. Try custom mapping first
    if (this.gridMapping) {
      // Search all cells for this note number
      // This is O(64) but acceptable for this scale
      for (const [key, voice] of Object.entries(this.gridMapping.cells)) {
        if (voice.originalMidiNote === noteNumber) {
          // key is "row,col"
          const [rowStr, colStr] = key.split(',');
          return {
            row: parseInt(rowStr, 10),
            col: parseInt(colStr, 10)
          };
        }
      }
    }

    // 2. Fallback to algorithmic mapping
    const tuple = GridMapService.noteToGrid(noteNumber, this.instrumentConfig);
    if (tuple) {
      return { row: tuple[0], col: tuple[1] };
    }

    return null;
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
    targetPos: GridPosition
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
   * @returns Cost breakdown for this candidate
   */
  private calculateTotalCost(
    candidate: FingerCandidate,
    targetPos: GridPosition,
    currentTime: number,
    noteNumber: number
  ): CostBreakdown {
    const { hand, finger, handState } = candidate;
    const currentPos = handState.fingers[finger].currentGridPos;

    // 1. Movement cost
    const movementCost = calculateMovementCost(currentPos, targetPos, finger, this.constants);

    // 2. Stretch penalty
    const stretchPenalty = calculateStretchPenalty(handState, targetPos, finger, this.constants);

    // 3. Drift penalty (distance from home position)
    const homePos = getHomePosition(hand);
    const driftPenalty = calculateDriftPenalty(handState, homePos, this.constants);

    // 4. Finger bounce penalty (stickiness heuristic)
    const bouncePenalty = getFingerBouncePenalty(noteNumber, finger, currentTime);

    // 5. Fatigue penalty (add fatigue level as cost)
    const fatiguePenalty = handState.fingers[finger].fatigueLevel;

    // 6. Crossover penalty (soft constraint for geometric violations)
    const crossoverPenalty = calculateCrossoverCost(handState, targetPos, finger, hand, this.constants);

    // Total cost
    const total = movementCost + stretchPenalty + driftPenalty + bouncePenalty + fatiguePenalty + crossoverPenalty;

    return {
      movement: movementCost,
      stretch: stretchPenalty,
      drift: driftPenalty,
      bounce: bouncePenalty,
      fatigue: fatiguePenalty,
      crossover: crossoverPenalty,
      total
    };
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
    nextNote: NoteEvent | null
  ): number {
    if (!nextNote) {
      return 0; // No next note, no future cost
    }

    // Get target position for next note
    const nextTargetPos = this.getNotePosition(nextNote.noteNumber);
    if (!nextTargetPos) {
      return 0; // Next note is unmapped, no penalty
    }

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
      nextTargetPos
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
      const nextCostBreakdown = this.calculateTotalCost(
        nextCandidate,
        nextTargetPos,
        nextNote.startTime,
        nextNote.noteNumber
      );
      minNextCost = Math.min(minNextCost, nextCostBreakdown.total);
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
   * Updates fatigue levels for all fingers based on time passed.
   * Fatigue decays over time (recovery).
   * 
   * @param timeDelta - Time passed since last event in seconds
   */
  private updateFatigue(timeDelta: number): void {
    const recoveryRate = this.constants.fatigueRecoveryRate || 0.5; // Default recovery rate

    // Update left hand
    Object.values(this.leftHandState.fingers).forEach(fingerState => {
      fingerState.fatigueLevel = Math.max(0, fingerState.fatigueLevel - (timeDelta * recoveryRate));
    });

    // Update right hand
    Object.values(this.rightHandState.fingers).forEach(fingerState => {
      fingerState.fatigueLevel = Math.max(0, fingerState.fatigueLevel - (timeDelta * recoveryRate));
    });
  }

  /**
   * Solves the performance and assigns fingers to notes.
   * 
   * @param performance - The performance data to analyze
   * @param manualAssignments - Optional map of event index to forced finger assignment
   * @returns EngineResult with score and debug events
   */
  public solve(
    performance: Performance,
    manualAssignments?: Record<number, { hand: 'left' | 'right', finger: FingerType }>
  ): EngineResult {
    const sortedEvents = [...performance.events].sort((a, b) => a.startTime - b.startTime);

    let unplayableCount = 0;
    let hardCount = 0;
    const debugEvents: EngineDebugEvent[] = [];

    // Reset hand states
    this.leftHandState = createInitialHandState();
    this.rightHandState = createInitialHandState();
    this.lastEventTime = -1;

    // Track usage stats
    // const fingerUsageStats: FingerUsageStats = {}; // REMOVED: Redeclared

    // Track drift
    // let totalDrift = 0; // REMOVED: Redeclared
    // let driftCount = 0; // REMOVED: Redeclared

    // Initialize home positions
    const leftHome = getHomePosition('left');
    const rightHome = getHomePosition('right');
    // Set initial center of gravity to home positions
    this.leftHandState.centerOfGravity = leftHome;
    this.rightHandState.centerOfGravity = rightHome;

    // Event loop: process each note
    for (let i = 0; i < sortedEvents.length; i++) {
      const note = sortedEvents[i];
      const nextNote = i < sortedEvents.length - 1 ? sortedEvents[i + 1] : null;

      // Get target position for this note
      const targetPos = this.getNotePosition(note.noteNumber);
      if (!targetPos) {
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

      // Calculate time delta
      const timeDelta = this.lastEventTime >= 0 ? note.startTime - this.lastEventTime : 0;

      // Update fatigue based on time passed
      this.updateFatigue(timeDelta);

      // Check for manual assignment
      let candidates: FingerCandidate[] = [];
      const manualOverride = manualAssignments ? manualAssignments[i] : undefined;

      if (manualOverride) {
        // FORCE the assigned finger
        const handState = manualOverride.hand === 'left' ? this.leftHandState : this.rightHandState;

        // Create a temporary candidate for cost calculation
        const tempCandidate: FingerCandidate = {
          hand: manualOverride.hand,
          finger: manualOverride.finger,
          handState: handState,
          cost: 0 // Will be calculated
        };

        // Calculate cost for this forced assignment
        // We still want to know the cost even if it's forced
        const baseCostBreakdown = this.calculateTotalCost(
          tempCandidate,
          targetPos,
          note.startTime,
          note.noteNumber
        );

        // Add future cost penalty (lookahead)
        const futureCost = this.calculateFutureCost(tempCandidate, targetPos, nextNote);

        candidates = [{
          hand: manualOverride.hand,
          finger: manualOverride.finger,
          handState: handState, // Note: This is current state, not updated state yet
          cost: baseCostBreakdown.total + futureCost,
          costBreakdown: baseCostBreakdown
        }];
      } else {
        // Generate candidates normally
        // Identify candidate hands
        const candidateHands = this.identifyCandidateHands(targetPos);

        for (const hand of candidateHands) {
          const handState = hand === 'left' ? this.leftHandState : this.rightHandState;

          // Generate candidate fingers
          const candidateFingers = this.generateCandidateFingers(handState, targetPos);

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

            const baseCostBreakdown = this.calculateTotalCost(
              candidate,
              targetPos,
              note.startTime,
              note.noteNumber
            );

            // Add future cost penalty (lookahead)
            const futureCost = this.calculateFutureCost(candidate, targetPos, nextNote);

            candidate.cost = baseCostBreakdown.total + futureCost;
            candidate.costBreakdown = baseCostBreakdown;
            candidates.push(candidate);
          }
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
        costBreakdown: winner.costBreakdown,
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

    // Calculate average metrics
    const totalMetrics: CostBreakdown = {
      movement: 0,
      stretch: 0,
      drift: 0,
      bounce: 0,
      fatigue: 0,
      crossover: 0,
      total: 0
    };
    let metricsCount = 0;

    debugEvents.forEach(event => {
      if (event.costBreakdown) {
        totalMetrics.movement += event.costBreakdown.movement;
        totalMetrics.stretch += event.costBreakdown.stretch;
        totalMetrics.drift += event.costBreakdown.drift;
        totalMetrics.bounce += event.costBreakdown.bounce;
        totalMetrics.fatigue += event.costBreakdown.fatigue;
        totalMetrics.crossover += event.costBreakdown.crossover;
        totalMetrics.total += event.costBreakdown.total;
        metricsCount++;
      }
    });

    const averageMetrics: CostBreakdown = metricsCount > 0 ? {
      movement: totalMetrics.movement / metricsCount,
      stretch: totalMetrics.stretch / metricsCount,
      drift: totalMetrics.drift / metricsCount,
      bounce: totalMetrics.bounce / metricsCount,
      fatigue: totalMetrics.fatigue / metricsCount,
      crossover: totalMetrics.crossover / metricsCount,
      total: totalMetrics.total / metricsCount
    } : {
      movement: 0,
      stretch: 0,
      drift: 0,
      bounce: 0,
      fatigue: 0,
      crossover: 0,
      total: 0
    };

    return {
      score,
      unplayableCount,
      hardCount,
      debugEvents,
      fingerUsageStats,
      fatigueMap,
      averageDrift,
      averageMetrics,
    };
  }
}

