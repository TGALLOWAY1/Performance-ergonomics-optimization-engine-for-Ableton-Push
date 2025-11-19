/**
 * Ergonomic constants and cost models for the Push 3 performance engine.
 */

import { GridPosition } from './gridMath';
import { FingerID } from '../types/engine';
import { calculateGridDistance } from './gridMath';

export const MAX_REACH_GRID_UNITS = 5.0; // The maximum distance a single hand can span comfortably
export const MAX_HAND_SPAN = 5.5; // Maximum span from wrist to any finger tip
export const MAX_SPEED_UNITS_PER_SEC = 12.0; // Maximum grid distance a hand can travel in 1 second
export const CHORD_PENALTY_THRESHOLD = 3.0; // If a chord spread is wider than this, it gets a penalty

// Fatigue constants
export const FATIGUE_ACCUMULATION_RATE = 0.1; // Fatigue added per movement/use
export const FATIGUE_DECAY_RATE = 0.05; // Fatigue decay per second of rest
export const MAX_FATIGUE = 5.0; // Maximum fatigue level

// Drift penalty constants
export const DRIFT_PENALTY_MULTIPLIER = 0.5; // Penalty per unit of wrist movement

export type Hand = 'LH' | 'RH';

/**
 * Finger weights for ergonomic calculations.
 * Keys are FingerID (1-5): 1=Thumb, 2=Index, 3=Middle, 4=Ring, 5=Pinky
 */
export const FINGER_WEIGHTS: Record<FingerID, number> = {
  1: 1.2, // Thumb - slightly heavier (less agile)
  2: 1.0, // Index - baseline (most agile)
  3: 1.0, // Middle - baseline
  4: 1.1, // Ring - slightly heavier
  5: 1.3, // Pinky - heaviest (least agile)
};

/**
 * Calculates fatigue decay based on time elapsed.
 * 
 * @param currentFatigue - Current fatigue level
 * @param timeDelta - Time elapsed in seconds
 * @returns New fatigue level after decay
 */
export function decayFatigue(currentFatigue: number, timeDelta: number): number {
  if (timeDelta <= 0) return currentFatigue;
  
  const decay = FATIGUE_DECAY_RATE * timeDelta;
  return Math.max(0, currentFatigue - decay);
}

/**
 * Accumulates fatigue when a finger is used.
 * 
 * @param currentFatigue - Current fatigue level
 * @returns New fatigue level after accumulation
 */
export function accumulateFatigue(currentFatigue: number): number {
  return Math.min(MAX_FATIGUE, currentFatigue + FATIGUE_ACCUMULATION_RATE);
}

export interface CostModel {
  calculateBioCost(
    hand: Hand,
    finger: FingerID,
    currentFingerPos: GridPosition | null,
    targetPos: GridPosition,
    currentWristPos: GridPosition | null,
    fingerFatigue: number,
    timeDelta: number
  ): number;
  handSwitchCost(currentHand: Hand): number;
}

export const defaultCostModel: CostModel = {
  calculateBioCost: (
    hand: Hand,
    finger: FingerID,
    currentFingerPos: GridPosition | null,
    targetPos: GridPosition,
    currentWristPos: GridPosition | null,
    fingerFatigue: number,
    timeDelta: number
  ): number => {
    // Calculate distance from current finger position to target
    let distance: number;
    if (currentFingerPos === null) {
      // If finger is not placed, use distance from wrist (or 0 if wrist is also null)
      if (currentWristPos === null) {
        distance = 0; // Free entry
      } else {
        distance = calculateGridDistance(currentWristPos, targetPos);
      }
    } else {
      distance = calculateGridDistance(currentFingerPos, targetPos);
    }

    // Strict constraint: If distance exceeds max reach, it's impossible
    if (distance > MAX_REACH_GRID_UNITS) {
      return Infinity;
    }

    // Get finger weight
    const weight = FINGER_WEIGHTS[finger];

    // Base cost: Distance * Weight
    let cost = distance * weight;

    // Add fatigue penalty
    cost += fingerFatigue;

    // Calculate drift penalty (wrist movement)
    let driftPenalty = 0;
    if (currentWristPos !== null) {
      // Calculate how much the wrist would need to move
      // Simplified: assume wrist moves toward target (could be more sophisticated)
      const wristToTarget = calculateGridDistance(currentWristPos, targetPos);
      // If wrist needs to move significantly, add penalty
      if (wristToTarget > 1.0) {
        driftPenalty = (wristToTarget - 1.0) * DRIFT_PENALTY_MULTIPLIER;
      }
    }

    cost += driftPenalty;

    // Speed penalty: If timeDelta is very small (< 0.1s) and distance is large, multiply the cost
    if (timeDelta < 0.1 && timeDelta > 0 && distance > 1.5) {
      cost *= 2.0;
    }

    return cost;
  },

  handSwitchCost: (currentHand: Hand): number => {
    // Basic implementation: small constant cost for switching mental context
    // This represents the cognitive load of switching hands, which is usually low
    // but non-zero compared to continuing with the same hand if easy.
    return 0.5;
  }
};
