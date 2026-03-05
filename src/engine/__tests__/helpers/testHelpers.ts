/**
 * Test helpers and utilities for solver tests.
 * See ./semantics.ts for documentation of test conventions.
 */

import { BiomechanicalSolver } from '../../core';
import { Performance, NoteEvent, InstrumentConfig } from '../../../types/performance';
import { GridMapping } from '../../../types/layout';
import { EngineResult, CostBreakdown, EngineDebugEvent } from '../../solvers/types';

/**
 * Standard test InstrumentConfig matching Push 3 default.
 * Use this for L01 (null mapping) tests.
 */
export const DEFAULT_TEST_CONFIG: InstrumentConfig = {
  id: 'test-config',
  name: 'Test Standard 8x8',
  rows: 8,
  cols: 8,
  bottomLeftNote: 36,
  layoutMode: 'drum_64',
};

/**
 * Empty GridMapping for tests that need an explicit (but empty) mapping.
 */
export const EMPTY_MAPPING: GridMapping = {
  id: 'empty-mapping',
  name: 'Empty Mapping',
  cells: {},
  fingerConstraints: {},
};

/**
 * Creates a solver with default config and optional mapping.
 * Use null mapping for L01 (standard chromatic) behavior.
 */
export function createTestSolver(
  config: InstrumentConfig = DEFAULT_TEST_CONFIG,
  mapping: GridMapping | null = null
): BiomechanicalSolver {
  return new BiomechanicalSolver(config, mapping);
}

/**
 * Runs the solver on a performance and returns the result.
 * Convenience wrapper for tests.
 */
export function runSolver(
  performance: Performance,
  config: InstrumentConfig = DEFAULT_TEST_CONFIG,
  mapping: GridMapping | null = null,
  manualAssignments?: Record<string, { hand: 'left' | 'right'; finger: string }>
): EngineResult {
  const solver = createTestSolver(config, mapping);
  return solver.solve(performance, manualAssignments);
}

/**
 * Converts beats to seconds using the given BPM.
 * Use this when authoring fixtures in beats but storing in seconds.
 */
export function beatsToSeconds(beats: number, bpm: number): number {
  return (60 / bpm) * beats;
}

/**
 * Generates a deterministic eventKey for a NoteEvent.
 * Format: "index:startTime:noteNumber:ordinal"
 */
export function generateEventKey(
  event: NoteEvent,
  index: number,
  ordinalAtTime: number = 1
): string {
  return `${index}:${event.startTime}:${event.noteNumber}:${ordinalAtTime}`;
}

/**
 * Ensures all events in a performance have eventKeys.
 * If an event lacks an eventKey, one is generated.
 */
export function ensureEventKeys(performance: Performance): Performance {
  const timeOrdinalMap = new Map<number, number>();
  
  const events = performance.events.map((event, index) => {
    if (event.eventKey) return event;
    
    const ordinal = (timeOrdinalMap.get(event.startTime) || 0) + 1;
    timeOrdinalMap.set(event.startTime, ordinal);
    
    return {
      ...event,
      eventKey: generateEventKey(event, index, ordinal),
    };
  });
  
  return { ...performance, events };
}

/**
 * Asserts that a performance uses valid time units (seconds).
 * All startTime and duration values must be finite and non-negative.
 */
export function assertPerformanceUnits(performance: Performance): void {
  for (let i = 0; i < performance.events.length; i++) {
    const event = performance.events[i];
    
    if (!Number.isFinite(event.startTime) || event.startTime < 0) {
      throw new Error(
        `Event ${i} has invalid startTime: ${event.startTime}. ` +
        `Expected finite non-negative number (in seconds).`
      );
    }
    
    if (event.duration !== undefined) {
      if (!Number.isFinite(event.duration) || event.duration < 0) {
        throw new Error(
          `Event ${i} has invalid duration: ${event.duration}. ` +
          `Expected finite non-negative number (in seconds).`
        );
      }
    }
  }
}

/**
 * Threshold bands for benchmark fixtures.
 */
export interface ResultBands {
  feasible?: boolean;
  crossoverRateMax?: number;
  movementCostMax?: number;
  unplayableCount?: number;
  hardCountMax?: number;
  scoreMin?: number;
}

/**
 * Asserts that a result falls within the specified threshold bands.
 */
