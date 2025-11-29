/**
 * BeamSolver - Beam Search optimization algorithm.
 * 
 * Assigns fingers to notes based on biomechanical constraints and cost optimization.
 * The Beam Search approach maintains K best candidates at each step, allowing
 * for more globally optimal solutions compared to greedy approaches.
 */

import { Performance, NoteEvent, HandPose, EngineConfiguration } from '../../types/performance';
import { InstrumentConfig } from '../../types/performance';
import { GridMapService } from '../gridMapService';
import { FingerType } from '../models';
import { GridMapping } from '../../types/layout';
import { generateValidGripsWithTier, Pad } from '../feasibility';
import {
  calculateAttractorCost,
  calculateTransitionCost,
  calculateGripStretchCost,
  FALLBACK_GRIP_PENALTY,
} from '../costFunction';
import { GridPosition } from '../gridMath';
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
 */
interface NoteAssignment {
  eventIndex: number;
  noteNumber: number;
  startTime: number;
  hand: 'left' | 'right';
  finger: FingerType;
  grip: HandPose;
  cost: number;
  row: number;
  col: number;
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
        activePads: [pad],
        positions: [position],
      };
      groups.push(currentGroup);
    } else {
      // Add to current group (simultaneous event / chord)
      currentGroup.notes.push(event);
      currentGroup.eventIndices.push(index);
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

  constructor(config: SolverConfig) {
    this.instrumentConfig = config.instrumentConfig;
    this.gridMapping = config.gridMapping ?? null;
  }

  /**
   * Gets the grid position for a MIDI note.
   * Prioritizes the custom GridMapping if available.
   */
  private getNotePosition(noteNumber: number): GridPosition | null {
    // 1. Try custom mapping first
    if (this.gridMapping) {
      for (const [key, voice] of Object.entries(this.gridMapping.cells)) {
        if (voice.originalMidiNote === noteNumber) {
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
    config: EngineConfiguration
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
        const staticCost = calculateGripStretchCost(grip);
        
        // Apply fallback penalty if this is a fallback grip
        const fallbackPenalty = isFallback ? FALLBACK_GRIP_PENALTY : 0;

        const stepCost = effectiveTransitionCost + attractorCost + staticCost + fallbackPenalty;
        const newTotalCost = node.totalCost + stepCost;

        // Get fingers from grip for assignment
        const gripFingers = Object.keys(grip.fingers) as FingerType[];
        if (gripFingers.length === 0) continue;

        // Create assignments for ALL notes in the group (handles chords correctly)
        // Each note in the chord gets its own assignment with the appropriate finger
        const assignments: NoteAssignment[] = [];
        const costPerNote = stepCost / group.notes.length; // Distribute cost across notes
        
        for (let i = 0; i < group.notes.length; i++) {
          const event = group.notes[i];
          const position = group.positions[i];
          const eventIndex = group.eventIndices[i];
          
          // Assign finger based on position in grip (or use first finger for all if not enough)
          const finger = gripFingers[i % gripFingers.length];
          
          assignments.push({
            eventIndex,
            noteNumber: event.noteNumber,
            startTime: event.startTime,
            hand,
            finger,
            grip,
            cost: costPerNote,
            row: position.row,
            col: position.col,
          });
        }

        const childNode: BeamNode = {
          leftPose: hand === 'left' ? grip : node.leftPose,
          rightPose: hand === 'right' ? grip : node.rightPose,
          totalCost: newTotalCost,
          parent: node,
          assignments, // Now stores ALL assignments for the chord
          depth: node.depth + 1,
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
    config: EngineConfiguration
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
    
    const leftGripResults = generateValidGripsWithTier(leftPads, 'left');
    const rightGripResults = generateValidGripsWithTier(rightPads, 'right');
    
    for (const leftResult of leftGripResults) {
      for (const rightResult of rightGripResults) {
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
        const leftStatic = calculateGripStretchCost(leftResult.pose);
        const rightStatic = calculateGripStretchCost(rightResult.pose);
        
        // Apply fallback penalties
        const leftFallbackPenalty = leftResult.isFallback ? FALLBACK_GRIP_PENALTY : 0;
        const rightFallbackPenalty = rightResult.isFallback ? FALLBACK_GRIP_PENALTY : 0;
        
        const stepCost = effectiveLeftTransition + effectiveRightTransition + 
                         leftAttractor + rightAttractor + 
                         leftStatic + rightStatic +
                         leftFallbackPenalty + rightFallbackPenalty;
        
        // Create assignments for ALL notes in the split chord
        const assignments: NoteAssignment[] = [];
        const costPerNote = stepCost / group.notes.length;
        
        // Get fingers from both grips
        const leftFingers = Object.keys(leftResult.pose.fingers) as FingerType[];
        const rightFingers = Object.keys(rightResult.pose.fingers) as FingerType[];
        
        for (let i = 0; i < group.notes.length; i++) {
          const event = group.notes[i];
          const position = group.positions[i];
          const eventIndex = group.eventIndices[i];
          
          // Determine which hand based on pad position (left pads -> left hand)
          const isLeftPad = i < leftPads.length;
          const hand = isLeftPad ? 'left' : 'right';
          const fingers = isLeftPad ? leftFingers : rightFingers;
          const grip = isLeftPad ? leftResult.pose : rightResult.pose;
          const fingerIndex = isLeftPad ? i : i - leftPads.length;
          const finger = fingers[fingerIndex % fingers.length] || 'index';
          
          assignments.push({
            eventIndex,
            noteNumber: event.noteNumber,
            startTime: event.startTime,
            hand,
            finger,
            grip,
            cost: costPerNote,
            row: position.row,
            col: position.col,
          });
        }
        
        children.push({
          leftPose: leftResult.pose,
          rightPose: rightResult.pose,
          totalCost: node.totalCost + stepCost,
          parent: node,
          assignments, // All assignments for the split chord
          depth: node.depth + 1,
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
    config: EngineConfiguration
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
        // Unmapped note
        debugEvents.push({
          noteNumber: 0, // Unknown
          startTime: 0,
          assignedHand: 'Unplayable',
          finger: null,
          cost: Infinity,
          difficulty: 'Unplayable',
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
          difficulty: 'Unplayable',
        });
        continue;
      }

      const difficulty = getDifficulty(assignment.cost);
      if (difficulty === 'Hard') hardCount++;

      // Update finger usage stats
      const fingerKey = `${assignment.hand === 'left' ? 'L' : 'R'}-${assignment.finger.charAt(0).toUpperCase() + assignment.finger.slice(1)}`;
      fingerUsageStats[fingerKey] = (fingerUsageStats[fingerKey] || 0) + 1;

      // Calculate drift from home
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

      // Cost breakdown (simplified for beam search)
      const costBreakdown: CostBreakdown = {
        movement: assignment.cost * 0.4, // Approximate breakdown
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
    manualAssignments?: Record<number, { hand: 'left' | 'right', finger: FingerType }>
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
    manualAssignments?: Record<number, { hand: 'left' | 'right', finger: FingerType }>
  ): EngineResult {
    // Sort events by time
    const sortedEvents = [...performance.events]
      .map((event, originalIndex) => ({ event, originalIndex }))
      .sort((a, b) => a.event.startTime - b.event.startTime);

    // Map events to grid positions
    const eventsWithPositions = sortedEvents.map(({ event, originalIndex }) => ({
      event,
      index: originalIndex,
      position: this.getNotePosition(event.noteNumber),
    }));

    // Track unmapped notes
    const unmappedIndices = new Set<number>();
    eventsWithPositions.forEach(({ index, position }) => {
      if (!position) unmappedIndices.add(index);
    });

    // Group events by timestamp (handles chords correctly)
    const groups = groupEventsByTimestamp(eventsWithPositions);

    // Initialize beam with resting pose
    let beam = this.createInitialBeam(config);
    let prevTimestamp = 0;

    // Process each group (single notes and chords treated uniformly)
    for (const group of groups) {
      const newBeam: BeamNode[] = [];

      for (const node of beam) {
        // Check for manual override on first event in group
        const hasManualOverride = manualAssignments && 
          group.eventIndices.some(idx => manualAssignments[idx]);
        
        if (hasManualOverride && manualAssignments) {
          // Handle manual override for first event
          const overrideIdx = group.eventIndices.find(idx => manualAssignments[idx]);
          if (overrideIdx !== undefined) {
            const override = manualAssignments[overrideIdx];
            const gripResults = generateValidGripsWithTier(group.activePads, override.hand);
            
            // Find grip that uses the specified finger
            const matchingResult = gripResults.find(r => 
              Object.keys(r.pose.fingers).includes(override.finger)
            ) || gripResults[0];

            if (matchingResult) {
              const timeDelta = group.timestamp - prevTimestamp;
              const prevPose = override.hand === 'left' ? node.leftPose : node.rightPose;
              const restPose = override.hand === 'left' 
                ? config.restingPose.left 
                : config.restingPose.right;

              const transitionCost = calculateTransitionCost(prevPose, matchingResult.pose, timeDelta);
              const attractorCost = calculateAttractorCost(matchingResult.pose, restPose, config.stiffness);
              const staticCost = calculateGripStretchCost(matchingResult.pose);
              const fallbackPenalty = matchingResult.isFallback ? FALLBACK_GRIP_PENALTY : 0;
              const effectiveTransition = transitionCost === Infinity ? 100 : transitionCost;
              const stepCost = effectiveTransition + attractorCost + staticCost + fallbackPenalty;

              // Create assignments for ALL notes in the group (handles chords)
              const assignments: NoteAssignment[] = [];
              const costPerNote = stepCost / group.notes.length;
              const gripFingers = Object.keys(matchingResult.pose.fingers) as FingerType[];
              
              for (let i = 0; i < group.notes.length; i++) {
                assignments.push({
                  eventIndex: group.eventIndices[i],
                  noteNumber: group.notes[i].noteNumber,
                  startTime: group.notes[i].startTime,
                  hand: override.hand,
                  finger: gripFingers[i % gripFingers.length] || override.finger,
                  grip: matchingResult.pose,
                  cost: costPerNote,
                  row: group.positions[i].row,
                  col: group.positions[i].col,
                });
              }

              newBeam.push({
                leftPose: override.hand === 'left' ? matchingResult.pose : node.leftPose,
                rightPose: override.hand === 'right' ? matchingResult.pose : node.rightPose,
                totalCost: node.totalCost + stepCost,
                parent: node,
                assignments,
                depth: node.depth + 1,
              });
            }
            continue;
          }
        }
        
        // Standard expansion using group-based approach
        const children = this.expandNodeForGroup(node, group, prevTimestamp, config);
        newBeam.push(...children);
        
        // For multi-note chords, also try split-hand approach
        if (group.activePads.length >= 2) {
          const splitChildren = this.expandNodeForSplitChord(node, group, prevTimestamp, config);
          newBeam.push(...splitChildren);
        }
      }

      // Safety net: Should never be empty due to tiered fallback, but check anyway
      if (newBeam.length === 0) {
        console.warn(`No valid expansions for group at t=${group.timestamp}. Using emergency fallback.`);
        
        // Emergency fallback: create minimal assignments for ALL notes in group
        for (const node of beam) {
          const assignments: NoteAssignment[] = [];
          const costPerNote = FALLBACK_GRIP_PENALTY / group.notes.length;
          
          for (let i = 0; i < group.notes.length; i++) {
            const fallbackGrip: HandPose = {
              centroid: { x: group.positions[i].col, y: group.positions[i].row },
              fingers: {
                index: { x: group.positions[i].col, y: group.positions[i].row },
              },
            };
            
            const leftDist = Math.abs(group.positions[i].col - 2);
            const rightDist = Math.abs(group.positions[i].col - 5);
            const hand = leftDist <= rightDist ? 'left' : 'right';
            
            assignments.push({
              eventIndex: group.eventIndices[i],
              noteNumber: group.notes[i].noteNumber,
              startTime: group.notes[i].startTime,
              hand,
              finger: 'index',
              grip: fallbackGrip,
              cost: costPerNote,
              row: group.positions[i].row,
              col: group.positions[i].col,
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
          
          newBeam.push({
            leftPose: primaryHand === 'left' ? firstFallbackGrip : node.leftPose,
            rightPose: primaryHand === 'right' ? firstFallbackGrip : node.rightPose,
            totalCost: node.totalCost + FALLBACK_GRIP_PENALTY,
            parent: node,
            assignments,
            depth: node.depth + 1,
          });
        }
      }

      // Prune beam to keep top K candidates
      beam = this.pruneBeam(newBeam, config.beamWidth);
      prevTimestamp = group.timestamp;
    }

    // Find best node (lowest total cost)
    if (beam.length === 0) {
      return this.buildResult([], performance.events.length, unmappedIndices, config);
    }

    const bestNode = beam.reduce((best, node) => 
      node.totalCost < best.totalCost ? node : best
    );

    // Backtrack to build optimal assignment path
    const assignments = this.backtrack(bestNode);

    return this.buildResult(assignments, performance.events.length, unmappedIndices, config);
  }
}

/**
 * Factory function to create a BeamSolver instance.
 */
export function createBeamSolver(config: SolverConfig): BeamSolver {
  return new BeamSolver(config);
}

