/**
 * BeamSolver - Beam Search optimization algorithm.
 * 
 * Assigns fingers to notes based on biomechanical constraints and cost optimization.
 * The Beam Search approach maintains K best candidates at each step, allowing
 * for more globally optimal solutions compared to greedy approaches.
 */

import { Performance, NoteEvent, HandPose, EngineConfiguration } from '../../types/performance';
import { InstrumentConfig } from '../../types/performance';
import { FingerType } from '../models';
import { buildNoteToPadIndex, resolveNoteToPad, hashGridMapping } from '../mappingResolver';
import { GridMapping, cellKey } from '../../types/layout';
import { generateValidGripsWithTier, Pad } from '../feasibility';
import {
  calculateAttractorCost,
  calculateTransitionCost,
  calculateGripStretchCost,
  calculatePerFingerHomeCost,
  calculateAlternationCost,
  calculateHandBalanceCost,
  FALLBACK_GRIP_PENALTY,
} from '../costFunction';
import {
  type ObjectiveComponents,
  combineComponents,
  objectiveToCostBreakdown,
} from '../objective';
import { GridPosition } from '../gridMath';
import { getNeutralHandCenters, computeNeutralHandCenters, restingPoseFromNeutralPadPositions, NeutralHandCenters, NeutralPadPositions } from '../handPose';
import {
  SolverStrategy,
  SolverType,
  SolverConfig,
  EngineResult,
  EngineDebugEvent,
  FingerUsageStats,
  FatigueMap,
  CostBreakdown,
} from './types';

// ============================================================================
// Beam Search Internal Types
// ============================================================================

/**
 * Assignment record for a single note event.
 * costComponents: real objective breakdown (when present, cost === combineComponents(costComponents)).
 */
interface NoteAssignment {
  eventIndex: number;
  eventKey?: string;
  noteNumber: number;
  startTime: number;
  hand: 'left' | 'right';
  finger: FingerType;
  grip: HandPose;
  cost: number;
  row: number;
  col: number;
  /** Real objective components; used for accurate CostBreakdown in result */
  costComponents?: ObjectiveComponents;
}

/**
 * BeamNode represents a state in the beam search.
 * Contains the current hand poses, accumulated cost, and path history.
 */
interface BeamNode {
  /** Current pose for left hand */
  leftPose: HandPose;
  /** Current pose for right hand */
  rightPose: HandPose;
  /** Total accumulated cost from start to this node */
  totalCost: number;
  /** Reference to parent node for backtracking */
  parent: BeamNode | null;
  /** Assignments made at this step (empty for initial node, multiple for chords) */
  assignments: NoteAssignment[];
  /** Depth in the search tree (group index) */
  depth: number;
  /** Cumulative left-hand note count (for hand balance) */
  leftCount: number;
  /** Cumulative right-hand note count (for hand balance) */
  rightCount: number;
}

/**
 * PerformanceGroup: Grouped notes at the same time step (chord/simultaneous notes).
 * All notes in a group are processed as a single "step" in the beam search.
 */
