/**
 * Ergonomic constants and cost models for the Push 3 performance engine.
 */

export const MAX_REACH_GRID_UNITS = 5.0; // The maximum distance a single hand can span comfortably
export const MAX_SPEED_UNITS_PER_SEC = 12.0; // Maximum grid distance a hand can travel in 1 second
export const CHORD_PENALTY_THRESHOLD = 3.0; // If a chord spread is wider than this, it gets a penalty

export type Hand = 'LH' | 'RH';

/**
 * Finger weights for ergonomic calculations.
 * Keys are FingerID (1-5): 1=Thumb, 2=Index, 3=Middle, 4=Ring, 5=Pinky
 */
export const FINGER_WEIGHTS: Record<number, number> = {
  1: 1.2, // Thumb - slightly heavier (less agile)
  2: 1.0, // Index - baseline (most agile)
  3: 1.0, // Middle - baseline
  4: 1.1, // Ring - slightly heavier
  5: 1.3, // Pinky - heaviest (least agile)
};

export interface CostModel {
  movementCost(distance: number, timeDelta: number): number;
  handSwitchCost(currentHand: Hand): number;
}

export const defaultCostModel: CostModel = {
  movementCost: (distance: number, timeDelta: number): number => {
    // Strict constraint: If distance exceeds max reach, it's impossible for one hand
    // This is especially critical for chords (timeDelta ~ 0)
    if (distance > MAX_REACH_GRID_UNITS) {
      return Infinity;
    }

    let cost = distance;
    
    // If timeDelta is very small (< 0.1s) and distance is large, multiply the cost 
    // (simulate fast jumps being harder).
    // We consider "large" to be anything requiring near max speed or significant span.
    // 12 units/sec * 0.1s = 1.2 units. So > 1.5 is definitely "fast/large" for that timeframe.
    if (timeDelta < 0.1 && distance > 1.5) {
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
