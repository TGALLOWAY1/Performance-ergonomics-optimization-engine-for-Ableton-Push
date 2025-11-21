/**
 * Engine module exports.
 * This is the main entry point for the performability engine.
 */

export { SectionAwareSolver } from './core';
export type { EngineResult, EngineDebugEvent, FingerUsageStats, FatigueMap } from './core';
export { GridPosition, calculateGridDistance } from './gridMath';
export type { FingerType, HandState, EngineConstants } from './models';
export { DEFAULT_ENGINE_CONSTANTS } from './models';
export { isReachPossible, isValidFingerOrder, checkChordFeasibility } from './feasibility';
export {
  calculateMovementCost,
  calculateStretchPenalty,
  calculateDriftPenalty,
  getFingerBouncePenalty,
} from './costFunction';

