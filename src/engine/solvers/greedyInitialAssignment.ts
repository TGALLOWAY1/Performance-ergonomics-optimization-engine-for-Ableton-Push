/**
 * Greedy Initial Assignment
 * 
 * Creates an initial finger assignment using a greedy heuristic seeded from
 * the neutral hand pose. This provides a reasonable starting point for solvers
 * instead of random initialization.
 */

import { Performance, NoteEvent } from '../../types/performance';
import { GridMapping } from '../../types/layout';
import { InstrumentConfig } from '../../types/performance';
import { FingerType } from '../models';
import { resolveNeutralPadPositions, NeutralPadPositions } from '../handPose';
import { GridMapService } from '../gridMapService';
import { calculateGridDistance } from '../gridMath';

// ============================================================================
// Types
// ============================================================================

/**
 * Parameters for building a greedy initial assignment.
 */
export interface GreedyInitialAssignmentParams {
  /** Current grid mapping configuration */
  layout: GridMapping;
  /** Instrument configuration defining Voice-to-Pad mapping */
  instrumentConfig: InstrumentConfig;
  /** Performance events to assign */
  events: NoteEvent[];
}

/**
 * Finger position tracking during greedy assignment.
 */
interface FingerPosition {
  row: number;
  col: number;
  fingerKey: string; // "L1", "L2", ..., "R5"
}

/**
 * Hand state tracking during greedy assignment.
 */
