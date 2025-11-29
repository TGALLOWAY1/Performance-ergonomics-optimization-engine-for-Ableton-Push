/**
 * Transition Analysis Engine
 * 
 * Analyzes transitions between consecutive events to compute movement difficulty metrics.
 * 
 * Transitions represent the physical movement required to go from one event to the next,
 * including hand switches, finger changes, speed pressure, and anatomical stretch.
 */

import type { AnalyzedEvent, Transition, TransitionMetrics } from '../types/eventAnalysis';
import { calculateGridDistance, type GridPosition } from './gridMath';
import { parseCellKey } from '../types/layout';

/**
 * Analyzes a single transition between two consecutive events.
 * 
 * Computes all transition metrics including:
 * - Time delta (milliseconds)
 * - Grid distance (Euclidean distance between pad positions)
 * - Hand switch detection (left ↔ right)
 * - Finger change detection (same hand, different finger)
 * - Speed pressure (inverse relationship with time delta)
 * - Anatomical stretch (aggregated from both events)
 * - Composite difficulty (weighted combination of all factors)
 * 
 * @param fromEvent - Source analyzed event
 * @param toEvent - Target analyzed event
 * @param tempoBpm - Optional tempo in BPM (currently unused, reserved for future tempo-aware calculations)
 * @returns Transition object with computed metrics
 */
export function analyzeTransition(
  fromEvent: AnalyzedEvent,
  toEvent: AnalyzedEvent,
  tempoBpm?: number
): Transition {
  // Calculate time delta in milliseconds
  const timeDeltaSeconds = toEvent.timestamp - fromEvent.timestamp;
  const timeDeltaMs = timeDeltaSeconds * 1000;
  
  // Calculate grid distance between events
  // For grouped events, compute average or max distance between matched pads
  let gridDistance = 0;
  
  if (fromEvent.pads.length === 0 || toEvent.pads.length === 0) {
    // If either event has no pads, assume maximum distance (unplayable transition)
    gridDistance = Infinity;
  } else {
    // Compute distances between all pad pairs and use the maximum
    // (represents the furthest movement required)
    let maxDistance = 0;
    for (const fromPad of fromEvent.pads) {
      for (const toPad of toEvent.pads) {
        const fromPos = parseCellKey(fromPad);
        const toPos = parseCellKey(toPad);
        if (fromPos && toPos) {
          const distance = calculateGridDistance(fromPos, toPos);
          maxDistance = Math.max(maxDistance, distance);
        }
      }
    }
    gridDistance = maxDistance;
  }
  
  // Detect hand switch: check if any note in fromEvent uses a different hand than any note in toEvent
  // For simplicity, we check if there's overlap in hands used
  const fromHands = new Set(
    fromEvent.notes
      .map((n) => n.debugEvent.assignedHand)
      .filter((h): h is 'left' | 'right' => h !== 'Unplayable')
  );
  const toHands = new Set(
    toEvent.notes
      .map((n) => n.debugEvent.assignedHand)
      .filter((h): h is 'left' | 'right' => h !== 'Unplayable')
  );
  
  // Hand switch occurs if both events use hands but they don't overlap
  const handSwitch = 
    fromHands.size > 0 &&
    toHands.size > 0 &&
    !Array.from(fromHands).some((h) => toHands.has(h));
  
  // Detect finger change: check if same hand uses different fingers
  // For simplicity, we check if there's any finger change within the same hand
  let fingerChange = false;
  for (const fromNote of fromEvent.notes) {
    for (const toNote of toEvent.notes) {
      if (
        fromNote.debugEvent.assignedHand !== 'Unplayable' &&
        toNote.debugEvent.assignedHand !== 'Unplayable' &&
        fromNote.debugEvent.assignedHand === toNote.debugEvent.assignedHand &&
        fromNote.debugEvent.finger !== null &&
        toNote.debugEvent.finger !== null &&
        fromNote.debugEvent.finger !== toNote.debugEvent.finger
      ) {
        fingerChange = true;
        break;
      }
    }
    if (fingerChange) break;
  }
  
  // Calculate speed pressure: higher when timeDeltaMs is small and distance is large
  // Formula: distance / (timeDeltaMs + epsilon) to avoid division by zero
  // Normalized to 0-1 range using a sigmoid-like function
  const epsilon = 1.0; // Small value to prevent division by zero
  let speedPressure = 0.0;
  if (timeDeltaMs > 0 && gridDistance !== Infinity) {
    // Raw speed: distance per millisecond
    const rawSpeed = gridDistance / (timeDeltaMs + epsilon);
    
    // Normalize: typical fast transitions are 0.1-1.0 cells/ms
    // Use a sigmoid-like normalization: tanh(rawSpeed * 10) gives 0-1 range
    speedPressure = Math.min(Math.tanh(rawSpeed * 10), 1.0);
  } else if (timeDeltaMs === 0 || gridDistance === Infinity) {
    // Simultaneous events or unplayable transitions get maximum speed pressure
    speedPressure = 1.0;
  }
  
  // Aggregate anatomical stretch score (use maximum from event metrics)
  // This represents the maximum stretch required during the transition
  const anatomicalStretchScore = Math.max(
    fromEvent.eventMetrics?.anatomicalStretchScore || 0,
    toEvent.eventMetrics?.anatomicalStretchScore || 0
  );
  
  // Calculate composite difficulty score
  // Weighted combination of: speed pressure, stretch, hand switch, finger change, distance
  const compositeDifficultyScore = computeTransitionDifficulty(
    speedPressure,
    anatomicalStretchScore,
    handSwitch,
    fingerChange,
    gridDistance
  );
  
  const metrics: TransitionMetrics = {
    timeDeltaMs,
    gridDistance: gridDistance === Infinity ? 999.0 : gridDistance, // Cap at 999 for display
    handSwitch,
    fingerChange,
    speedPressure,
    anatomicalStretchScore,
    compositeDifficultyScore,
  };
  
  // Note: fromIndex and toIndex will be set by analyzeAllTransitions
  return {
    fromIndex: -1, // Will be set by caller
    toIndex: -1, // Will be set by caller
    fromEvent,
    toEvent,
    metrics,
  };
}

