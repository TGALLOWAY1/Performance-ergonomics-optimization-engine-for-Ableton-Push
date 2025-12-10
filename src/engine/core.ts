/**
 * BiomechanicalSolver - Core performability engine facade.
 * 
 * This module acts as a SolverFactory/Facade, delegating to pluggable solver
 * implementations (Beam Search, Genetic Algorithm, etc.) while maintaining
 * a consistent API for the UI layer.
 * 
 * The Strategy Pattern allows different optimization algorithms to be swapped
 * without changing the consumer code.
 */

import { Performance, EngineConfiguration } from '../types/performance';
import { InstrumentConfig } from '../types/performance';
import { GridMapping } from '../types/layout';
import { FingerType, EngineConstants, DEFAULT_ENGINE_CONSTANTS } from './models';
import { DEFAULT_ENGINE_CONFIGURATION } from '../types/projectState';

// Re-export types from solvers for backwards compatibility
export type {
  EngineResult,
  EngineDebugEvent,
  FingerUsageStats,
  FatigueMap,
  CostBreakdown,
  SolverStrategy,
  SolverType,
  SolverConfig,
  AnnealingIterationSnapshot,
} from './solvers/types';

// Import solver implementations
import { createBeamSolver } from './solvers/BeamSolver';
import { createGeneticSolver } from './solvers/GeneticSolver';
import { createAnnealingSolver } from './solvers/AnnealingSolver';
import { SolverStrategy, SolverType, SolverConfig, EngineResult } from './solvers/types';

// ============================================================================
// Solver Factory
// ============================================================================

/**
 * Resolves a solver strategy by type.
 * 
 * @param type - The solver algorithm type ('beam' | 'genetic' | 'annealing')
 * @param config - Solver configuration (instrument config, grid mapping)
 * @returns A SolverStrategy instance
 * @throws Error if the solver type is not supported
 */
export function resolveSolver(type: SolverType, config: SolverConfig): SolverStrategy {
  switch (type) {
    case 'beam':
      return createBeamSolver(config);
    
    case 'genetic':
      return createGeneticSolver(config);
    
    case 'annealing':
      return createAnnealingSolver(config);
    
    default:
      throw new Error(`Unknown solver type: ${type}`);
  }
}

/**
 * Returns the default solver type.
 */
export function getDefaultSolverType(): SolverType {
  return 'beam';
}

/**
 * Returns all available solver types.
 */
export function getAvailableSolverTypes(): SolverType[] {
  return ['beam', 'genetic', 'annealing'];
}

// ============================================================================
// BiomechanicalSolver - Facade Class
// ============================================================================

/**
 * BiomechanicalSolver - Main solver facade class.
 * 
 * Provides backwards-compatible API while delegating to pluggable solver strategies.
 * The default strategy is Beam Search, but can be changed via `setStrategy()`.
 */
export class BiomechanicalSolver {
  private instrumentConfig: InstrumentConfig;
  private gridMapping: GridMapping | null;
  private engineConfig: EngineConfiguration;
  private strategy: SolverStrategy;

  constructor(
    instrumentConfig: InstrumentConfig,
    gridMapping: GridMapping | null = null,
    _constants: EngineConstants = DEFAULT_ENGINE_CONSTANTS, // Kept for API compatibility
    engineConfig: EngineConfiguration = DEFAULT_ENGINE_CONFIGURATION,
    solverType: SolverType = 'beam'
  ) {
    this.instrumentConfig = instrumentConfig;
    this.gridMapping = gridMapping;
    this.engineConfig = engineConfig;
    
    // Initialize the solver strategy
    const solverConfig: SolverConfig = {
      instrumentConfig,
      gridMapping,
      engineConstants: _constants,
    };
    
    this.strategy = resolveSolver(solverType, solverConfig);
        }
        
  /**
   * Gets the current solver strategy name.
   */
  public get strategyName(): string {
    return this.strategy.name;
  }

  /**
   * Gets the current solver type.
   */
  public get solverType(): SolverType {
    return this.strategy.type;
  }

  /**
   * Sets a new solver strategy.
   * 
   * @param type - The solver algorithm type to switch to
   */
  public setStrategy(type: SolverType): void {
    const solverConfig: SolverConfig = {
      instrumentConfig: this.instrumentConfig,
      gridMapping: this.gridMapping,
    };
    
    this.strategy = resolveSolver(type, solverConfig);
  }

  /**
   * Updates the grid mapping and reinitializes the solver strategy.
   * 
   * @param gridMapping - New grid mapping to use
   */
  public updateGridMapping(gridMapping: GridMapping | null): void {
    this.gridMapping = gridMapping;
    
    const solverConfig: SolverConfig = {
      instrumentConfig: this.instrumentConfig,
      gridMapping: this.gridMapping,
    };
    
    // Recreate strategy with new config
    this.strategy = resolveSolver(this.strategy.type, solverConfig);
  }

  /**
   * Updates the engine configuration.
   * 
   * @param config - New engine configuration
   */
  public updateEngineConfig(config: EngineConfiguration): void {
    this.engineConfig = config;
  }

  /**
   * Solves the performance optimization problem synchronously.
   * 
   * NOTE: This requires the solver to support synchronous execution.
   * For async-only solvers, use `solveAsync()`.
   * 
   * @param performance - The performance data to analyze
   * @param manualAssignments - Optional map of event index to forced finger assignment
   * @returns EngineResult with score and debug events
   * @throws Error if the solver doesn't support synchronous execution
   */
  public solve(
    performance: Performance,
    manualAssignments?: Record<number, { hand: 'left' | 'right', finger: FingerType }>
  ): EngineResult {
    // Check if solver supports synchronous execution
    if (!this.strategy.isSynchronous || !this.strategy.solveSync) {
      throw new Error(
        `Solver '${this.strategy.name}' does not support synchronous execution. Use solveAsync() instead.`
      );
    }
    
    return this.strategy.solveSync(performance, this.engineConfig, manualAssignments);
  }

  /**
   * Solves the performance optimization problem asynchronously.
   * 
   * Preferred method for solving, especially with async solver strategies.
   * 
   * @param performance - The performance data to analyze
   * @param manualAssignments - Optional map of event index to forced finger assignment
   * @returns Promise resolving to EngineResult with score and debug events
   */
  public async solveAsync(
    performance: Performance,
    manualAssignments?: Record<number, { hand: 'left' | 'right', finger: FingerType }>
  ): Promise<EngineResult> {
    return this.strategy.solve(performance, this.engineConfig, manualAssignments);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a BiomechanicalSolver with the default Beam Search strategy.
 */
export function createBiomechanicalSolver(
  instrumentConfig: InstrumentConfig,
  gridMapping: GridMapping | null = null,
  engineConfig: EngineConfiguration = DEFAULT_ENGINE_CONFIGURATION
): BiomechanicalSolver {
  return new BiomechanicalSolver(
    instrumentConfig,
    gridMapping,
    DEFAULT_ENGINE_CONSTANTS,
    engineConfig,
    'beam'
  );
}

/**
 * Creates a BiomechanicalSolver with a specific solver strategy.
 */
export function createBiomechanicalSolverWithStrategy(
  instrumentConfig: InstrumentConfig,
  gridMapping: GridMapping | null,
  engineConfig: EngineConfiguration,
  solverType: SolverType
): BiomechanicalSolver {
  return new BiomechanicalSolver(
    instrumentConfig,
    gridMapping,
    DEFAULT_ENGINE_CONSTANTS,
    engineConfig,
    solverType
  );
  }