interface PerformanceGroup {
  /** Timestamp of this group (shared by all notes) */
  timestamp: number;
  /** All note events in this group */
  notes: NoteEvent[];
  /** Original indices of the events (for backtracking) */
  eventIndices: number[];
  /** Original event keys of the events (for backtracking and overrides) */
  eventKeys: (string | undefined)[];
  /** Active pad coordinates for all notes in this group */
  activePads: Pad[];
  /** Grid positions (for result building) */
  positions: GridPosition[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determines difficulty label based on cost.
 */
function getDifficulty(cost: number): 'Easy' | 'Medium' | 'Hard' | 'Unplayable' {
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
 * Groups events by timestamp into PerformanceGroups.
 * Events within TIME_EPSILON of each other are considered simultaneous (chords).
 * 
 * @param events - Sorted array of events with their original indices and positions
 * @returns Array of PerformanceGroup objects, one per unique timestamp
 */
function groupEventsByTimestamp(
  events: Array<{ event: NoteEvent; index: number; position: GridPosition | null }>
): PerformanceGroup[] {
  const TIME_EPSILON = 0.001; // 1ms tolerance for "simultaneous"
  const groups: PerformanceGroup[] = [];

  let currentGroup: PerformanceGroup | null = null;

  for (const { event, index, position } of events) {
    if (!position) continue; // Skip unmapped notes

    const pad: Pad = { row: position.row, col: position.col };

    if (!currentGroup || event.startTime - currentGroup.timestamp > TIME_EPSILON) {
      // Start new group
      currentGroup = {
        timestamp: event.startTime,
        notes: [event],
        eventIndices: [index],
        eventKeys: [event.eventKey],
        activePads: [pad],
        positions: [position],
      };
      groups.push(currentGroup);
    } else {
      // Add to current group (simultaneous event / chord)
      currentGroup.notes.push(event);
      currentGroup.eventIndices.push(index);
      currentGroup.eventKeys.push(event.eventKey);
      currentGroup.activePads.push(pad);
      currentGroup.positions.push(position);
    }
  }

  return groups;
}

// ============================================================================
// BeamSolver Implementation
// ============================================================================

/**
 * BeamSolver - Beam Search algorithm implementation.
 * 
 * Implements the SolverStrategy interface for pluggable solver support.
 * Uses a beam search approach to find near-optimal finger assignments
 * by maintaining the K best candidates at each step.
 */
export class BeamSolver implements SolverStrategy {
  public readonly name = 'Beam Search';
  public readonly type: SolverType = 'beam';
  public readonly isSynchronous = true;

  private instrumentConfig: InstrumentConfig;
  private gridMapping: GridMapping | null;
  private neutralPadPositionsOverride: NeutralPadPositions | null;
  private mappingResolverMode: 'strict' | 'allow-fallback';

  constructor(config: SolverConfig) {
    this.instrumentConfig = config.instrumentConfig;
    this.gridMapping = config.gridMapping ?? null;
    this.neutralPadPositionsOverride = config.neutralPadPositionsOverride ?? null;
    this.mappingResolverMode = config.mappingResolverMode ?? 'strict';
  }

  /**
   * Creates the initial beam with a neutral starting state.
   */
  private createInitialBeam(config: EngineConfiguration): BeamNode[] {
    const { restingPose } = config;

    const initialNode: BeamNode = {
      leftPose: { ...restingPose.left },
      rightPose: { ...restingPose.right },
      totalCost: 0,
      parent: null,
      assignments: [], // Empty for initial node
      depth: 0,
      leftCount: 0,
      rightCount: 0,
    };

    return [initialNode];
  }

  /**
   * Expands a beam node for a PerformanceGroup (single note or chord).
   * Uses tiered grip generation to ALWAYS produce at least one valid expansion.
   * 
   * @param node - Current beam node
   * @param group - Performance group to expand
   * @param prevTimestamp - Timestamp of previous group (for timeDelta calculation)
   * @param config - Engine configuration
   * @returns Array of child nodes
   */
  private expandNodeForGroup(
    node: BeamNode,
    group: PerformanceGroup,
    prevTimestamp: number,
    config: EngineConfiguration,
    neutralHandCenters?: NeutralHandCenters | null
  ): BeamNode[] {
    const children: BeamNode[] = [];

    // Calculate time delta from previous group
    const rawTimeDelta = group.timestamp - prevTimestamp;

    // For the first group (or when prevTimestamp is 0), give ample time
    // for hand positioning to prevent speed constraint issues
    const isFirstGroup = node.depth === 0 || prevTimestamp === 0;
    const timeDelta = isFirstGroup ? Math.max(rawTimeDelta, 1.0) : rawTimeDelta;

    const { stiffness, restingPose } = config;

    // Try both hands with tiered grip generation
    for (const hand of ['left', 'right'] as const) {
      const prevPose = hand === 'left' ? node.leftPose : node.rightPose;
      const restPose = hand === 'left' ? restingPose.left : restingPose.right;

      // Generate grips with tier metadata (NEVER returns empty due to tiered fallback)
      const gripResults = generateValidGripsWithTier(group.activePads, hand);

      for (const gripResult of gripResults) {
        const { pose: grip, isFallback } = gripResult;

        // Calculate costs
        const transitionCost = calculateTransitionCost(prevPose, grip, timeDelta);

        // Skip impossible transitions (unless first group or fallback)
        if (transitionCost === Infinity && !isFirstGroup && !isFallback) {
          continue;
        }

        // Use 0 transition cost for first group if infinite
        const effectiveTransitionCost = transitionCost === Infinity ? 0 : transitionCost;

        const attractorCost = calculateAttractorCost(grip, restPose, stiffness);
        const staticCost = calculateGripStretchCost(grip, hand, undefined, undefined, neutralHandCenters);
        const perFingerHomeCost = neutralHandCenters
          ? calculatePerFingerHomeCost(grip, hand, neutralHandCenters, 0.8)
          : 0;

        // Apply fallback penalty if this is a fallback grip (constraint cost)
        const fallbackPenalty = isFallback ? FALLBACK_GRIP_PENALTY : 0;

        // Alternation: penalize same-finger repetition on short dt
        const prevAssignments = node.assignments.map((a) => ({ hand: a.hand, finger: a.finger }));
        const gripFingersForCost = Object.keys(grip.fingers) as FingerType[];
        const currentAssignments = gripFingersForCost.slice(0, group.notes.length).map((finger) => ({ hand, finger }));
        const alternationCost = calculateAlternationCost(prevAssignments, currentAssignments, rawTimeDelta);

        // Hand balance: penalize deviation from target left share
        const newLeftCount = node.leftCount + (hand === 'left' ? group.notes.length : 0);
        const newRightCount = node.rightCount + (hand === 'right' ? group.notes.length : 0);
        const handBalanceCost = calculateHandBalanceCost(newLeftCount, newRightCount);

        const stepComponents: ObjectiveComponents = {
          transition: effectiveTransitionCost,
          stretch: staticCost,
          poseAttractor: attractorCost,
          perFingerHome: perFingerHomeCost,
          alternation: alternationCost,
          handBalance: handBalanceCost,
          constraints: fallbackPenalty,
        };
        const stepCost = combineComponents(stepComponents);
        const newTotalCost = node.totalCost + stepCost;

        // Get fingers from grip for assignment
        const gripFingers = Object.keys(grip.fingers) as FingerType[];
        if (gripFingers.length === 0) continue;

        // Constraint: one finger per note. Skip this grip if it has fewer fingers than notes.
        if (gripFingers.length < group.notes.length) continue;

        // Create assignments for ALL notes in the group (handles chords correctly)
        // Each note gets a distinct finger (1:1 mapping; no finger reused within the chord).
        const assignments: NoteAssignment[] = [];
        const n = group.notes.length;
        const costPerNote = stepCost / n;
        const componentsPerNote: ObjectiveComponents = {
          transition: stepComponents.transition / n,
          stretch: stepComponents.stretch / n,
          poseAttractor: stepComponents.poseAttractor / n,
          perFingerHome: stepComponents.perFingerHome / n,
          alternation: stepComponents.alternation / n,
          handBalance: stepComponents.handBalance / n,
          constraints: stepComponents.constraints / n,
        };

        for (let i = 0; i < n; i++) {
          const event = group.notes[i];
          const position = group.positions[i];
          const eventIndex = group.eventIndices[i];
          const eventKey = group.eventKeys[i];

          const finger = gripFingers[i];

          assignments.push({
            eventIndex,
            eventKey,
            noteNumber: event.noteNumber,
            startTime: event.startTime,
            hand,
            finger,
            grip,
            cost: costPerNote,
            row: position.row,
            col: position.col,
            costComponents: componentsPerNote,
          });
        }

        const childNode: BeamNode = {
          leftPose: hand === 'left' ? grip : node.leftPose,
          rightPose: hand === 'right' ? grip : node.rightPose,
          totalCost: newTotalCost,
          parent: node,
          assignments, // Now stores ALL assignments for the chord
          depth: node.depth + 1,
          leftCount: newLeftCount,
          rightCount: newRightCount,
        };

        children.push(childNode);
      }
    }

    return children;
  }

  /**
   * Expands a beam node for a chord by trying to split between hands.
   * This is called when single-hand approaches fail or as an alternative strategy.
   * 
   * @param node - Current beam node
   * @param group - Performance group with multiple pads
   * @param prevTimestamp - Previous group timestamp
   * @param config - Engine configuration
   * @returns Array of child nodes with split-hand grips
   */
  private expandNodeForSplitChord(
    node: BeamNode,
    group: PerformanceGroup,
    prevTimestamp: number,
    config: EngineConfiguration,
    neutralHandCenters?: NeutralHandCenters | null
  ): BeamNode[] {
    const children: BeamNode[] = [];
    const pads = group.activePads;

    // Only attempt split for 2+ note chords
    if (pads.length < 2) {
      return children;
    }

    const rawTimeDelta = group.timestamp - prevTimestamp;
    const isFirstGroup = node.depth === 0 || prevTimestamp === 0;
    const timeDelta = isFirstGroup ? Math.max(rawTimeDelta, 1.0) : rawTimeDelta;

    const { stiffness, restingPose } = config;

    // Try splitting: left pads go to left hand, right pads go to right hand
    // Sort pads by column (x position)
    const sortedPads = [...pads].sort((a, b) => a.col - b.col);
    const midpoint = Math.ceil(sortedPads.length / 2);
    const leftPads = sortedPads.slice(0, midpoint);
    const rightPads = sortedPads.slice(midpoint);

    const leftPadKeys = new Set(leftPads.map((p) => `${p.row},${p.col}`));
    const leftNoteIndices: number[] = [];
    const rightNoteIndices: number[] = [];
    for (let i = 0; i < group.positions.length; i++) {
      const pos = group.positions[i];
      const key = `${pos.row},${pos.col}`;
      if (leftPadKeys.has(key)) leftNoteIndices.push(i);
      else rightNoteIndices.push(i);
    }

    const leftGripResults = generateValidGripsWithTier(leftPads, 'left');
    const rightGripResults = generateValidGripsWithTier(rightPads, 'right');

    for (const leftResult of leftGripResults) {
      const leftFingers = Object.keys(leftResult.pose.fingers) as FingerType[];
      if (leftFingers.length < leftNoteIndices.length) continue;

      for (const rightResult of rightGripResults) {
        const rightFingers = Object.keys(rightResult.pose.fingers) as FingerType[];
        if (rightFingers.length < rightNoteIndices.length) continue;

        const leftTransition = calculateTransitionCost(node.leftPose, leftResult.pose, timeDelta);
        const rightTransition = calculateTransitionCost(node.rightPose, rightResult.pose, timeDelta);

        // Skip if any transition is impossible (unless first group)
        if ((leftTransition === Infinity || rightTransition === Infinity) && !isFirstGroup) {
          continue;
        }

        const effectiveLeftTransition = leftTransition === Infinity ? 0 : leftTransition;
        const effectiveRightTransition = rightTransition === Infinity ? 0 : rightTransition;

        const leftAttractor = calculateAttractorCost(leftResult.pose, restingPose.left, stiffness);
        const rightAttractor = calculateAttractorCost(rightResult.pose, restingPose.right, stiffness);
        const leftStatic = calculateGripStretchCost(leftResult.pose, 'left', undefined, undefined, neutralHandCenters);
        const rightStatic = calculateGripStretchCost(rightResult.pose, 'right', undefined, undefined, neutralHandCenters);
        const leftHome = neutralHandCenters ? calculatePerFingerHomeCost(leftResult.pose, 'left', neutralHandCenters, 0.8) : 0;
        const rightHome = neutralHandCenters ? calculatePerFingerHomeCost(rightResult.pose, 'right', neutralHandCenters, 0.8) : 0;

        // Apply fallback penalties
        const leftFallbackPenalty = leftResult.isFallback ? FALLBACK_GRIP_PENALTY : 0;
        const rightFallbackPenalty = rightResult.isFallback ? FALLBACK_GRIP_PENALTY : 0;

        // Alternation: penalize same-finger repetition on short dt
        const prevAssignments = node.assignments.map((a) => ({ hand: a.hand, finger: a.finger }));
        const leftFingersForCost = Object.keys(leftResult.pose.fingers) as FingerType[];
        const rightFingersForCost = Object.keys(rightResult.pose.fingers) as FingerType[];
        const currentAssignments: Array<{ hand: 'left' | 'right'; finger: FingerType }> = [
          ...leftNoteIndices.map((_, j) => ({ hand: 'left' as const, finger: leftFingersForCost[j] })),
          ...rightNoteIndices.map((_, j) => ({ hand: 'right' as const, finger: rightFingersForCost[j] })),
        ];
        const alternationCost = calculateAlternationCost(prevAssignments, currentAssignments, rawTimeDelta);

        // Hand balance: penalize deviation from target left share
        const newLeftCount = node.leftCount + leftNoteIndices.length;
        const newRightCount = node.rightCount + rightNoteIndices.length;
        const handBalanceCost = calculateHandBalanceCost(newLeftCount, newRightCount);

        const stepComponents: ObjectiveComponents = {
          transition: effectiveLeftTransition + effectiveRightTransition,
          stretch: leftStatic + rightStatic,
          poseAttractor: leftAttractor + rightAttractor,
          perFingerHome: leftHome + rightHome,
          alternation: alternationCost,
          handBalance: handBalanceCost,
          constraints: leftFallbackPenalty + rightFallbackPenalty,
        };
        const stepCost = combineComponents(stepComponents);

        // Create assignments for ALL notes in the split chord (1:1 finger per note per hand)
        const assignments: NoteAssignment[] = [];
        const n = group.notes.length;
        const costPerNote = stepCost / n;
        const componentsPerNote: ObjectiveComponents = {
          transition: stepComponents.transition / n,
          stretch: stepComponents.stretch / n,
          poseAttractor: stepComponents.poseAttractor / n,
          perFingerHome: stepComponents.perFingerHome / n,
          alternation: stepComponents.alternation / n,
          handBalance: stepComponents.handBalance / n,
          constraints: stepComponents.constraints / n,
        };

        for (let j = 0; j < leftNoteIndices.length; j++) {
          const i = leftNoteIndices[j];
          const event = group.notes[i];
          const position = group.positions[i];
          const eventIndex = group.eventIndices[i];
          const eventKey = group.eventKeys[i];
          assignments.push({
            eventIndex,
            eventKey,
            noteNumber: event.noteNumber,
            startTime: event.startTime,
            hand: 'left',
            finger: leftFingers[j],
            grip: leftResult.pose,
            cost: costPerNote,
            row: position.row,
            col: position.col,
            costComponents: componentsPerNote,
          });
        }
        for (let j = 0; j < rightNoteIndices.length; j++) {
          const i = rightNoteIndices[j];
          const event = group.notes[i];
          const position = group.positions[i];
          const eventIndex = group.eventIndices[i];
          const eventKey = group.eventKeys[i];
          assignments.push({
            eventIndex,
            eventKey,
            noteNumber: event.noteNumber,
            startTime: event.startTime,
            hand: 'right',
            finger: rightFingers[j],
            grip: rightResult.pose,
            cost: costPerNote,
            row: position.row,
            col: position.col,
            costComponents: componentsPerNote,
          });
        }

        children.push({
          leftPose: leftResult.pose,
          rightPose: rightResult.pose,
          totalCost: node.totalCost + stepCost,
          parent: node,
          assignments, // All assignments for the split chord
          depth: node.depth + 1,
          leftCount: newLeftCount,
          rightCount: newRightCount,
        });
      }
    }

    return children;
  }

  /**
   * Prunes the beam to keep only the top K nodes by cost.
   */
  private pruneBeam(beam: BeamNode[], beamWidth: number): BeamNode[] {
    // Sort by total cost (ascending)
    beam.sort((a, b) => a.totalCost - b.totalCost);

    // Keep top K
    return beam.slice(0, beamWidth);
  }

  /**
   * Backtracks from the best node to build the assignment path.
   * Now handles multiple assignments per node (for chords).
   */
  private backtrack(node: BeamNode): NoteAssignment[] {
    const path: NoteAssignment[] = [];
    let current: BeamNode | null = node;

    while (current !== null) {
      // Prepend all assignments from this node (handles chords)
      if (current.assignments.length > 0) {
        path.unshift(...current.assignments);
      }
      current = current.parent;
    }

    return path;
  }

  /**
   * Builds EngineResult from the assignment path.
   */
  private buildResult(
    assignments: NoteAssignment[],
    totalEvents: number,
    unmappedIndices: Set<number>,
    config: EngineConfiguration,
    sortedEvents: Array<{ event: NoteEvent; originalIndex: number }>,
    coverage: { totalNotes: number; unmappedNotesCount: number; fallbackNotesCount: number }
  ): EngineResult {
    const debugEvents: EngineDebugEvent[] = [];
    const fingerUsageStats: FingerUsageStats = {};
    const fatigueMap: FatigueMap = {};

    let totalCost = 0;
    let unplayableCount = unmappedIndices.size;
    let hardCount = 0;
    let totalDrift = 0;
    let driftCount = 0;

    const totalMetrics: CostBreakdown = {
      movement: 0,
      stretch: 0,
      drift: 0,
      bounce: 0,
      fatigue: 0,
      crossover: 0,
      total: 0,
    };

    // Process assignments
    const assignmentMap = new Map<number, NoteAssignment>();
    for (const assignment of assignments) {
      assignmentMap.set(assignment.eventIndex, assignment);
    }

    // Build debug events for all events
    for (let i = 0; i < totalEvents; i++) {
      const assignment = assignmentMap.get(i);

      if (unmappedIndices.has(i)) {
        // Unmapped note - use actual event data
        const ev = sortedEvents[i]?.event;
        debugEvents.push({
          noteNumber: ev?.noteNumber ?? 0,
          startTime: ev?.startTime ?? 0,
          assignedHand: 'Unplayable',
          finger: null,
          cost: Infinity,
          costBreakdown: {
            movement: 0,
            stretch: 0,
            drift: 0,
            bounce: 0,
            fatigue: 0,
            crossover: 0,
            total: Infinity,
          },
          difficulty: 'Unplayable',
          eventIndex: i,
          eventKey: ev?.eventKey,
        });
        continue;
      }

      if (!assignment) {
        // No assignment found (shouldn't happen in normal flow)
        unplayableCount++;
        debugEvents.push({
          noteNumber: 0,
          startTime: 0,
          assignedHand: 'Unplayable',
          finger: null,
          cost: Infinity,
          costBreakdown: {
            movement: 0,
            stretch: 0,
            drift: 0,
            bounce: 0,
            fatigue: 0,
            crossover: 0,
            total: Infinity,
          },
          difficulty: 'Unplayable',
          eventIndex: i,
          // padId undefined for unplayable events
        });
        continue;
      }

      const difficulty = getDifficulty(assignment.cost);
      if (difficulty === 'Hard') hardCount++;

      // Update finger usage stats
      const fingerKey = `${assignment.hand === 'left' ? 'L' : 'R'}-${assignment.finger.charAt(0).toUpperCase() + assignment.finger.slice(1)}`;
      fingerUsageStats[fingerKey] = (fingerUsageStats[fingerKey] || 0) + 1;

      // Calculate drift from home (config is effectiveConfig when Pose 0 override is present)
      const { restingPose } = config;
      const homeCentroid = assignment.hand === 'left'
        ? restingPose.left.centroid
        : restingPose.right.centroid;
      const eventPos = { x: assignment.col, y: assignment.row };
      const drift = Math.sqrt(
        Math.pow(eventPos.x - homeCentroid.x, 2) +
        Math.pow(eventPos.y - homeCentroid.y, 2)
      );
      totalDrift += drift;
      driftCount++;

      // Cost breakdown from real objective components (no fake percentages)
      const costBreakdown: CostBreakdown = assignment.costComponents
        ? objectiveToCostBreakdown(assignment.costComponents)
        : {
            movement: assignment.cost * 0.4,
            stretch: assignment.cost * 0.2,
            drift: assignment.cost * 0.2,
            bounce: 0,
            fatigue: assignment.cost * 0.1,
            crossover: assignment.cost * 0.1,
            total: assignment.cost,
          };

      totalMetrics.movement += costBreakdown.movement;
      totalMetrics.stretch += costBreakdown.stretch;
      totalMetrics.drift += costBreakdown.drift;
      totalMetrics.fatigue += costBreakdown.fatigue;
      totalMetrics.crossover += costBreakdown.crossover;
      totalMetrics.total += costBreakdown.total;

      totalCost += assignment.cost;

      // Derive padId from row/col
      const padId = cellKey(assignment.row, assignment.col);

      debugEvents.push({
        noteNumber: assignment.noteNumber,
        startTime: assignment.startTime,
        assignedHand: assignment.hand,
        finger: assignment.finger,
        cost: assignment.cost,
        costBreakdown,
        difficulty,
        row: assignment.row,
        col: assignment.col,
        eventIndex: assignment.eventIndex,
        eventKey: assignment.eventKey,
        padId,
      });
    }

    // Calculate averages
    const eventCount = debugEvents.length - unplayableCount;
    const averageMetrics: CostBreakdown = eventCount > 0 ? {
      movement: totalMetrics.movement / eventCount,
      stretch: totalMetrics.stretch / eventCount,
      drift: totalMetrics.drift / eventCount,
      bounce: 0,
      fatigue: totalMetrics.fatigue / eventCount,
      crossover: totalMetrics.crossover / eventCount,
      total: totalMetrics.total / eventCount,
    } : {
      movement: 0, stretch: 0, drift: 0, bounce: 0, fatigue: 0, crossover: 0, total: 0,
    };

    // Initialize fatigue map with zeros (beam search doesn't track per-finger fatigue)
    const fingerTypes: FingerType[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
    for (const finger of fingerTypes) {
      fatigueMap[`L-${finger.charAt(0).toUpperCase() + finger.slice(1)}`] = 0;
      fatigueMap[`R-${finger.charAt(0).toUpperCase() + finger.slice(1)}`] = 0;
    }

    // Calculate score (0-100)
    let score = 100 - (5 * hardCount) - (20 * unplayableCount);
    if (score < 0) score = 0;

    return {
      score,
      unplayableCount,
      hardCount,
      debugEvents,
      fingerUsageStats,
      fatigueMap,
      averageDrift: driftCount > 0 ? totalDrift / driftCount : 0,
      averageMetrics,
      metadata: {
        mappingIdUsed: this.gridMapping?.id,
        mappingHashUsed: this.gridMapping ? hashGridMapping(this.gridMapping) : undefined,
        mappingCoverage: coverage,
        strictMode: this.mappingResolverMode === 'strict',
        beamWidthUsed: config.beamWidth,
        objectiveTotal: averageMetrics.total,
        objectiveComponentsSummary: {
          transition: totalMetrics.movement,
          stretch: totalMetrics.stretch,
          poseAttractor: totalMetrics.drift,
          perFingerHome: totalMetrics.fatigue,
          alternation: totalMetrics.bounce,
          handBalance: 0,
          constraints: totalMetrics.crossover,
        },
      },
    };
  }

  /**
   * Solves the performance asynchronously (wraps solveSync).
   * 
   * @param performance - The performance data to analyze
   * @param config - Engine configuration (beam width, stiffness, resting pose)
   * @param manualAssignments - Optional map of event index to forced finger assignment
   * @returns Promise resolving to EngineResult with score and debug events
   */
  public async solve(
    performance: Performance,
    config: EngineConfiguration,
    manualAssignments?: Record<string, { hand: 'left' | 'right', finger: FingerType }>
  ): Promise<EngineResult> {
    return Promise.resolve(this.solveSync(performance, config, manualAssignments));
  }

  /**
   * Solves the performance using Beam Search algorithm with group-based processing.
   * 
   * Key improvements:
   * - Groups simultaneous notes (chords) into PerformanceGroups
   * - Uses tiered grip generation (strict → relaxed → fallback) that NEVER fails
   * - Calculates timeDelta between groups, not individual events
   * 
   * @param performance - The performance data to analyze
   * @param config - Engine configuration (beam width, stiffness, resting pose)
   * @param manualAssignments - Optional map of event index to forced finger assignment
   * @returns EngineResult with score and debug events
   */
  public solveSync(
    performance: Performance,
    config: EngineConfiguration,
    manualAssignments?: Record<string, { hand: 'left' | 'right', finger: FingerType }>
  ): EngineResult {
    // Compute neutral hand centers from Pose 0 override or the current layout
    let neutralHandCenters: NeutralHandCenters | null = null;
    if (this.neutralPadPositionsOverride) {
      // Use Natural Hand Pose 0 override - derive centers from per-finger positions
      try {
        neutralHandCenters = computeNeutralHandCenters(this.neutralPadPositionsOverride);
      } catch (error) {
        console.warn('[BeamSolver] Failed to compute neutral hand centers from Pose 0 override:', error);
        // Fall back to layout-based centers
      }
    }
    
    // Fall back to layout-based neutral centers if override not available or failed
    if (!neutralHandCenters && this.gridMapping) {
      try {
        neutralHandCenters = getNeutralHandCenters(this.gridMapping, this.instrumentConfig);
      } catch (error) {
        console.warn('[BeamSolver] Failed to compute neutral hand centers from layout:', error);
        // Continue without neutral centers (graceful degradation)
      }
    }

    // When Pose 0 override is present, use it as the attractor resting pose and strengthen the attractor
    const effectiveRestingPose = this.neutralPadPositionsOverride
      ? (restingPoseFromNeutralPadPositions(this.neutralPadPositionsOverride) ?? config.restingPose)
      : config.restingPose;
    const effectiveStiffness = this.neutralPadPositionsOverride
      ? Math.min(2.0, config.stiffness * 2.0)
      : config.stiffness;
    const effectiveConfig: EngineConfiguration = {
      ...config,
      restingPose: effectiveRestingPose,
      stiffness: effectiveStiffness,
    };

    // Sort events by time (stable tie-break: startTime, channel, noteNumber, eventKey)
    const sortedEvents = [...performance.events]
      .map((event, originalIndex) => ({ event, originalIndex }))
      .sort((a, b) => {
        const dt = a.event.startTime - b.event.startTime;
        if (dt !== 0) return dt;
        const ch = (a.event.channel ?? 0) - (b.event.channel ?? 0);
        if (ch !== 0) return ch;
        const nn = a.event.noteNumber - b.event.noteNumber;
        if (nn !== 0) return nn;
        return (a.event.eventKey ?? '').localeCompare(b.event.eventKey ?? '');
      });

    // Build note-to-pad index once (O(cells)), then resolve each event O(1)
    // When mapping is null, use allow-fallback (L01 chromatic); when mapping exists, use configured mode
    const noteToPadIndex = buildNoteToPadIndex(this.gridMapping?.cells ?? {});
    const effectiveMode =
      this.gridMapping === null ? 'allow-fallback' : this.mappingResolverMode;
    const eventsWithPositions = sortedEvents.map(({ event, originalIndex }) => {
      const res = resolveNoteToPad(
        event.noteNumber,
        noteToPadIndex,
        this.instrumentConfig,
        effectiveMode
      );
      const position: GridPosition | null =
        res.source === 'mapping' || res.source === 'fallback'
          ? { row: res.pad.row, col: res.pad.col }
          : null;
      return {
        event,
        index: originalIndex,
        position,
        resolutionSource: res.source,
      };
    });

    // Track unmapped notes and fallback count
    const unmappedIndices = new Set<number>();
    let fallbackCount = 0;
    eventsWithPositions.forEach(({ index, position, resolutionSource }) => {
      if (!position) unmappedIndices.add(index);
      else if (resolutionSource === 'fallback') fallbackCount++;
    });

    // Group events by timestamp (handles chords correctly)
    const groups = groupEventsByTimestamp(eventsWithPositions);

    // Initialize beam with resting pose (uses Pose 0 when override present)
    let beam = this.createInitialBeam(effectiveConfig);
    let prevTimestamp = 0;

    // Process each group (single notes and chords treated uniformly)
    for (const group of groups) {
      const newBeam: BeamNode[] = [];

      for (const node of beam) {
        // Check for manual override on first event in group
        // If the event has an eventKey and it's in the assignments, use it. Otherwise, fallback to stringified index.
        const overrideIdx = group.eventIndices.findIndex((idx, i) => {
          const key = group.eventKeys[i];
          if (key !== undefined && manualAssignments && manualAssignments[key]) return true;
          if (manualAssignments && manualAssignments[idx.toString()]) return true;
          return false;
        });

        const hasManualOverride = overrideIdx !== -1;

        if (hasManualOverride && manualAssignments) {
          // Handle manual override for first event
          const idx = group.eventIndices[overrideIdx];
          const key = group.eventKeys[overrideIdx];
          const override = (key !== undefined && manualAssignments[key])
            ? manualAssignments[key]
            : manualAssignments[idx.toString()];

          if (override) {
            const gripResults = generateValidGripsWithTier(group.activePads, override.hand);

            // Find grip that uses the specified finger
            const matchingResult = gripResults.find(r =>
              Object.keys(r.pose.fingers).includes(override.finger)
            ) || gripResults[0];

            if (matchingResult) {
              const timeDelta = group.timestamp - prevTimestamp;
              const prevPose = override.hand === 'left' ? node.leftPose : node.rightPose;
              const restPose = override.hand === 'left'
                ? effectiveConfig.restingPose.left
                : effectiveConfig.restingPose.right;

              const transitionCost = calculateTransitionCost(prevPose, matchingResult.pose, timeDelta);
              const attractorCost = calculateAttractorCost(matchingResult.pose, restPose, effectiveConfig.stiffness);
              const staticCost = calculateGripStretchCost(matchingResult.pose, override.hand, undefined, undefined, neutralHandCenters);
              const perFingerHomeCost = neutralHandCenters
                ? calculatePerFingerHomeCost(matchingResult.pose, override.hand, neutralHandCenters, 0.8)
                : 0;
              const fallbackPenalty = matchingResult.isFallback ? FALLBACK_GRIP_PENALTY : 0;
              const effectiveTransition = transitionCost === Infinity ? 100 : transitionCost;
              const stepComponents: ObjectiveComponents = {
                transition: effectiveTransition,
                stretch: staticCost,
                poseAttractor: attractorCost,
                perFingerHome: perFingerHomeCost,
                alternation: 0,
                handBalance: 0,
                constraints: fallbackPenalty,
              };
              const stepCost = combineComponents(stepComponents);

              // Create assignments for ALL notes in the group (handles chords)
              const assignments: NoteAssignment[] = [];
              const n = group.notes.length;
              const costPerNote = stepCost / n;
              const componentsPerNote: ObjectiveComponents = {
                transition: stepComponents.transition / n,
                stretch: stepComponents.stretch / n,
                poseAttractor: stepComponents.poseAttractor / n,
                perFingerHome: stepComponents.perFingerHome / n,
                alternation: 0,
                handBalance: 0,
                constraints: stepComponents.constraints / n,
              };
              const gripFingers = Object.keys(matchingResult.pose.fingers) as FingerType[];

              for (let i = 0; i < n; i++) {
                assignments.push({
                  eventIndex: group.eventIndices[i],
                  eventKey: group.eventKeys[i],
                  noteNumber: group.notes[i].noteNumber,
                  startTime: group.notes[i].startTime,
                  hand: override.hand,
                  finger: gripFingers[i % gripFingers.length] || override.finger,
                  grip: matchingResult.pose,
                  cost: costPerNote,
                  row: group.positions[i].row,
                  col: group.positions[i].col,
                  costComponents: componentsPerNote,
                });
              }

              const newLeftCount = node.leftCount + (override.hand === 'left' ? n : 0);
              const newRightCount = node.rightCount + (override.hand === 'right' ? n : 0);

              newBeam.push({
                leftPose: override.hand === 'left' ? matchingResult.pose : node.leftPose,
                rightPose: override.hand === 'right' ? matchingResult.pose : node.rightPose,
                totalCost: node.totalCost + stepCost,
                parent: node,
                assignments,
                depth: node.depth + 1,
                leftCount: newLeftCount,
                rightCount: newRightCount,
              });
            }
            continue;
          }
        }

        // Standard expansion using group-based approach
        const children = this.expandNodeForGroup(node, group, prevTimestamp, effectiveConfig, neutralHandCenters);
        newBeam.push(...children);

        // For multi-note chords, also try split-hand approach
        if (group.activePads.length >= 2) {
          const splitChildren = this.expandNodeForSplitChord(node, group, prevTimestamp, config, neutralHandCenters);
          newBeam.push(...splitChildren);
        }
      }

      // Safety net: Should never be empty due to tiered fallback, but check anyway
      if (newBeam.length === 0) {
        console.warn(`No valid expansions for group at t=${group.timestamp}. Using emergency fallback.`);

        const fallbackFingers: FingerType[] = ['index', 'middle', 'ring', 'thumb', 'pinky'];

        const emergencyComponentsPerNote: ObjectiveComponents = {
          transition: 0,
          stretch: 0,
          poseAttractor: 0,
          perFingerHome: 0,
          alternation: 0,
          handBalance: 0,
          constraints: FALLBACK_GRIP_PENALTY / group.notes.length,
        };

        for (const node of beam) {
          const assignments: NoteAssignment[] = [];
          const costPerNote = FALLBACK_GRIP_PENALTY / group.notes.length;

          const leftIndices: number[] = [];
          const rightIndices: number[] = [];
          for (let i = 0; i < group.notes.length; i++) {
            const leftDist = Math.abs(group.positions[i].col - 2);
            const rightDist = Math.abs(group.positions[i].col - 5);
            if (leftDist <= rightDist) leftIndices.push(i);
            else rightIndices.push(i);
          }

          for (let j = 0; j < Math.min(leftIndices.length, fallbackFingers.length); j++) {
            const i = leftIndices[j];
            const finger = fallbackFingers[j];
            const fallbackGrip: HandPose = {
              centroid: { x: group.positions[i].col, y: group.positions[i].row },
              fingers: { [finger]: { x: group.positions[i].col, y: group.positions[i].row } },
            };
            assignments.push({
              eventIndex: group.eventIndices[i],
              eventKey: group.eventKeys[i],
              noteNumber: group.notes[i].noteNumber,
              startTime: group.notes[i].startTime,
              hand: 'left',
              finger,
              grip: fallbackGrip,
              cost: costPerNote,
              row: group.positions[i].row,
              col: group.positions[i].col,
              costComponents: emergencyComponentsPerNote,
            });
          }
          for (let j = 0; j < Math.min(rightIndices.length, fallbackFingers.length); j++) {
            const i = rightIndices[j];
            const finger = fallbackFingers[j];
            const fallbackGrip: HandPose = {
              centroid: { x: group.positions[i].col, y: group.positions[i].row },
              fingers: { [finger]: { x: group.positions[i].col, y: group.positions[i].row } },
            };
            assignments.push({
              eventIndex: group.eventIndices[i],
              eventKey: group.eventKeys[i],
              noteNumber: group.notes[i].noteNumber,
              startTime: group.notes[i].startTime,
              hand: 'right',
              finger,
              grip: fallbackGrip,
              cost: costPerNote,
              row: group.positions[i].row,
              col: group.positions[i].col,
              costComponents: emergencyComponentsPerNote,
            });
          }

          // Use the first note's position for the beam node's hand pose
          const firstFallbackGrip: HandPose = {
            centroid: { x: group.positions[0].col, y: group.positions[0].row },
            fingers: { index: { x: group.positions[0].col, y: group.positions[0].row } },
          };
          const leftDist = Math.abs(group.positions[0].col - 2);
          const rightDist = Math.abs(group.positions[0].col - 5);
          const primaryHand = leftDist <= rightDist ? 'left' : 'right';

          const newLeftCount = node.leftCount + leftIndices.length;
          const newRightCount = node.rightCount + rightIndices.length;

          newBeam.push({
            leftPose: primaryHand === 'left' ? firstFallbackGrip : node.leftPose,
            rightPose: primaryHand === 'right' ? firstFallbackGrip : node.rightPose,
            totalCost: node.totalCost + FALLBACK_GRIP_PENALTY,
            parent: node,
            assignments,
            depth: node.depth + 1,
            leftCount: newLeftCount,
            rightCount: newRightCount,
          });
        }
      }

      // Prune beam to keep top K candidates
      beam = this.pruneBeam(newBeam, effectiveConfig.beamWidth);
      prevTimestamp = group.timestamp;
    }

    // Find best node (lowest total cost)
    const requiredNotes = new Set(performance.events.map((e) => e.noteNumber));
    const unmappedNoteNumbers = new Set(
      eventsWithPositions.filter((e) => !e.position).map((e) => e.event.noteNumber)
    );
    const coverage = {
      totalNotes: requiredNotes.size,
      unmappedNotesCount: unmappedNoteNumbers.size,
      fallbackNotesCount: fallbackCount,
    };

    if (beam.length === 0) {
      return this.buildResult(
        [],
        performance.events.length,
        unmappedIndices,
        effectiveConfig,
        sortedEvents,
        coverage
      );
    }

    const bestNode = beam.reduce((best, node) =>
      node.totalCost < best.totalCost ? node : best
    );

    // Backtrack to build optimal assignment path
    const assignments = this.backtrack(bestNode);

    return this.buildResult(
      assignments,
      performance.events.length,
      unmappedIndices,
      effectiveConfig,
      sortedEvents,
      coverage
    );
  }
}

/**
 * Factory function to create a BeamSolver instance.
 */
export function createBeamSolver(config: SolverConfig): BeamSolver {
  return new BeamSolver(config);
}

