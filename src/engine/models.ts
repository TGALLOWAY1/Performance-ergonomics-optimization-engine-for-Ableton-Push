/**
 * Advanced hand structures for the Performability Engine.
 * These models provide a more detailed biomechanical representation
 * of hand and finger states for ergonomic analysis.
 */

/**
 * Finger type enumeration.
 * Represents the five fingers of a hand.
 */
export type FingerType = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';

/**
 * Hand side enumeration.
 * Represents which hand (left or right).
 */
export type HandSide = 'left' | 'right';

/**
 * Grid position as a tuple [row, col].
 * Row and column are 0-based indices.
 */
export type GridPos = [number, number];

/**
 * FingerState tracks the current state of a single finger.
 * Includes position on the grid and fatigue level.
 */
export interface FingerState {
  /** Current grid position [row, col], or null if finger is not placed */
  currentGridPos: GridPos | null;
  /** Fatigue level (0.0 = no fatigue, higher = more fatigued) */
  fatigueLevel: number;
}

/**
 * HandState tracks the overall state of a hand.
 * Includes all finger states, center of gravity, and span width.
 */
export interface HandState {
  /** State of each finger, indexed by FingerType */
  fingers: Record<FingerType, FingerState>;
  /** Center of gravity of the hand [row, col], calculated from finger positions */
  centerOfGravity: GridPos | null;
  /** Span width in grid cells (distance between thumb and pinky) */
  spanWidth: number;
}

/**
 * Engine constants for biomechanical calculations.
 * These values define the physical constraints and weights
 * used in the performability engine.
 */
export interface EngineConstants {
  /** Maximum span width in grid cells (typically 3-4 cells) */
  maxSpan: number;
  /** Minimum span width in grid cells */
  minSpan: number;
  /** Ideal reach distance in grid cells */
  idealReach: number;
  /** Maximum reach distance in grid cells (beyond which a finger cannot reach) */
  maxReach: number;
  /** Finger strength weights for cost calculations.
   * Higher values indicate weaker/more fatiguing fingers.
   * Index finger is baseline (1.0).
   */
  fingerStrengthWeights: {
    index: number;    // 1.0 (baseline)
    middle: number;   // Typically similar to index
    ring: number;     // Slightly weaker than index
    pinky: number;     // 2.5 (weakest)
    thumb: number;     // 2.0 (less agile than index)
  };
}

/**
 * Default engine constants.
 * These values are based on biomechanical research and ergonomic best practices.
 */
export const DEFAULT_ENGINE_CONSTANTS: EngineConstants = {
  maxSpan: 4,        // Maximum span: 4 cells
  minSpan: 0,        // Minimum span: 0 cells (fingers together)
  idealReach: 2,     // Ideal reach: 2 cells
  maxReach: 4,       // Maximum reach: 4 cells (beyond this is impossible)
  fingerStrengthWeights: {
    index: 1.0,      // Index finger: baseline (most agile)
    middle: 1.0,     // Middle finger: same as index
    ring: 1.1,       // Ring finger: slightly weaker
    pinky: 2.5,      // Pinky: weakest (2.5x cost)
    thumb: 2.0,      // Thumb: less agile (2.0x cost)
  },
};

