import { Performance, SectionMap, NoteEvent, InstrumentConfig } from '../types/performance';
import { GridMapService } from './gridMapService';
import { GridPosition, calculateGridDistance } from './gridMath';
import { defaultCostModel, Hand, MAX_REACH_GRID_UNITS, MAX_SPEED_UNITS_PER_SEC, decayFatigue, accumulateFatigue } from './ergonomics';
import { FingerID, FingerState } from '../types/engine';
import { isSpanValid, hasFingerCollision, isFingerOrderingValid } from './feasibility';

interface VirtualHand {
  lastEventTime: number;
  name: Hand;
  /** Biomechanical model: Each finger (1-5) has position and fatigue state */
  fingers: Record<FingerID, FingerState>;
  /** Wrist position - the base position of the hand */
  wristPosition: GridPosition | null;
}

interface FingerCandidate {
  hand: VirtualHand;
  handName: Hand;
  finger: FingerID;
  cost: number;
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

/**
 * Helper to get the current active position of a hand.
 * Uses wristPosition if available, otherwise finds the last active finger.
 */
function getHandPosition(hand: VirtualHand): GridPosition | null {
  if (hand.wristPosition !== null) {
    return hand.wristPosition;
  }
  
  // Find the last active finger (first non-null position from thumb to pinky)
  const allFingerIds: FingerID[] = [1, 2, 3, 4, 5];
  for (const fid of allFingerIds) {
    if (hand.fingers[fid].pos !== null) {
      return hand.fingers[fid].pos;
    }
  }
  
  return null;
}

/**
 * Decay fatigue for all fingers in a hand based on time elapsed.
 */
function decayHandFatigue(hand: VirtualHand, timeDelta: number): void {
  const allFingerIds: FingerID[] = [1, 2, 3, 4, 5];
  for (const fid of allFingerIds) {
    hand.fingers[fid].fatigue = decayFatigue(hand.fingers[fid].fatigue, timeDelta);
  }
}

/**
 * Initialize a VirtualHand with all fingers in null state and zero fatigue.
 */
function createVirtualHand(name: Hand): VirtualHand {
  return {
    lastEventTime: -1,
    name,
    fingers: {
      1: { pos: null, fatigue: 0 },
      2: { pos: null, fatigue: 0 },
      3: { pos: null, fatigue: 0 },
      4: { pos: null, fatigue: 0 },
      5: { pos: null, fatigue: 0 },
    },
    wristPosition: null,
  };
}

export function runEngine(performance: Performance, sectionMaps: SectionMap[]): EngineResult {
  // Sort all events by startTime
  const sortedEvents = [...performance.events].sort((a, b) => a.startTime - b.startTime);

  // Initialize hands with biomechanical model
  const lh: VirtualHand = createVirtualHand('LH');
  const rh: VirtualHand = createVirtualHand('RH');

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

    // Decay fatigue for both hands based on time elapsed
    const lhTimeDelta = lh.lastEventTime !== -1 ? note.startTime - lh.lastEventTime : 0;
    const rhTimeDelta = rh.lastEventTime !== -1 ? note.startTime - rh.lastEventTime : 0;
    
    if (lhTimeDelta > 0) {
      decayHandFatigue(lh, lhTimeDelta);
    }
    if (rhTimeDelta > 0) {
      decayHandFatigue(rh, rhTimeDelta);
    }

    // Step B: 10-Finger Search Loop
    // Evaluate all 10 candidates: L1, L2, L3, L4, L5, R1, R2, R3, R4, R5
    const allFingerIds: FingerID[] = [1, 2, 3, 4, 5];
    const candidates: FingerCandidate[] = [];

    // Evaluate Left Hand fingers (L1-L5)
    for (const fid of allFingerIds) {
      const fingerState = lh.fingers[fid];
      const timeDelta = lh.lastEventTime !== -1 ? note.startTime - lh.lastEventTime : 0;

      // Hard Veto: Feasibility checks
      // 1. Check span validity (wrist to target)
      if (!isSpanValid(lh.wristPosition, targetPos)) {
        continue; // Skip this candidate
      }

      // 2. Check collision with other fingers in the same hand
      if (hasFingerCollision(fid, targetPos, lh.fingers)) {
        continue; // Skip this candidate
      }

      // 3. Check finger ordering (if placing thumb or pinky, verify ordering)
      if (fid === 1 || fid === 5) {
        const thumbPos = fid === 1 ? targetPos : lh.fingers[1].pos;
        const pinkyPos = fid === 5 ? targetPos : lh.fingers[5].pos;
        if (!isFingerOrderingValid('LH', thumbPos, pinkyPos)) {
          continue; // Skip this candidate
        }
      }

      // Calculate biomechanical cost for this feasible candidate
      const cost = defaultCostModel.calculateBioCost(
        'LH',
        fid,
        fingerState.pos,
        targetPos,
        lh.wristPosition,
        fingerState.fatigue,
        timeDelta
      );

      // Only add if cost is finite (feasible)
      if (isFinite(cost)) {
        candidates.push({
          hand: lh,
          handName: 'LH',
          finger: fid,
          cost
        });
      }
    }

    // Evaluate Right Hand fingers (R1-R5)
    for (const fid of allFingerIds) {
      const fingerState = rh.fingers[fid];
      const timeDelta = rh.lastEventTime !== -1 ? note.startTime - rh.lastEventTime : 0;

      // Hard Veto: Feasibility checks
      // 1. Check span validity (wrist to target)
      if (!isSpanValid(rh.wristPosition, targetPos)) {
        continue; // Skip this candidate
      }

      // 2. Check collision with other fingers in the same hand
      if (hasFingerCollision(fid, targetPos, rh.fingers)) {
        continue; // Skip this candidate
      }

      // 3. Check finger ordering (if placing thumb or pinky, verify ordering)
      if (fid === 1 || fid === 5) {
        const thumbPos = fid === 1 ? targetPos : rh.fingers[1].pos;
        const pinkyPos = fid === 5 ? targetPos : rh.fingers[5].pos;
        if (!isFingerOrderingValid('RH', thumbPos, pinkyPos)) {
          continue; // Skip this candidate
        }
      }

      // Calculate biomechanical cost for this feasible candidate
      const cost = defaultCostModel.calculateBioCost(
        'RH',
        fid,
        fingerState.pos,
        targetPos,
        rh.wristPosition,
        fingerState.fatigue,
        timeDelta
      );

      // Only add if cost is finite (feasible)
      if (isFinite(cost)) {
        candidates.push({
          hand: rh,
          handName: 'RH',
          finger: fid,
          cost
        });
      }
    }

    // Step C: Choose the best candidate
    let chosenCandidate: FingerCandidate | null = null;
    let chosenCost = Infinity;

    if (candidates.length === 0) {
      // No feasible candidates - mark as unplayable
      unplayableCount++;
      debugEvents.push({
        noteNumber: note.noteNumber,
        startTime: note.startTime,
        assignedHand: 'Unplayable',
        finger: null,
        cost: Infinity,
        difficulty: 'Unplayable'
      });
      continue;
    }

    // Find candidate with lowest cost
    for (const candidate of candidates) {
      if (candidate.cost < chosenCost) {
        chosenCost = candidate.cost;
        chosenCandidate = candidate;
      }
    }

    if (!chosenCandidate) {
      // Fallback (shouldn't happen, but TypeScript safety)
      unplayableCount++;
      debugEvents.push({
        noteNumber: note.noteNumber,
        startTime: note.startTime,
        assignedHand: 'Unplayable',
        finger: null,
        cost: Infinity,
        difficulty: 'Unplayable'
      });
      continue;
    }

    const chosenHand = chosenCandidate.hand;
    const chosenFinger = chosenCandidate.finger;
    const chosenFingerState = chosenHand.fingers[chosenFinger];

    // Calculate Difficulty Label
    let difficulty: DifficultyLabel = 'Easy';
    const chosenFingerPos = chosenFingerState.pos;
    
    if (chosenFingerPos === null) {
      difficulty = 'Easy';
    } else {
      const dist = calculateGridDistance(chosenFingerPos, targetPos);
      const timeDelta = note.startTime - chosenHand.lastEventTime;
      
      // Unplayable: If distance > MAX_REACH_GRID_UNITS
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

    // Update the winning finger's state
    chosenHand.fingers[chosenFinger].pos = targetPos;
    // Accumulate fatigue for the used finger
    chosenHand.fingers[chosenFinger].fatigue = accumulateFatigue(chosenHand.fingers[chosenFinger].fatigue);
    
    // Update the hand's wristPosition
    chosenHand.wristPosition = targetPos;
    chosenHand.lastEventTime = note.startTime;

    // Step D: Record (save the specific finger used)
    debugEvents.push({
      noteNumber: note.noteNumber,
      startTime: note.startTime,
      assignedHand: chosenCandidate.handName,
      finger: chosenFinger,
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
