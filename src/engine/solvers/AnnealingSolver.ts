/**
 * AnnealingSolver - Simulated Annealing optimization algorithm.
 * 
 * Optimizes the GridMapping layout by iteratively mutating pad assignments
 * and accepting better or probabilistically worse solutions based on temperature.
 * Uses Beam Search as the cost evaluation function.
 */

import { Performance, EngineConfiguration } from '../../types/performance';
import { GridMapping } from '../../types/layout';
import { FingerType } from '../models';
import { BeamSolver, createBeamSolver } from './BeamSolver';
import { applyRandomMutation } from './mutationService';
import {
  SolverStrategy,
  SolverType,
  SolverConfig,
  EngineResult,
} from './types';

// ============================================================================
// Simulated Annealing Configuration
// ============================================================================

/**
 * Initial temperature for the annealing process.
 * Higher values allow more exploration of worse solutions early on.
 */
const INITIAL_TEMP = 500;

/**
 * Cooling rate applied each iteration.
 * Values close to 1.0 cool slowly, allowing more exploration.
 */
const COOLING_RATE = 0.99;

/**
 * Number of iterations to run the annealing loop.
 */
const ITERATIONS = 1000;

/**
 * Beam width for fast cost evaluation during annealing.
 * Lower values = faster but less accurate cost estimates.
 */
const FAST_BEAM_WIDTH = 2;

/**
 * Beam width for final high-quality evaluation.
 * Higher values = more accurate final result.
 */
const FINAL_BEAM_WIDTH = 50;

/**
 * Telemetry entry tracking the state at each annealing step.
 */
export interface AnnealingTelemetry {
  /** Step number (0-indexed) */
  step: number;
  /** Current temperature */
  temp: number;
  /** Current cost (averageMetrics.total from EngineResult) */
  cost: number;
  /** Whether this step was accepted */
  accepted: boolean;
}

// ============================================================================
// AnnealingSolver Implementation
// ============================================================================

/**
 * AnnealingSolver - Simulated Annealing algorithm implementation.
 * 
 * Implements the SolverStrategy interface for pluggable solver support.
 * Optimizes GridMapping layouts by mutating pad assignments and accepting
 * solutions based on the Metropolis criterion.
 */
export class AnnealingSolver implements SolverStrategy {
  public readonly name = 'Simulated Annealing';
  public readonly type: SolverType = 'annealing';
  public readonly isSynchronous = false; // Async-only due to iterative nature
  
  private instrumentConfig: SolverConfig['instrumentConfig'];
  private initialGridMapping: GridMapping | null;
  private bestMapping: GridMapping | null = null;

  constructor(config: SolverConfig) {
    this.instrumentConfig = config.instrumentConfig;
    this.initialGridMapping = config.gridMapping ?? null;
  }

  /**
   * Gets the best GridMapping found during the last solve() call.
   * Returns null if solve() hasn't been called yet.
   */
  public getBestMapping(): GridMapping | null {
    return this.bestMapping;
  }

  /**
   * Evaluates the cost of a GridMapping by running Beam Search.
   * 
   * @param mapping - The GridMapping to evaluate
   * @param performance - The performance data to analyze
   * @param config - Engine configuration (beam width, stiffness, resting pose)
   * @param beamWidth - Beam width to use for this evaluation
   * @returns Promise resolving to the cost (averageMetrics.total from EngineResult)
   */
  private async evaluateMappingCost(
    mapping: GridMapping,
    performance: Performance,
    config: EngineConfiguration,
    beamWidth: number
  ): Promise<number> {
    // Create a BeamSolver with the candidate mapping
    const solverConfig: SolverConfig = {
      instrumentConfig: this.instrumentConfig,
      gridMapping: mapping,
    };
    
    const beamSolver = createBeamSolver(solverConfig);
    
    // Create a modified config with the specified beam width
    const evaluationConfig: EngineConfiguration = {
      ...config,
      beamWidth,
    };
    
    // Run the solver
    const result = await beamSolver.solve(performance, evaluationConfig);
    
    // Return the average total cost per event
    // This is a good metric for comparison since it's normalized
    return result.averageMetrics.total;
  }