interface HandState {
  fingers: Map<string, FingerPosition>; // fingerKey -> position
  span: number; // Current span width
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum movement distance for a finger to be considered for an event.
 * Beyond this, the finger is considered too far away.
 */
const MAX_MOVEMENT_DISTANCE = 4;

/**
 * Maximum span width for a hand before applying stretch penalty.
 */
const MAX_HAND_SPAN = 4;

/**
 * Weight for movement cost in the greedy heuristic.
 */
const MOVEMENT_WEIGHT = 1.0;

/**
 * Weight for stretch cost in the greedy heuristic.
 */
const STRETCH_WEIGHT = 2.0;

/**
 * Weight for crossover penalty in the greedy heuristic.
 */
const CROSSOVER_WEIGHT = 5.0;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculates simple movement cost between two pad positions.
 */
function calculateMovementCost(
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): number {
  return calculateGridDistance(
    { row: fromRow, col: fromCol },
    { row: toRow, col: toCol }
  );
}

/**
 * Calculates stretch cost for a hand based on finger positions.
 * Returns 0 if span is within acceptable range, otherwise a penalty.
 */
function calculateStretchCost(handState: HandState): number {
  if (handState.fingers.size < 2) return 0;
  
  const positions = Array.from(handState.fingers.values());
  let minCol = Infinity;
  let maxCol = -Infinity;
  
  for (const pos of positions) {
    minCol = Math.min(minCol, pos.col);
    maxCol = Math.max(maxCol, pos.col);
  }
  
  const span = maxCol - minCol;
  if (span <= MAX_HAND_SPAN) return 0;
  
  // Penalty increases quadratically with excess span
  const excess = span - MAX_HAND_SPAN;
  return excess * excess;
}

/**
 * Checks if assigning a finger to a pad would cause a crossover.
 * A crossover occurs when a finger is positioned to the right of a finger
 * with a higher number (e.g., index to the right of middle).
 */
function wouldCauseCrossover(
  handState: HandState,
  fingerKey: string,
  targetCol: number
): boolean {
  const fingerNum = parseInt(fingerKey.slice(1), 10); // Extract number from "L1", "R2", etc.
  
  for (const [otherKey, otherPos] of handState.fingers.entries()) {
    const otherNum = parseInt(otherKey.slice(1), 10);
    
    // If this finger is to the right of a higher-numbered finger, it's a crossover
    if (fingerNum < otherNum && targetCol > otherPos.col) {
      return true;
    }
    // If this finger is to the left of a lower-numbered finger, it's a crossover
    if (fingerNum > otherNum && targetCol < otherPos.col) {
      return true;
    }
  }
  
  return false;
}

/**
 * Maps finger key ("L1", "R2", etc.) to FingerType.
 */
function fingerKeyToFingerType(fingerKey: string): FingerType {
  const num = parseInt(fingerKey.slice(1), 10);
  switch (num) {
    case 1: return 'thumb';
    case 2: return 'index';
    case 3: return 'middle';
    case 4: return 'ring';
    case 5: return 'pinky';
    default: return 'index';
  }
}

/**
 * Determines which hand should play a pad based on column position.
 * Left hand typically plays left side (cols 0-3), right hand plays right side (cols 4-7).
 */
function determineHandForPad(col: number): 'left' | 'right' {
  return col < 4 ? 'left' : 'right';
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Builds a greedy initial finger assignment seeded from the neutral hand pose.
 * 
 * This function:
 * 1. Resolves neutral pad positions for each finger
 * 2. Walks through events in time order
 * 3. For each event, selects the best finger using a simple greedy heuristic
 * 4. Returns a manual assignments map compatible with the solver system
 * 
 * @param params - Parameters including layout, instrument config, and events
 * @returns Manual assignments map: Record<eventIndex, { hand, finger }>
 */
export function buildNeutralGreedyInitialAssignment(
  params: GreedyInitialAssignmentParams
): Record<number, { hand: 'left' | 'right'; finger: FingerType }> {
  const { layout, instrumentConfig, events } = params;
  
  // Early return if no events
  if (!events || events.length === 0) {
    return {};
  }
  
  // 1. Resolve neutral pads for each finger
  const neutralPads = resolveNeutralPadPositions(layout, instrumentConfig);
  
  // 2. Initialize current pad positions per finger from neutral pads
  const leftHandState: HandState = {
    fingers: new Map(),
    span: 0,
  };
  const rightHandState: HandState = {
    fingers: new Map(),
    span: 0,
  };
  
  // Populate initial positions from neutral pads
  for (const [fingerKey, padPos] of Object.entries(neutralPads)) {
    const hand = fingerKey.startsWith('L') ? 'left' : 'right';
    const handState = hand === 'left' ? leftHandState : rightHandState;
    
    handState.fingers.set(fingerKey, {
      row: padPos.row,
      col: padPos.col,
      fingerKey,
    });
  }
  
  // Calculate initial spans
  if (leftHandState.fingers.size >= 2) {
    const leftCols = Array.from(leftHandState.fingers.values()).map(p => p.col);
    leftHandState.span = leftCols.length > 0 ? Math.max(...leftCols) - Math.min(...leftCols) : 0;
  }
  if (rightHandState.fingers.size >= 2) {
    const rightCols = Array.from(rightHandState.fingers.values()).map(p => p.col);
    rightHandState.span = rightCols.length > 0 ? Math.max(...rightCols) - Math.min(...rightCols) : 0;
  }
  
  // 3. Allocate result map
  const assignments: Record<number, { hand: 'left' | 'right'; finger: FingerType }> = {};
  
  // 4. Sort events by time (if not already sorted)
  const sortedEvents = [...events].sort((a, b) => a.startTime - b.startTime);
  
  // 5. Process events in time order
  for (let eventIndex = 0; eventIndex < sortedEvents.length; eventIndex++) {
    const event = sortedEvents[eventIndex];
    
    // Get pad position for this event's note number
    const padPosition = GridMapService.noteToGrid(event.noteNumber, instrumentConfig);
    if (!padPosition) {
      // Note is outside the grid - skip it (will be marked as Unplayable by solver)
      continue;
    }
    
    const [eventRow, eventCol] = padPosition;
    
    // Determine which hand should play this pad
    const preferredHand = determineHandForPad(eventCol);
    const handState = preferredHand === 'left' ? leftHandState : rightHandState;
    const otherHandState = preferredHand === 'left' ? rightHandState : leftHandState;
    
    // Try both hands, but prefer the natural hand for this column
    const candidates: Array<{ hand: 'left' | 'right'; handState: HandState; fingerKey: string; cost: number }> = [];
    
    // Evaluate fingers from preferred hand
    for (const [fingerKey, fingerPos] of handState.fingers.entries()) {
      const movement = calculateMovementCost(fingerPos.row, fingerPos.col, eventRow, eventCol);
      
      // Skip if too far
      if (movement > MAX_MOVEMENT_DISTANCE) continue;
      
      // Check for crossover
      const crossover = wouldCauseCrossover(handState, fingerKey, eventCol);
      
      // Calculate costs
      const movementCost = movement * MOVEMENT_WEIGHT;
      const crossoverCost = crossover ? CROSSOVER_WEIGHT : 0;
      
      // Estimate stretch cost (simplified - assume adding this finger increases span)
      const tempSpan = Math.max(
        ...Array.from(handState.fingers.values()).map(p => p.col),
        eventCol
      ) - Math.min(
        ...Array.from(handState.fingers.values()).map(p => p.col),
        eventCol
      );
      const stretchCost = tempSpan > MAX_HAND_SPAN ? (tempSpan - MAX_HAND_SPAN) * (tempSpan - MAX_HAND_SPAN) * STRETCH_WEIGHT : 0;
      
      const totalCost = movementCost + crossoverCost + stretchCost;
      
      candidates.push({
        hand: preferredHand,
        handState,
        fingerKey,
        cost: totalCost,
      });
    }
    
    // Also try other hand if preferred hand has no good candidates
    if (candidates.length === 0 || Math.min(...candidates.map(c => c.cost)) > MAX_MOVEMENT_DISTANCE * 2) {
      for (const [fingerKey, fingerPos] of otherHandState.fingers.entries()) {
        const movement = calculateMovementCost(fingerPos.row, fingerPos.col, eventRow, eventCol);
        
        if (movement > MAX_MOVEMENT_DISTANCE) continue;
        
        const crossover = wouldCauseCrossover(otherHandState, fingerKey, eventCol);
        const movementCost = movement * MOVEMENT_WEIGHT;
        const crossoverCost = crossover ? CROSSOVER_WEIGHT : 0;
        
        const tempSpan = Math.max(
          ...Array.from(otherHandState.fingers.values()).map(p => p.col),
          eventCol
        ) - Math.min(
          ...Array.from(otherHandState.fingers.values()).map(p => p.col),
          eventCol
        );
        const stretchCost = tempSpan > MAX_HAND_SPAN ? (tempSpan - MAX_HAND_SPAN) * (tempSpan - MAX_HAND_SPAN) * STRETCH_WEIGHT : 0;
        
        const totalCost = movementCost + crossoverCost + stretchCost;
        
        candidates.push({
          hand: preferredHand === 'left' ? 'right' : 'left',
          handState: otherHandState,
          fingerKey,
          cost: totalCost,
        });
      }
    }
    
    // Select best candidate
    if (candidates.length === 0) {
      // No valid assignment - skip (will be marked as Unplayable)
      continue;
    }
    
    const bestCandidate = candidates.reduce((best, current) => 
      current.cost < best.cost ? current : best
    );
    
    // Record assignment
    assignments[eventIndex] = {
      hand: bestCandidate.hand,
      finger: fingerKeyToFingerType(bestCandidate.fingerKey),
    };
    
    // Update finger position
    bestCandidate.handState.fingers.set(bestCandidate.fingerKey, {
      row: eventRow,
      col: eventCol,
      fingerKey: bestCandidate.fingerKey,
    });
    
    // Update span
    if (bestCandidate.handState.fingers.size >= 2) {
      const cols = Array.from(bestCandidate.handState.fingers.values()).map(p => p.col);
      bestCandidate.handState.span = Math.max(...cols) - Math.min(...cols);
    }
  }
  
  return assignments;
}

