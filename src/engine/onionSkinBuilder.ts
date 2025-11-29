/**
 * Onion Skin Builder
 * 
 * Builds the OnionSkinModel for a focused event, providing all context needed
 * for the onion skin visualization (current, previous, next events + finger movements).
 * 
 * This builder is pure and memoizable - it takes pre-computed AnalyzedEvent[]
 * and Transition[] as input and does not recompute metrics.
 */

import type {
  AnalyzedEvent,
  Transition,
  OnionSkinModel,
  FingerMove,
  PadKey,
  HandType,
} from '../types/eventAnalysis';
import type { FingerType } from './models';
import { cellKey, parseCellKey } from '../types/layout';
import { calculateGridDistance, type GridPosition } from './gridMath';

/**
 * Input data for building an onion skin model.
 * 
 * Contains pre-computed analyzed events and transitions from the event analysis pipeline.
 */
export interface OnionSkinInput {
  /** Array of analyzed events (should be sorted by startTime) */
  events: AnalyzedEvent[];
  /** Array of transitions between consecutive events */
  transitions: Transition[];
}

/**
 * Maximum reach distance in grid cells (beyond which a movement is considered impossible).
 * Based on engine constants: maxReach = 4 cells.
 */
const MAX_REACH_DISTANCE = 4.0;

/**
 * Gets all pad keys for a grouped analyzed event.
 * 
 * @param event - Grouped analyzed event with pads array
 * @returns Array of pad keys
 */
function getPadKeysForEvent(event: AnalyzedEvent): PadKey[] {
  return event.pads;
}

/**
 * Computes pad sets (shared, current-only, next-only) from two grouped events.
 * 
 * @param currentEvent - Current analyzed event (grouped moment)
 * @param nextEvent - Next analyzed event (grouped moment, optional)
 * @returns Object with pad sets
 */
function computePadSets(
  currentEvent: AnalyzedEvent,
  nextEvent: AnalyzedEvent | null | undefined
): {
  sharedPads: PadKey[];
  currentOnlyPads: PadKey[];
  nextOnlyPads: PadKey[];
} {
  const currentPads = getPadKeysForEvent(currentEvent);
  const nextPads = nextEvent ? getPadKeysForEvent(nextEvent) : [];
  
  // Shared pads: pads that appear in both current and next events
  const sharedPads = currentPads.filter(pad => nextPads.includes(pad));
  
  // Current-only pads: pads in current but not in next
  const currentOnlyPads = currentPads.filter(pad => !nextPads.includes(pad));
  
  // Next-only pads: pads in next but not in current
  const nextOnlyPads = nextPads.filter(pad => !currentPads.includes(pad));
  
  return {
    sharedPads,
    currentOnlyPads,
    nextOnlyPads,
  };
}

/**
 * Creates finger moves from current to next event for all matching fingers.
 * 
 * For grouped events, matches fingers by (hand, finger) pair across all notes
 * in both events and computes movement metrics.
 * 
 * @param currentEvent - Current analyzed event (grouped moment)
 * @param nextEvent - Next analyzed event (grouped moment, optional)
 * @returns Array of finger moves
 */
function createFingerMoves(
  currentEvent: AnalyzedEvent,
  nextEvent: AnalyzedEvent | null | undefined
): FingerMove[] {
  const moves: FingerMove[] = [];
  
  // If no next event, no movement to track
  if (!nextEvent) {
    return moves;
  }
  
  // For each note in the next event, try to find a matching note in the current event
  // Match by (hand, finger) pair
  for (const nextNote of nextEvent.notes) {
    const nextHand = nextNote.debugEvent.assignedHand;
    const nextFinger = nextNote.debugEvent.finger;
    const toPad = nextNote.pad;
    
    // Skip unplayable notes
    if (nextHand === 'Unplayable' || !nextFinger) {
      continue;
    }
    
    // Find matching note in current event (same hand and finger)
    const matchingCurrentNote = currentEvent.notes.find(
      (n) =>
        n.debugEvent.assignedHand === nextHand &&
        n.debugEvent.finger === nextFinger
    );
    
    const fromPad = matchingCurrentNote ? matchingCurrentNote.pad : null;
    
    // Check if it's a hold (same pad)
    const isHold = fromPad !== null && toPad !== null && fromPad === toPad;
    
    // Calculate distance if both pads exist
    let rawDistance: number | undefined;
    let isImpossible = false;
    
    if (fromPad && toPad) {
      const fromPos = parseCellKey(fromPad);
      const toPos = parseCellKey(toPad);
      
      if (fromPos && toPos) {
        rawDistance = calculateGridDistance(fromPos, toPos);
        // Mark as impossible if distance exceeds max reach
        isImpossible = rawDistance > MAX_REACH_DISTANCE;
      }
    }
    
    moves.push({
      finger: nextFinger,
      hand: nextHand as HandType,
      fromPad,
      toPad,
      isHold,
      isImpossible,
      rawDistance,
      // Use the event's anatomical stretch score if available
      anatomicalStretchScore: nextEvent.eventMetrics?.anatomicalStretchScore,
    });
  }
  
  return moves;
}

/**
 * Builds all finger moves between current and next grouped events.
 * 
 * For grouped events, this tracks all finger movements across all notes
 * in both events, matching by (hand, finger) pair.
 * 
 * @param currentEvent - Current analyzed event (grouped moment)
 * @param nextEvent - Next analyzed event (grouped moment, optional)
 * @returns Array of finger moves
 */
function buildFingerMoves(
  currentEvent: AnalyzedEvent,
  nextEvent: AnalyzedEvent | null | undefined
): FingerMove[] {
  return createFingerMoves(currentEvent, nextEvent);
}

/**
 * Builds an onion skin model for a focused event.
 * 
 * Creates the complete context needed for onion skin visualization:
 * - Current event (N) - solid pads
 * - Previous event (N-1) - ghost pads
 * - Next event (N+1) - ghost pads
 * - Pad sets (shared, current-only, next-only)
 * - Finger movements (for vector arrows)
 * 
 * This function is pure and memoizable - it does not recompute metrics,
 * only organizes pre-computed data into the visualization model.
 * 
 * @param input - OnionSkinInput containing pre-computed events and transitions
 * @param focusedEventIndex - Index of the event to focus on
 * @returns OnionSkinModel or null if index is out of range
 */
export function buildOnionSkinModel(
  input: OnionSkinInput,
  focusedEventIndex: number
): OnionSkinModel | null {
  const { events, transitions } = input;
  
  // Validate index
  if (focusedEventIndex < 0 || focusedEventIndex >= events.length) {
    return null;
  }
  
  // Get current, previous, and next events
  const currentEvent = events[focusedEventIndex];
  const previousEvent = focusedEventIndex > 0 ? events[focusedEventIndex - 1] : null;
  const nextEvent = focusedEventIndex < events.length - 1 ? events[focusedEventIndex + 1] : null;
  
  // Compute pad sets (shared, current-only, next-only)
  const { sharedPads, currentOnlyPads, nextOnlyPads } = computePadSets(currentEvent, nextEvent);
  
  // Build finger moves between current and next events
  const fingerMoves = buildFingerMoves(currentEvent, nextEvent);
  
  return {
    currentEventIndex: focusedEventIndex,
    currentEvent,
    previousEvent: previousEvent || null,
    nextEvent: nextEvent || null,
    sharedPads,
    currentOnlyPads,
    nextOnlyPads,
    fingerMoves,
  };
}