  /**
   * Solves the performance optimization problem using Simulated Annealing.
   * 
   * The algorithm:
   * 1. Starts with the current GridMapping
   * 2. Iteratively mutates the mapping
   * 3. Evaluates cost using fast Beam Search (beamWidth=2)
   * 4. Accepts better solutions or probabilistically accepts worse ones
   * 5. Cools temperature each iteration
   * 6. Runs final high-quality Beam Search (beamWidth=50) on best mapping
   * 
   * @param performance - The performance data to analyze
   * @param config - Engine configuration (beam width, stiffness, resting pose)
   * @param manualAssignments - Optional map of event index to forced finger assignment
   * @returns Promise resolving to EngineResult with optimized layout and fingering
   */
  public async solve(
    performance: Performance,
    config: EngineConfiguration,
    manualAssignments?: Record<number, { hand: 'left' | 'right', finger: FingerType }>
  ): Promise<EngineResult> {
    // Validate that we have an initial mapping
    if (!this.initialGridMapping) {
      throw new Error('AnnealingSolver requires an initial GridMapping. Cannot optimize an empty layout.');
    }

    // Setup: Start with current mapping (deep copy to ensure immutability)
    let currentMapping: GridMapping = {
      ...this.initialGridMapping,
      cells: { ...this.initialGridMapping.cells },
      fingerConstraints: { ...this.initialGridMapping.fingerConstraints },
    };
    
    // Calculate initial cost using fast Beam Search
    let currentCost = await this.evaluateMappingCost(
      currentMapping,
      performance,
      config,
      FAST_BEAM_WIDTH
    );

    // Track the best mapping found so far (deep copy)
    let bestMapping: GridMapping = {
      ...currentMapping,
      cells: { ...currentMapping.cells },
      fingerConstraints: { ...currentMapping.fingerConstraints },
    };
    let bestCost = currentCost;

    // Initialize temperature
    let currentTemp = INITIAL_TEMP;

    // Telemetry for visualization
    const telemetry: AnnealingTelemetry[] = [];

    // The Annealing Loop
    for (let step = 0; step < ITERATIONS; step++) {
      // Mutate: Get a candidate mapping
      const candidateMapping = applyRandomMutation(currentMapping);

      // Evaluate: Calculate cost of candidate using fast Beam Search
      const candidateCost = await this.evaluateMappingCost(
        candidateMapping,
        performance,
        config,
        FAST_BEAM_WIDTH
      );

      // Acceptance Probability (Metropolis criterion)
      const delta = candidateCost - currentCost;
      let accepted = false;

      if (delta < 0) {
        // Better solution: accept immediately
        accepted = true;
      } else if (delta > 0) {
        // Worse solution: accept probabilistically
        const acceptanceProbability = Math.exp(-delta / currentTemp);
        accepted = Math.random() < acceptanceProbability;
      } else {
        // Same cost: accept (neutral move)
        accepted = true;
      }

      // Update: If accepted, update current state
      if (accepted) {
        currentMapping = candidateMapping;
        currentCost = candidateCost;

        // Track best solution (deep copy)
        if (candidateCost < bestCost) {
          bestMapping = {
            ...candidateMapping,
            cells: { ...candidateMapping.cells },
            fingerConstraints: { ...candidateMapping.fingerConstraints },
          };
          bestCost = candidateCost;
        }
      }

      // Telemetry: Store step data
      telemetry.push({
        step,
        temp: currentTemp,
        cost: currentCost,
        accepted,
      });

      // Cooling: Reduce temperature
      currentTemp *= COOLING_RATE;

      // Yield to prevent UI freezing (every 50 iterations)
      if (step % 50 === 0 && step > 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Store the best mapping for retrieval via getBestMapping()
    this.bestMapping = {
      ...bestMapping,
      cells: { ...bestMapping.cells },
      fingerConstraints: { ...bestMapping.fingerConstraints },
    };

    // Final Step: Run high-quality Beam Search on the best mapping
    const solverConfig: SolverConfig = {
      instrumentConfig: this.instrumentConfig,
      gridMapping: bestMapping,
    };
    
    const finalBeamSolver = createBeamSolver(solverConfig);
    
    const finalConfig: EngineConfiguration = {
      ...config,
      beamWidth: FINAL_BEAM_WIDTH,
    };
    
    const finalResult = await finalBeamSolver.solve(
      performance,
      finalConfig,
      manualAssignments
    );

    // Attach telemetry to the result for visualization
    // Store both evolutionLog (for compatibility with existing UI) and optimizationLog (for detailed visualization)
    const evolutionLog = telemetry.map((entry, idx) => ({
      generation: idx,
      bestCost: entry.cost,
      averageCost: entry.cost, // For annealing, we only track one candidate per step
      worstCost: entry.cost,
    }));

    return {
      ...finalResult,
      evolutionLog,
      optimizationLog: telemetry, // Store full telemetry with step, temp, cost, accepted
    };
  }
}

/**
 * Factory function to create an AnnealingSolver instance.
 */
export function createAnnealingSolver(config: SolverConfig): AnnealingSolver {
  return new AnnealingSolver(config);
}

