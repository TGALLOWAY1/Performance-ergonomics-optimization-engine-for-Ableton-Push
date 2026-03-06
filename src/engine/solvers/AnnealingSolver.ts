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
import { createBeamSolver } from './BeamSolver';
import { applyRandomMutation } from './mutationService';
import { NeutralPadPositions } from '../handPose';
import { computeMappingCoverage } from '../mappingCoverage';
import { createSeededRng } from '../seededRng';
import {
  SolverStrategy,
  SolverType,
  SolverConfig,
  EngineResult,
  AnnealingIterationSnapshot,
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
 * Bumped from 2 to 5 to reduce alias-y evaluations (plan: de-aliasing).
 */
const FAST_BEAM_WIDTH = 5;

/**
 * Beam width for final high-quality evaluation.
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
  private neutralPadPositionsOverride: NeutralPadPositions | null = null;
  private bestMapping: GridMapping | null = null;
  private seed: number;

  constructor(config: SolverConfig) {
    this.instrumentConfig = config.instrumentConfig;
    this.initialGridMapping = config.gridMapping ?? null;
    this.neutralPadPositionsOverride = config.neutralPadPositionsOverride ?? null;
    this.seed = config.seed ?? Math.floor(Math.random() * 0x7fffffff);
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
   * Invalid candidates (unmapped notes) return Infinity and are always rejected.
   *
   * @param mapping - The GridMapping to evaluate
   * @param performance - The performance data to analyze
   * @param config - Engine configuration (beam width, stiffness, resting pose)
   * @param beamWidth - Beam width to use for this evaluation
   * @returns Promise resolving to the full EngineResult (for cost breakdown) and the cost value
   */
  private async evaluateMappingCost(
    mapping: GridMapping,
    performance: Performance,
    config: EngineConfiguration,
    beamWidth: number
  ): Promise<{ result: EngineResult; cost: number; invalidReason?: string }> {
    // Enforce full coverage: unmapped candidates are invalid (return Infinity)
    const coverage = computeMappingCoverage(performance, mapping);
    if (coverage.unmappedNotes.length > 0) {
      const sentinelResult: EngineResult = {
        score: 0,
        unplayableCount: performance.events.length,
        hardCount: 0,
        debugEvents: [],
        fingerUsageStats: {},
        fatigueMap: {},
        averageDrift: 0,
        averageMetrics: {
          movement: 0,
          stretch: 0,
          drift: 0,
          bounce: 0,
          fatigue: 0,
          crossover: 0,
          total: Number.POSITIVE_INFINITY,
        },
        metadata: {
          mappingCoverage: {
            totalNotes: coverage.totalNotes,
            unmappedNotesCount: coverage.unmappedNotes.length,
            fallbackNotesCount: 0,
          },
          invalidReason: 'invalid_unmapped_notes',
        },
      };
      return {
        result: sentinelResult,
        cost: Number.POSITIVE_INFINITY,
        invalidReason: 'invalid_unmapped_notes',
      };
    }

    // Create a BeamSolver with strict mode (no fallback during optimization)
    const solverConfig: SolverConfig = {
      instrumentConfig: this.instrumentConfig,
      gridMapping: mapping,
      neutralPadPositionsOverride: this.neutralPadPositionsOverride,
      mappingResolverMode: 'strict',
    };

    const beamSolver = createBeamSolver(solverConfig);

    // Create a modified config with the specified beam width
    const evaluationConfig: EngineConfiguration = {
      ...config,
      beamWidth,
    };

    // Run the solver
    const result = await beamSolver.solve(performance, evaluationConfig);

    // Return both the full result (for cost breakdown) and the cost value
    return {
      result,
      cost: result.averageMetrics.total,
    };
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
    manualAssignments?: Record<string, { hand: 'left' | 'right', finger: FingerType }>
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
    const initialEvaluation = await this.evaluateMappingCost(
      currentMapping,
      performance,
      config,
      FAST_BEAM_WIDTH
    );
    let currentCost = initialEvaluation.cost;

    // Fail early if initial mapping is invalid (unmapped notes)
    if (
      !Number.isFinite(currentCost) ||
      currentCost === Number.POSITIVE_INFINITY ||
      initialEvaluation.invalidReason
    ) {
      throw new Error(
        'Initial mapping does not cover all sounds. Seed the mapping from Pose0 or assign all required notes before optimizing.'
      );
    }

    // Track the best mapping found so far (deep copy)
    let bestMapping: GridMapping = {
      ...currentMapping,
      cells: { ...currentMapping.cells },
      fingerConstraints: { ...currentMapping.fingerConstraints },
    };
    let bestCost = currentCost;

    // Seeded RNG for deterministic mutations and acceptance
    const rng = createSeededRng(this.seed);

    // Initialize temperature
    let currentTemp = INITIAL_TEMP;

    // Telemetry for visualization (backward compatibility)
    const telemetry: AnnealingTelemetry[] = [];

    // Detailed annealing trace for comprehensive visualization
    const annealingTrace: AnnealingIterationSnapshot[] = [];

    // Downsampling: Log every iteration for accuracy (1000 iterations is manageable)
    // If needed in future, can downsample with: const logEveryN = Math.ceil(ITERATIONS / 1000);
    const LOG_EVERY_N = 1; // Log every iteration

    // The Annealing Loop
    for (let step = 0; step < ITERATIONS; step++) {
      const candidateMapping = applyRandomMutation(currentMapping, rng);

      // Evaluate: Calculate cost of candidate using fast Beam Search
      const candidateEvaluation = await this.evaluateMappingCost(
        candidateMapping,
        performance,
        config,
        FAST_BEAM_WIDTH
      );
      const candidateCost = candidateEvaluation.cost;

      // Invalid candidates (Infinity) are always rejected; avoid NaN from exp(-Infinity/T)
      const candidateInvalid =
        !Number.isFinite(candidateCost) || candidateCost === Number.POSITIVE_INFINITY;

      let accepted = false;
      let acceptanceProbability: number | undefined = undefined;

      if (candidateInvalid) {
        accepted = false;
      } else {
        const delta = candidateCost - currentCost;
        if (delta < 0) {
          accepted = true;
        } else if (delta > 0 && Number.isFinite(currentCost) && currentCost > 0) {
          acceptanceProbability = Math.exp(-delta / currentTemp);
          accepted = rng() < acceptanceProbability;
        } else {
          accepted = true; // Same cost or current was invalid
        }
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

      // Telemetry: Store step data (backward compatibility)
      telemetry.push({
        step,
        temp: currentTemp,
        cost: currentCost,
        accepted,
      });

      // Detailed trace: Log snapshot (with optional downsampling)
      if (step % LOG_EVERY_N === 0) {
        const deltaCost = candidateInvalid ? 0 : candidateCost - currentCost;

        // Compute per-metric sums from debugEvents
        // Sum up all cost breakdowns across all events
        const playableEvents = candidateEvaluation.result.debugEvents.filter(
          e => e.assignedHand !== 'Unplayable' && e.costBreakdown
        );

        // Calculate sums by summing up all cost breakdowns
        let movementSum = 0;
        let stretchSum = 0;
        let driftSum = 0;
        let bounceSum = 0;
        let fatigueSum = 0;
        let crossoverSum = 0;
        let totalCostSum = 0;

        playableEvents.forEach(event => {
          if (event.costBreakdown) {
            movementSum += event.costBreakdown.movement;
            stretchSum += event.costBreakdown.stretch;
            driftSum += event.costBreakdown.drift;
            bounceSum += event.costBreakdown.bounce;
            fatigueSum += event.costBreakdown.fatigue;
            crossoverSum += event.costBreakdown.crossover;
            totalCostSum += event.costBreakdown.total;
          }
        });

        // Build snapshot with sums
        const snapshot: AnnealingIterationSnapshot = {
          iteration: step,
          temperature: currentTemp,
          currentCost: currentCost,
          bestCost: bestCost,
          accepted: accepted,
          deltaCost: deltaCost,
          acceptanceProbability: acceptanceProbability,
          movementSum,
          stretchSum,
          driftSum,
          bounceSum,
          fatigueSum,
          crossoverSum,
        };

        // Calculate shares if total cost sum is available and > 0
        if (totalCostSum > 0) {
          snapshot.movementShare = movementSum / totalCostSum;
          snapshot.stretchShare = stretchSum / totalCostSum;
          snapshot.driftShare = driftSum / totalCostSum;
          snapshot.bounceShare = bounceSum / totalCostSum;
          snapshot.fatigueShare = fatigueSum / totalCostSum;
          snapshot.crossoverShare = crossoverSum / totalCostSum;
        }

        annealingTrace.push(snapshot);
      }

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
      optimizationLog: telemetry,
      annealingTrace,
      metadata: {
        ...finalResult.metadata,
        seed: this.seed,
        objectiveTotal: finalResult.averageMetrics.total,
        objectiveComponentsSummary: finalResult.metadata?.objectiveComponentsSummary,
      },
    };
  }
}

/**
 * Factory function to create an AnnealingSolver instance.
 */
export function createAnnealingSolver(config: SolverConfig): AnnealingSolver {
  return new AnnealingSolver(config);
}