/**
 * Computes the composite difficulty score for a transition.
 * 
 * Combines multiple factors into a normalized 0-1 score:
 * - Speed pressure (0-1): higher when movement is fast
 * - Anatomical stretch (0-1): higher when hand must stretch
 * - Hand switch penalty: adds difficulty when switching hands
 * - Finger change penalty: adds difficulty when changing fingers
 * - Distance factor: normalized grid distance contribution
 * 
 * @param speedPressure - Speed pressure metric (0-1)
 * @param anatomicalStretchScore - Anatomical stretch score (0-1)
 * @param handSwitch - Whether transition requires hand switch
 * @param fingerChange - Whether transition requires finger change
 * @param gridDistance - Euclidean distance in grid cells
 * @returns Composite difficulty score (0-1, normalized)
 */
function computeTransitionDifficulty(
  speedPressure: number,
  anatomicalStretchScore: number,
  handSwitch: boolean,
  fingerChange: boolean,
  gridDistance: number
): number {
  // Base score from speed and stretch (weighted 60% speed, 30% stretch)
  let baseScore = (speedPressure * 0.6) + (anatomicalStretchScore * 0.3);
  
  // Distance factor (normalized, contributes 10%)
  // Normalize distance: max expected distance is ~11.3 (diagonal of 8x8 grid)
  const maxDistance = Math.sqrt(8 * 8 + 8 * 8); // ~11.31
  const normalizedDistance = Math.min(gridDistance / maxDistance, 1.0);
  baseScore += normalizedDistance * 0.1;
  
  // Penalties for hand switch and finger change
  if (handSwitch) {
    baseScore += 0.15; // Hand switch adds 15% difficulty
  }
  if (fingerChange) {
    baseScore += 0.1; // Finger change adds 10% difficulty
  }
  
  // Clamp to 0-1 range
  return Math.min(Math.max(baseScore, 0.0), 1.0);
}

/**
 * Analyzes all transitions between consecutive events.
 * 
 * Pairs each event with its successor and computes transition metrics.
 * Returns an array of Transition objects, one for each adjacent pair.
 * 
 * @param events - Array of analyzed events (should be sorted by startTime)
 * @param tempoBpm - Optional tempo in BPM (passed to analyzeTransition)
 * @returns Array of transitions between consecutive events
 */
export function analyzeAllTransitions(
  events: AnalyzedEvent[],
  tempoBpm?: number
): Transition[] {
  if (events.length < 2) {
    return []; // Need at least 2 events to create a transition
  }
  
  const transitions: Transition[] = [];
  
  // Pair consecutive events: (events[i], events[i+1])
  for (let i = 0; i < events.length - 1; i++) {
    const fromEvent = events[i];
    const toEvent = events[i + 1];
    
    const transition = analyzeTransition(fromEvent, toEvent, tempoBpm);
    
    // Set indices
    transition.fromIndex = i;
    transition.toIndex = i + 1;
    
    transitions.push(transition);
  }
  
  return transitions;
}

