/**
 * Event Metrics Calculation Engine
 * 
 * Computes additional metrics for engine debug events, including:
 * - Anatomical stretch scores (hand span expansion/contraction)
 * - Composite difficulty scores (normalized 0-1 for heatmaps)
 * 
 * These metrics extend EngineDebugEvent into AnalyzedEvent for use in
 * event analysis and onion skin visualization.
 */

import type { EngineResult, EngineDebugEvent } from './core';
import type { AnalyzedEvent, EventNote } from '../types/eventAnalysis';
import type { FingerType } from './models';
import { calculateGridDistance, type GridPosition } from './gridMath';
import { cellKey, parseCellKey } from '../types/layout';

/**
 * Finger pair key format for anatomical stretch table.
 * Format: "{HAND}_{FINGER1}-{HAND}_{FINGER2}"
 * Example: "L_INDEX-L_MIDDLE", "R_THUMB-R_INDEX"
 */
export type FingerPairKey = string;

/**
 * Anatomical stretch table mapping finger pairs to stretch difficulty factors.
 * 
 * Values represent the relative difficulty of stretching between adjacent fingers.
 * Higher values indicate more difficult stretches (e.g., ring-pinky is harder than index-middle).
 * Values are normalized and used as multipliers in stretch calculations.
 */
export interface AnatomicalStretchTable {
  [key: FingerPairKey]: number;
}

/**
 * Creates the default anatomical stretch table with biomechanically-informed values.
 * 
 * Based on typical hand anatomy:
 * - Adjacent fingers (index-middle, middle-ring) have moderate stretch factors
 * - Non-adjacent pairs (thumb-index, ring-pinky) have higher stretch factors
 * - Pinky-related stretches are generally more difficult
 * 
 * @returns Default anatomical stretch table
 */
export function createDefaultAnatomicalStretchTable(): AnatomicalStretchTable {
  return {
    // Left hand finger pairs
    'L_THUMB-L_INDEX': 0.5,
    'L_INDEX-L_MIDDLE': 0.8,
    'L_MIDDLE-L_RING': 1.3,
    'L_RING-L_PINKY': 1.8,
    'L_THUMB-L_MIDDLE': 1.0,
    'L_THUMB-L_RING': 1.5,
    'L_THUMB-L_PINKY': 2.0,
    'L_INDEX-L_RING': 1.5,
    'L_INDEX-L_PINKY': 2.2,
    'L_MIDDLE-L_PINKY': 2.0,
    
    // Right hand finger pairs (same values, mirrored)
    'R_THUMB-R_INDEX': 0.5,
    'R_INDEX-R_MIDDLE': 0.8,
    'R_MIDDLE-R_RING': 1.3,
    'R_RING-R_PINKY': 1.8,
    'R_THUMB-R_MIDDLE': 1.0,
    'R_THUMB-R_RING': 1.5,
    'R_THUMB-R_PINKY': 2.0,
    'R_INDEX-R_RING': 1.5,
    'R_INDEX-R_PINKY': 2.2,
    'R_MIDDLE-R_PINKY': 2.0,
  };
}

/**
 * Gets the pad key ("row,col" format) for a debug event.
 * 
 * @param event - Engine debug event with optional row/col properties
 * @returns Pad key string, or null if event has no position
 */
export function getPadForDebugEvent(event: EngineDebugEvent): string | null {
  if (event.row === undefined || event.col === undefined) {
    return null;
  }
  return cellKey(event.row, event.col);
}

/**
 * Time tolerance for grouping events into moments (in seconds).
 * Events within this tolerance are considered simultaneous.
 */
const EVENT_TIME_EPSILON = 1e-4; // 0.0001 seconds = 0.1ms

/**
 * Groups engine debug events into time-based moments.
 * 
 * Events with the same startTime (within EVENT_TIME_EPSILON) are grouped together
 * into a single AnalyzedEvent representing a polyphonic moment.
 * 
 * @param debugEvents - Array of engine debug events (should be sorted by startTime)
 * @returns Array of grouped analyzed events (moments)
 */
