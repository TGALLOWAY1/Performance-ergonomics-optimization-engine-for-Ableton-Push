import { Performance, SectionMap, NoteEvent, InstrumentConfig } from '../types/performance';
import { GridMapService } from './gridMapService';
import { GridPosition, calculateGridDistance } from './gridMath';
import { defaultCostModel, Hand, MAX_REACH_GRID_UNITS, MAX_SPEED_UNITS_PER_SEC } from './ergonomics';
import { FingerID } from '../types/engine';

interface VirtualHand {
  currentPosition: GridPosition | null;
  lastEventTime: number;
  name: Hand;
  currentFinger: FingerID | null;
}

export type DifficultyLabel = 'Easy' | 'Medium' | 'Hard' | 'Unplayable';

export interface EngineDebugEvent {
  noteNumber: number;
  startTime: number;
  assignedHand: Hand | 'Unplayable';
  finger: FingerID | null;
  cost: number;
  difficulty: DifficultyLabel;
  row?: number;
  col?: number;
}

export interface EngineResult {
  score: number;
  unplayableCount: number;
  hardCount: number;
  debugEvents: EngineDebugEvent[];
}

/**
 * Helper to find the active instrument config for a given time.
 * Assumes 4/4 time signature for measure calculation.
 */
function getConfigForTime(time: number, sectionMaps: SectionMap[], tempo: number = 120): InstrumentConfig | null {
  const secondsPerBeat = 60 / tempo;
  const secondsPerMeasure = secondsPerBeat * 4;
  // Measures are 1-based in the interface
  const currentMeasure = (time / secondsPerMeasure) + 1;

  const section = sectionMaps.find(s => 
    currentMeasure >= s.startMeasure && currentMeasure < s.endMeasure + 1 
  );
  
  // If we find a section by strict measure bounds
  if (section) return section.instrumentConfig;

  // Fallback: if only one section exists, use it (common case for simple loops)
  if (sectionMaps.length === 1) return sectionMaps[0].instrumentConfig;

  return null;
}

function assignFinger(
  hand: Hand,
  currentPos: GridPosition,
  prevPos: GridPosition | null,
  isChord: boolean = false
): FingerID {
  if (!prevPos) {
    return 2; // Default strong finger (Index = 2)
  }

  if (isChord) {
    // Chord context (simultaneous with previous note)
    // Relative vertical/horizontal position matters
    // RH: Bottom/Left -> Thumb (1), Top/Right -> Pinky (5)
    // LH: Bottom/Right -> Thumb (1), Top/Left -> Pinky (5)
    
    const rowDiff = currentPos.row - prevPos.row;
    const colDiff = currentPos.col - prevPos.col;
    
    if (hand === 'RH') {
        if (rowDiff < 0 || colDiff < 0) return 1; // Lower/Left -> Thumb
        return 5; // Higher/Right -> Pinky
    } else {
        // LH
        if (rowDiff < 0 || colDiff > 0) return 1; // Lower/Right -> Thumb
        return 5; // Higher/Left -> Pinky
    }
  }

  const deltaCol = currentPos.col - prevPos.col;

  if (hand === 'RH') {
    if (deltaCol < 0) return 2; // Moving Left -> Index (2)
    if (deltaCol === 0) return 3; // Same col -> Middle (3)
    return 4; // Moving Right -> Ring (4)
  } else {
    // LH
    if (deltaCol > 0) return 2; // Moving Right -> Index (2)
    if (deltaCol === 0) return 3; // Same col -> Middle (3)
    return 4; // Moving Left -> Ring (4)
  }
}