export function expectResultInBands(result: EngineResult, bands: ResultBands): void {
  if (bands.feasible !== undefined) {
    const isFeasible = result.unplayableCount === 0;
    if (bands.feasible && !isFeasible) {
      throw new Error(
        `Expected feasible result (unplayableCount === 0), got ${result.unplayableCount}`
      );
    }
    if (!bands.feasible && isFeasible) {
      throw new Error(
        `Expected infeasible result (unplayableCount > 0), got 0`
      );
    }
  }
  
  if (bands.unplayableCount !== undefined && result.unplayableCount > bands.unplayableCount) {
    throw new Error(
      `unplayableCount ${result.unplayableCount} exceeds max ${bands.unplayableCount}`
    );
  }
  
  if (bands.hardCountMax !== undefined && result.hardCount > bands.hardCountMax) {
    throw new Error(
      `hardCount ${result.hardCount} exceeds max ${bands.hardCountMax}`
    );
  }
  
  if (bands.scoreMin !== undefined && result.score < bands.scoreMin) {
    throw new Error(
      `score ${result.score} below min ${bands.scoreMin}`
    );
  }
  
  if (bands.movementCostMax !== undefined) {
    const movement = result.averageMetrics?.movement ?? 0;
    if (movement > bands.movementCostMax) {
      throw new Error(
        `movement cost ${movement} exceeds max ${bands.movementCostMax}`
      );
    }
  }
  
  if (bands.crossoverRateMax !== undefined) {
    const crossover = result.averageMetrics?.crossover ?? 0;
    if (crossover > bands.crossoverRateMax) {
      throw new Error(
        `crossover rate ${crossover} exceeds max ${bands.crossoverRateMax}`
      );
    }
  }
}

/**
 * Checks if a value contains NaN anywhere in the object tree.
 */
export function containsNaN(value: unknown): boolean {
  if (typeof value === 'number' && Number.isNaN(value)) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some(containsNaN);
  }
  if (value && typeof value === 'object') {
    return Object.values(value).some(containsNaN);
  }
  return false;
}

/**
 * Asserts that the result contains no NaN values in key fields.
 */
export function assertNoNaNs(result: EngineResult): void {
  if (Number.isNaN(result.score)) {
    throw new Error('Result score is NaN');
  }
  
  if (containsNaN(result.averageMetrics)) {
    throw new Error('Result averageMetrics contains NaN');
  }
  
  if (containsNaN(result.fatigueMap)) {
    throw new Error('Result fatigueMap contains NaN');
  }
  
  for (let i = 0; i < result.debugEvents.length; i++) {
    const event = result.debugEvents[i];
    if (Number.isNaN(event.cost)) {
      throw new Error(`debugEvent[${i}].cost is NaN`);
    }
    if (event.costBreakdown && containsNaN(event.costBreakdown)) {
      throw new Error(`debugEvent[${i}].costBreakdown contains NaN`);
    }
  }
}

/**
 * Builds a map from eventKey to debug event for joining.
 */
export function buildDebugEventMap(
  result: EngineResult
): Map<string, EngineDebugEvent> {
  const map = new Map<string, EngineDebugEvent>();
  
  for (const event of result.debugEvents) {
    if (event.eventKey) {
      map.set(event.eventKey, event);
    }
  }
  
  return map;
}

/**
 * Asserts that every input event has a corresponding debug event (by eventKey).
 * Also checks ordering is non-decreasing by input index.
 */
export function assertDebugEventsMatchInput(
  performance: Performance,
  result: EngineResult
): void {
  const debugMap = buildDebugEventMap(result);
  const debugEventIndices: number[] = [];
  
  for (let i = 0; i < performance.events.length; i++) {
    const inputEvent = performance.events[i];
    const eventKey = inputEvent.eventKey;
    
    if (!eventKey) {
      continue;
    }
    
    const debugEvent = debugMap.get(eventKey);
    if (!debugEvent) {
      throw new Error(
        `Input event ${i} with eventKey "${eventKey}" has no corresponding debug event`
      );
    }
    
    if (debugEvent.eventIndex !== undefined) {
      debugEventIndices.push(debugEvent.eventIndex);
    }
  }
  
  for (let i = 1; i < debugEventIndices.length; i++) {
    if (debugEventIndices[i] < debugEventIndices[i - 1]) {
      throw new Error(
        `Debug events are not in non-decreasing order by input index: ` +
        `index ${debugEventIndices[i]} follows ${debugEventIndices[i - 1]}`
      );
    }
  }
}

/**
 * Asserts that playable events have valid grid positions.
 */