function groupDebugEventsIntoMoments(
  debugEvents: EngineDebugEvent[]
): AnalyzedEvent[] {
  const moments: AnalyzedEvent[] = [];
  let currentGroup: EngineDebugEvent[] = [];
  let currentStartTime: number | null = null;

  const flushGroup = () => {
    if (!currentGroup.length || currentStartTime == null) return;
    
    const eventIndex = moments.length;
    const notes: EventNote[] = currentGroup
      .map((ev) => {
        const pad = getPadForDebugEvent(ev);
        return {
          debugEvent: ev,
          pad: pad || '', // Use empty string if pad is null (unplayable events)
        };
      })
      .filter((note) => note.pad !== ''); // Filter out unplayable events without positions

    // If no valid notes, skip this moment
    if (notes.length === 0) {
      currentGroup = [];
      currentStartTime = null;
      return;
    }

    const pads = Array.from(new Set(notes.map((n) => n.pad)));

    // Compute event-level metrics
    const polyphony = notes.length;
    
    // Calculate spread if we have multiple pads
    let spreadX: number | undefined;
    let spreadY: number | undefined;
    if (pads.length > 1) {
      const positions = pads
        .map((pad) => parseCellKey(pad))
        .filter((pos): pos is { row: number; col: number } => pos !== null);
      
      if (positions.length > 1) {
        const cols = positions.map((p) => p.col);
        const rows = positions.map((p) => p.row);
        spreadX = Math.max(...cols) - Math.min(...cols);
        spreadY = Math.max(...rows) - Math.min(...rows);
      }
    }

    // Compute aggregate anatomical stretch score (max across all notes)
    const anatomicalStretchScores = notes.map((note) =>
      computeEventAnatomicalStretchScore(note.debugEvent)
    );
    const maxAnatomicalStretch = Math.max(...anatomicalStretchScores, 0);

    // Compute aggregate composite difficulty score (max across all notes)
    const compositeDifficultyScores = notes.map((note) =>
      computeCompositeDifficultyScore(note.debugEvent, anatomicalStretchScores[notes.indexOf(note)])
    );
    const maxCompositeDifficulty = Math.max(...compositeDifficultyScores, 0);

    moments.push({
      eventIndex,
      timestamp: currentStartTime,
      notes,
      pads,
      eventMetrics: {
        polyphony,
        spreadX,
        spreadY,
        anatomicalStretchScore: maxAnatomicalStretch,
        compositeDifficultyScore: maxCompositeDifficulty,
      },
    });

    currentGroup = [];
    currentStartTime = null;
  };

  for (const ev of debugEvents) {
    const t = ev.startTime;
    if (
      currentStartTime == null ||
      Math.abs(t - currentStartTime) <= EVENT_TIME_EPSILON
    ) {
      // Same moment
      if (currentStartTime == null) currentStartTime = t;
      currentGroup.push(ev);
    } else {
      // New moment - flush previous group
      flushGroup();
      currentStartTime = t;
      currentGroup = [ev];
    }
  }

  // Flush final group
  flushGroup();

  return moments;
}

/**
 * Computes the Euclidean distance between two pad keys.
 * 
 * @param fromPad - Source pad key ("row,col" format)
 * @param toPad - Target pad key ("row,col" format)
 * @returns Euclidean distance in grid cells, or Infinity if pads are invalid
 */
export function computeRawDistance(fromPad: string, toPad: string): number {
  const fromPos = parseCellKey(fromPad);
  const toPos = parseCellKey(toPad);
  
  if (!fromPos || !toPos) {
    return Infinity;
  }
  
  return calculateGridDistance(fromPos, toPos);
}

/**
 * Gets the home position for a hand based on standard Push 3 layout.
 * 
 * Left hand home: bottom-left area (row 0, col 1)
 * Right hand home: right side of bottom row (row 0, col 5)
 * 
 * @param hand - Hand side ('left' or 'right')
 * @returns Home position grid coordinates
 */
function getHomePosition(hand: 'left' | 'right'): GridPosition {
  if (hand === 'left') {
    return { row: 0, col: 1 };
  } else {
    return { row: 0, col: 5 };
  }
}

/**
 * Computes the anatomical stretch score for a single event.
 * 
 * For v1, this uses a simplified approach:
 * - If the event has a costBreakdown with stretch penalty, use that as a base
 * - Otherwise, calculate distance from hand's home position
 * - Normalize based on maximum expected stretch (4 grid cells)
 * 
 * The score represents how much the hand must stretch from its natural position
 * to reach the event's pad. Higher values (closer to 1.0) indicate more stretch.
 * 
 * @param event - Engine debug event to analyze
 * @param stretchTable - Anatomical stretch table (currently unused in v1, reserved for future use)
 * @returns Anatomical stretch score (0-1, normalized)
 */
export function computeEventAnatomicalStretchScore(
  event: EngineDebugEvent,
  stretchTable: AnatomicalStretchTable = createDefaultAnatomicalStretchTable()
): number {
  // If event is unplayable, return maximum stretch score
  if (event.assignedHand === 'Unplayable' || !event.finger || event.row === undefined || event.col === undefined) {
    return 1.0;
  }
  
  // If we have stretch penalty from cost breakdown, use it as a base
  // The engine's stretch penalty is already calculated based on hand span
  if (event.costBreakdown?.stretch !== undefined) {
    // Normalize stretch penalty to 0-1 range
    // Engine stretch penalty typically ranges 0-10 (from costFunction.ts)
    const normalizedStretch = Math.min(event.costBreakdown.stretch / 10.0, 1.0);
    return normalizedStretch;
  }
  
  // Fallback: Calculate distance from home position
  // This is a simplified approximation for v1
  const hand = event.assignedHand;
  if (hand === 'Unplayable') {
    return 1.0;
  }
  
  const homePos = getHomePosition(hand);
  const eventPos: GridPosition = { row: event.row, col: event.col };
  const distanceFromHome = calculateGridDistance(homePos, eventPos);
  
  // Normalize: max expected stretch is ~4 grid cells (maxReach from engine constants)
  // Distance beyond 4 cells is clamped to 1.0
  const maxStretch = 4.0;
  const normalizedDistance = Math.min(distanceFromHome / maxStretch, 1.0);
  
  return normalizedDistance;
}

