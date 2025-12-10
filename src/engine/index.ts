/**
 * Engine module exports.
 * This is the main entry point for the performability engine.
 */

// Core solver facade and factory functions
export { 
  BiomechanicalSolver,
  resolveSolver,
  getDefaultSolverType,
  getAvailableSolverTypes,
  createBiomechanicalSolver,
  createBiomechanicalSolverWithStrategy,
} from './core';

// Re-export types from core (which re-exports from solvers/types)
export type { 
  EngineResult, 
  EngineDebugEvent, 
  FingerUsageStats, 
  FatigueMap, 
  CostBreakdown,
  SolverStrategy,
  SolverType,
  SolverConfig,
} from './core';

// Re-export evolution log type for GA visualization
export type { EvolutionLogEntry } from './solvers/types';

// Solver implementations (for direct access if needed)
export { BeamSolver, createBeamSolver } from './solvers/BeamSolver';
export { GeneticSolver, createGeneticSolver, DEFAULT_GENETIC_CONFIG } from './solvers/GeneticSolver';
export type { GeneticConfig } from './solvers/GeneticSolver';

// Grid math utilities
export { calculateGridDistance } from './gridMath';
export type { GridPosition } from './gridMath';

// Engine models and constants
export type { FingerType, HandState, EngineConstants } from './models';
export { DEFAULT_ENGINE_CONSTANTS } from './models';

// Hand pose configuration
export type { Hand, FingerId, NeutralFingerPose, NeutralHandPose, NeutralPadPosition, NeutralPadPositions, NeutralHandCenters } from './handPose';
export { DEFAULT_HAND_POSE, resolveNeutralPadPositions, getNeutralHandCenters, computeNeutralHandCenters } from './handPose';

// Feasibility checking
export { 
  isReachPossible, 
  isValidFingerOrder, 
  checkChordFeasibility,
  generateValidGrips,
  generateValidGripsFromPositions,
  generateValidGripsWithTier,
} from './feasibility';
export type { Pad, GripResult, ConstraintTier } from './feasibility';

// Cost functions
export {
  // Legacy HandState-based costs
  calculateMovementCost,
  calculateStretchPenalty,
  calculateDriftPenalty,
  getFingerBouncePenalty,
  // New HandPose-based costs (Beam Search solver)
  calculateAttractorCost,
  calculateTransitionCost,
  calculateGripStretchCost,
  calculateTotalGripCost,
  handStateToHandPose,
  // Constants
  MAX_HAND_SPEED,
  SPEED_COST_WEIGHT,
  FALLBACK_GRIP_PENALTY,
} from './costFunction';