export function assertValidGridPositions(result: EngineResult): void {
  for (let i = 0; i < result.debugEvents.length; i++) {
    const event = result.debugEvents[i];
    
    if (event.assignedHand === 'Unplayable') {
      continue;
    }
    
    if (event.row === undefined || event.col === undefined) {
      throw new Error(
        `Playable debugEvent[${i}] is missing row/col position`
      );
    }
    
    if (event.row < 0 || event.row > 7 || event.col < 0 || event.col > 7) {
      throw new Error(
        `debugEvent[${i}] has out-of-bounds position: row=${event.row}, col=${event.col}`
      );
    }
  }
}

/**
 * Asserts that all debug events have either a valid assignment or are Unplayable.
 */
export function assertMappingIntegrity(result: EngineResult): void {
  for (let i = 0; i < result.debugEvents.length; i++) {
    const event = result.debugEvents[i];
    
    if (event.assignedHand === 'Unplayable') {
      continue;
    }
    
    if (!event.finger) {
      throw new Error(
        `Playable debugEvent[${i}] has assignedHand "${event.assignedHand}" but no finger`
      );
    }
    
    if (event.assignedHand !== 'left' && event.assignedHand !== 'right') {
      throw new Error(
        `debugEvent[${i}] has invalid assignedHand: "${event.assignedHand}"`
      );
    }
  }
}

/**
 * Compares two numbers with epsilon tolerance.
 */
export function expectWithinEpsilon(
  actual: number,
  expected: number,
  epsilon: number = 1e-6,
  message?: string
): void {
  const diff = Math.abs(actual - expected);
  if (diff > epsilon) {
    throw new Error(
      message || `Expected ${actual} to be within ${epsilon} of ${expected}, diff was ${diff}`
    );
  }
}

/**
 * Creates a simple performance for testing.
 */
export function createTestPerformance(
  events: Array<Partial<NoteEvent> & { noteNumber: number; startTime: number }>,
  options: { name?: string; tempo?: number } = {}
): Performance {
  const fullEvents: NoteEvent[] = events.map((e, i) => ({
    noteNumber: e.noteNumber,
    startTime: e.startTime,
    duration: e.duration ?? 0.1,
    velocity: e.velocity ?? 100,
    eventKey: e.eventKey ?? generateEventKey(e as NoteEvent, i),
  }));
  
  return {
    name: options.name ?? 'Test Performance',
    tempo: options.tempo ?? 120,
    events: fullEvents,
  };
}

/**
 * Counts how many events were assigned to each hand.
 */
export function countHandUsage(result: EngineResult): { left: number; right: number; unplayable: number } {
  let left = 0;
  let right = 0;
  let unplayable = 0;
  
  for (const event of result.debugEvents) {
    if (event.assignedHand === 'left') left++;
    else if (event.assignedHand === 'right') right++;
    else unplayable++;
  }
  
  return { left, right, unplayable };
}

/**
 * Counts unique fingers used in the result.
 */
export function countUniqueFingers(result: EngineResult): number {
  const fingers = new Set<string>();
  
  for (const event of result.debugEvents) {
    if (event.assignedHand !== 'Unplayable' && event.finger) {
      fingers.add(`${event.assignedHand}-${event.finger}`);
    }
  }
  
  return fingers.size;
}

/**
 * Asserts that no two simultaneous (same startTime) playable events share the same
 * (hand, finger). This is a physical constraint: one finger cannot play two pads at once.
 * Use in solver tests to catch duplicate-finger assignments.
 */
export function assertNoDuplicateFingerPerSimultaneousGroup(result: EngineResult): void {
  const byTime = new Map<number, EngineDebugEvent[]>();
  for (const e of result.debugEvents) {
    if (e.assignedHand === 'Unplayable' || e.finger == null) continue;
    const t = e.startTime;
    if (!byTime.has(t)) byTime.set(t, []);
    byTime.get(t)!.push(e);
  }
  for (const [, events] of byTime) {
    const used = new Set<string>();
    for (const e of events) {
      const key = `${e.assignedHand}-${e.finger}`;
      if (used.has(key)) {
        throw new Error(
          `Duplicate finger assignment at startTime=${events[0].startTime}: same (hand, finger) used for multiple notes. ` +
          `Events: ${events.map(ev => `note=${ev.noteNumber} ${ev.assignedHand}/${ev.finger}`).join('; ')}`
        );
      }
      used.add(key);
    }
  }
}