export function runEngine(performance: Performance, sectionMaps: SectionMap[]): EngineResult {
  // Sort all events by startTime
  const sortedEvents = [...performance.events].sort((a, b) => a.startTime - b.startTime);

  // Initialize hands
  const lh: VirtualHand = { currentPosition: null, lastEventTime: -1, name: 'LH', currentFinger: null };
  const rh: VirtualHand = { currentPosition: null, lastEventTime: -1, name: 'RH', currentFinger: null };

  const debugEvents: EngineDebugEvent[] = [];
  let unplayableCount = 0;
  let hardCount = 0;
  const tempo = performance.tempo || 120;

  for (const note of sortedEvents) {
    const config = getConfigForTime(note.startTime, sectionMaps, tempo);

    if (!config) {
      unplayableCount++;
      debugEvents.push({
        noteNumber: note.noteNumber,
        startTime: note.startTime,
        assignedHand: 'Unplayable',
        finger: null,
        cost: 0,
        difficulty: 'Unplayable'
      });
      continue;
    }

    // Step A: Find position
    const targetPos = GridMapService.getPositionForNote(note.noteNumber, config);

    if (!targetPos) {
      unplayableCount++;
      debugEvents.push({
        noteNumber: note.noteNumber,
        startTime: note.startTime,
        assignedHand: 'Unplayable',
        finger: null,
        cost: 0,
        difficulty: 'Unplayable'
      });
      continue;
    }

    // Step B: Cost Calculation
    // LH Cost
    let lhCost = 0;
    if (lh.currentPosition === null) {
      lhCost = 0; // Free entry
    } else {
      const dist = calculateGridDistance(lh.currentPosition, targetPos);
      const timeDelta = note.startTime - lh.lastEventTime;
      
      // Strict Chord Check for LH
      if (timeDelta < 0.02 && dist > MAX_REACH_GRID_UNITS) {
        lhCost = Infinity;
      } else {
        lhCost = defaultCostModel.movementCost(dist, timeDelta);
      }
    }

    // RH Cost
    let rhCost = 0;
    if (rh.currentPosition === null) {
      rhCost = 0; // Free entry
    } else {
      const dist = calculateGridDistance(rh.currentPosition, targetPos);
      const timeDelta = note.startTime - rh.lastEventTime;
      
      // Strict Chord Check for RH
      if (timeDelta < 0.02 && dist > MAX_REACH_GRID_UNITS) {
        rhCost = Infinity;
      } else {
        rhCost = defaultCostModel.movementCost(dist, timeDelta);
      }
    }

    // Step C: Assignment
    let chosenHand: VirtualHand;
    let chosenCost: number;

    if (lhCost < rhCost) {
      chosenHand = lh;
      chosenCost = lhCost;
    } else {
      chosenHand = rh;
      chosenCost = rhCost;
    }

    // Calculate Difficulty Label for the chosen hand
    let difficulty: DifficultyLabel = 'Easy';
    
    if (chosenHand.currentPosition === null) {
      difficulty = 'Easy';
    } else {
      const dist = calculateGridDistance(chosenHand.currentPosition, targetPos);
      const timeDelta = note.startTime - chosenHand.lastEventTime;
      
      // Unplayable: If distance > MAX_REACH_GRID_UNITS (unless the hand was floating/null)
      if (dist > MAX_REACH_GRID_UNITS) {
        difficulty = 'Unplayable';
        unplayableCount++;
      } 
      // Hard: If distance / timeDelta > MAX_SPEED_UNITS_PER_SEC
      else if (timeDelta > 0 && (dist / timeDelta) > MAX_SPEED_UNITS_PER_SEC) {
        difficulty = 'Hard';
        hardCount++;
      }
      // Medium: If distance > 3.0
      else if (dist > 3.0) {
        difficulty = 'Medium';
      }
      // Easy: Everything else
      else {
        difficulty = 'Easy';
      }
    }

    // Determine if it's a chord (simultaneous with last event of THIS hand)
    // We use a small epsilon for float comparison, or exact equality if quantized.
    // Assuming exact equality for "same time" as per prompt.
    const isChord = chosenHand.lastEventTime !== -1 && Math.abs(note.startTime - chosenHand.lastEventTime) < 0.001;

    const finger = assignFinger(chosenHand.name, targetPos, chosenHand.currentPosition, isChord);
    chosenHand.currentFinger = finger;

    // Update Hand
    chosenHand.currentPosition = targetPos;
    chosenHand.lastEventTime = note.startTime;

    // Step D: Record
    debugEvents.push({
      noteNumber: note.noteNumber,
      startTime: note.startTime,
      assignedHand: difficulty === 'Unplayable' ? 'Unplayable' : chosenHand.name,
      finger: chosenHand.currentFinger,
      cost: chosenCost,
      difficulty,
      row: targetPos.row,
      col: targetPos.col
    });
  }

  // Calculate naive score (0-100)
  // Start at 100, subtract 5 for every Hard note, subtract 20 for every Unplayable note. Cap at 0.
  let score = 100 - (5 * hardCount) - (20 * unplayableCount);
  if (score < 0) score = 0;

  return {
    score,
    unplayableCount,
    hardCount,
    debugEvents
  };
}
