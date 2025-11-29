/**
 * Solver Strategy Types
 * 
 * Defines the Strategy Pattern interface for pluggable optimization algorithms.
 * This decoupling allows the engine to support multiple solvers (Beam Search, Genetic Algorithm, etc.)
 * while maintaining consistent input/output contracts for UI compatibility.
 */

import { Performance, EngineConfiguration } from '../../types/performance';
import { InstrumentConfig } from '../../types/performance';
import { GridMapping } from '../../types/layout';
import { FingerType, EngineConstants } from '../models';

// ============================================================================
// Solver Result Types (shared across all solvers)
// ============================================================================

/**
 * Detailed breakdown of cost components.
 */
export interface CostBreakdown {
  movement: number;
  stretch: number;
  drift: number;
  bounce: number;
  fatigue: number;
  crossover: number;
  total: number;
}

/**
 * Engine debug event with assignment details.
 */
export interface EngineDebugEvent {
  noteNumber: number;
  startTime: number;
  assignedHand: 'left' | 'right' | 'Unplayable';
  finger: FingerType | null;
  cost: number;
  costBreakdown?: CostBreakdown;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Unplayable';
  row?: number;
  col?: number;
}

/**
 * Finger usage statistics breakdown.
 */
export interface FingerUsageStats {
  /** Usage count for each finger: "L-Thumb", "L-Index", "R-Thumb", etc. */
  [fingerKey: string]: number;
}

/**
 * Fatigue map: heat map value per finger (0.0 = no fatigue, higher = more fatigued).
 */
export interface FatigueMap {
  /** Fatigue level for each finger: "L-Thumb", "L-Index", "R-Thumb", etc. */
  [fingerKey: string]: number;
}

/**
 * Evolution log entry for tracking genetic algorithm progress.
 */
export interface EvolutionLogEntry {
  /** Generation number (0-indexed) */
  generation: number;
  /** Best fitness (lowest cost) in this generation */
  bestCost: number;
  /** Average fitness across the population */
  averageCost: number;
  /** Worst fitness in this generation */
  worstCost: number;
}

/**
 * Engine result containing score and debug events.
 * This is the standardized output contract that all solvers must produce.
 */
export interface EngineResult {
  score: number;
  unplayableCount: number;
  hardCount: number;
  debugEvents: EngineDebugEvent[];
  /** Breakdown of how many times each finger was used */
  fingerUsageStats: FingerUsageStats;
  /** Heat map value per finger (fatigue levels) */
  fatigueMap: FatigueMap;
  /** Average drift distance from home positions */
  averageDrift: number;
  /** Average cost metrics across the performance */
  averageMetrics: CostBreakdown;
  /** 
   * Evolution log for genetic algorithm solver.
   * Contains the best cost per generation for visualization.
   * Only populated by GeneticSolver; undefined for other solvers.
   */
  evolutionLog?: EvolutionLogEntry[];
  /**
   * Optimization log for simulated annealing solver.
   * Contains step-by-step telemetry (step, temp, cost) for visualization.
   * Only populated by AnnealingSolver; undefined for other solvers.
   */
  optimizationLog?: Array<{ step: number; temp: number; cost: number; accepted: boolean }>;
}

// ============================================================================
// Solver Strategy Interface
// ============================================================================

/**
 * SolverStrategy: Interface for optimization algorithms.
 * 
 * Implementations must be able to analyze a Performance and produce an EngineResult.
 * This allows plugging in different algorithms (Beam Search, Genetic Algorithm, etc.)
 * while maintaining consistent inputs and outputs.
 */
export interface SolverStrategy {
  /** Human-readable name of the solver algorithm */
  readonly name: string;
  
  /** Unique identifier for the solver type */
  readonly type: SolverType;
  
  /** 
   * Whether this solver supports synchronous execution.
   * If true, solveSync() must be implemented.
   */
  readonly isSynchronous: boolean;
  
  /**
   * Solves the performance optimization problem asynchronously.
   * 
   * @param performance - The performance data to analyze (sorted events)
   * @param config - Engine configuration (beam width, stiffness, resting pose)
   * @param manualAssignments - Optional map of event index to forced finger assignment
   * @returns Promise resolving to EngineResult with score and debug events
   */
  solve(
    performance: Performance,
    config: EngineConfiguration,
    manualAssignments?: Record<number, { hand: 'left' | 'right', finger: FingerType }>
  ): Promise<EngineResult>;
  
  /**
   * Solves the performance optimization problem synchronously.
   * Only available if `isSynchronous` is true.
   * 
   * @param performance - The performance data to analyze (sorted events)
   * @param config - Engine configuration (beam width, stiffness, resting pose)
   * @param manualAssignments - Optional map of event index to forced finger assignment
   * @returns EngineResult with score and debug events
   */
  solveSync?(
    performance: Performance,
    config: EngineConfiguration,
    manualAssignments?: Record<number, { hand: 'left' | 'right', finger: FingerType }>
  ): EngineResult;
}

/**
 * Supported solver algorithm types.
 * Extensible for future algorithms.
 */
export type SolverType = 'beam' | 'genetic' | 'annealing';

/**
 * Solver configuration for instantiation.
 * Common config passed to all solvers during construction.
 */
export interface SolverConfig {
  /** Instrument configuration (grid layout, note mapping) */
  instrumentConfig: InstrumentConfig;
  /** Optional custom grid mapping (user-defined pad assignments) */
  gridMapping?: GridMapping | null;
  /** Optional engine constants (deprecated, kept for compatibility) */
  engineConstants?: EngineConstants;
}

/**
 * Factory function type for creating solver instances.
 */
export type SolverFactory = (config: SolverConfig) => SolverStrategy;

