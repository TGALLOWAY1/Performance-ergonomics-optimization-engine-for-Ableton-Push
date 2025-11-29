/**
 * Solvers module - Exports all solver implementations and types.
 */

// Types
export type {
  SolverStrategy,
  SolverType,
  SolverConfig,
  SolverFactory,
  EngineResult,
  EngineDebugEvent,
  FingerUsageStats,
  FatigueMap,
  CostBreakdown,
  EvolutionLogEntry,
} from './types';

// Beam Search Solver
export { BeamSolver, createBeamSolver } from './BeamSolver';

// Genetic Algorithm Solver
export { GeneticSolver, createGeneticSolver, DEFAULT_GENETIC_CONFIG } from './GeneticSolver';
export type { GeneticConfig } from './GeneticSolver';

// Simulated Annealing Solver
export { AnnealingSolver, createAnnealingSolver } from './AnnealingSolver';
export type { AnnealingTelemetry } from './AnnealingSolver';