/**
 * Computes the composite difficulty score for an event.
 * 
 * Combines multiple factors into a single normalized 0-1 score:
 * - Event difficulty level (Easy/Medium/Hard/Unplayable)
 * - Total cost from cost breakdown
 * - Anatomical stretch score
 * - Movement, fatigue, and other cost components
 * 
 * Normalization heuristic:
 * - Unplayable events → 1.0
 * - Hard events → 0.7-1.0 range
 * - Medium events → 0.3-0.7 range
 * - Easy events → 0.0-0.3 range
 * - Cost and stretch factors adjust within these ranges
 * 
 * @param event - Engine debug event to analyze
 * @param anatomicalStretchScore - Pre-computed anatomical stretch score (0-1)
 * @returns Composite difficulty score (0-1, normalized for heatmaps)
 */
export function computeCompositeDifficultyScore(
  event: EngineDebugEvent,
  anatomicalStretchScore: number
): number {
  // Unplayable events always get maximum difficulty
  if (event.difficulty === 'Unplayable' || event.assignedHand === 'Unplayable') {
    return 1.0;
  }
  
  // Base difficulty from engine's difficulty classification
  let baseScore: number;
  switch (event.difficulty) {
    case 'Hard':
      baseScore = 0.7; // Start at 0.7, can go up to 1.0
      break;
    case 'Medium':
      baseScore = 0.4; // Start at 0.4, can go up to 0.7
      break;
    case 'Easy':
      baseScore = 0.1; // Start at 0.1, can go up to 0.3
      break;
    default:
      baseScore = 0.5; // Fallback
  }
  
  // Adjust based on cost (if available)
  // Engine cost typically ranges 0-100+ (Infinity for unplayable)
  // Normalize cost contribution (0-0.2 range)
  let costContribution = 0.0;
  if (event.cost !== undefined && event.cost !== Infinity && event.cost > 0) {
    // Normalize cost: typical range is 0-20 for playable events
    const normalizedCost = Math.min(event.cost / 20.0, 1.0);
    costContribution = normalizedCost * 0.2; // Max 0.2 contribution
  }
  
  // Adjust based on anatomical stretch (0-0.1 range)
  const stretchContribution = anatomicalStretchScore * 0.1; // Max 0.1 contribution
  
  // Adjust based on cost breakdown components if available
  let breakdownContribution = 0.0;
  if (event.costBreakdown) {
    const breakdown = event.costBreakdown;
    // Combine movement, fatigue, crossover as additional difficulty factors
    // Each component normalized and weighted
    const movementFactor = Math.min(breakdown.movement / 10.0, 1.0) * 0.05;
    const fatigueFactor = Math.min(breakdown.fatigue / 5.0, 1.0) * 0.03;
    const crossoverFactor = Math.min(breakdown.crossover / 20.0, 1.0) * 0.02;
    breakdownContribution = movementFactor + fatigueFactor + crossoverFactor;
  }
  
  // Combine all factors
  const compositeScore = baseScore + costContribution + stretchContribution + breakdownContribution;
  
  // Clamp to 0-1 range
  return Math.min(Math.max(compositeScore, 0.0), 1.0);
}

/**
 * Analyzes all events in an engine result, grouping simultaneous notes into moments.
 * 
 * Converts EngineDebugEvent[] → AnalyzedEvent[] by:
 * 1. Grouping events by timestamp (within EVENT_TIME_EPSILON)
 * 2. Computing per-event metrics (polyphony, spread, stretch, difficulty)
 * 
 * This function is pure and decoupled from React/UI code.
 * 
 * @param engineResult - Engine result containing debug events
 * @param stretchTable - Optional anatomical stretch table (defaults to standard table)
 * @returns Array of grouped analyzed events (moments) with extended metrics
 */
export function analyzeEvents(
  engineResult: EngineResult,
  stretchTable: AnatomicalStretchTable = createDefaultAnatomicalStretchTable()
): AnalyzedEvent[] {
  // First, group events by timestamp into moments
  const moments = groupDebugEventsIntoMoments(engineResult.debugEvents);
  
  // Note: Per-event metrics are already computed in groupDebugEventsIntoMoments
  // The stretchTable parameter is used within computeEventAnatomicalStretchScore
  
  return moments;
}

