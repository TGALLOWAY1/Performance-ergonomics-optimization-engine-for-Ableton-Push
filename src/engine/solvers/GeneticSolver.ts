/**
 * GeneticSolver - Genetic Algorithm optimization strategy.
 * 
 * Uses evolutionary optimization to find near-optimal finger assignments.
 * A "Chromosome" represents a complete sequence of hand poses for all events.
 * The algorithm evolves a population of chromosomes over multiple generations.
 */

import { Performance, NoteEvent, HandPose, EngineConfiguration } from '../../types/performance';
import { InstrumentConfig } from '../../types/performance';
import { GridMapService } from '../gridMapService';
import { FingerType } from '../models';
import { GridMapping } from '../../types/layout';
import { generateValidGripsWithTier, Pad, GripResult } from '../feasibility';
import {
  calculateTransitionCost,
  calculateGripStretchCost,
  calculateAttractorCost,
} from '../costFunction';
import { GridPosition } from '../gridMath';
import {
  SolverStrategy,
  SolverType,
  SolverConfig,
  EngineResult,
  EngineDebugEvent,
  FingerUsageStats,
  FatigueMap,
  CostBreakdown,
  EvolutionLogEntry,
} from './types';

// ============================================================================
// Genetic Algorithm Configuration
// ============================================================================

/**
 * Configuration for the genetic algorithm.
 */
export interface GeneticConfig {
  /** Number of chromosomes in the population */
  populationSize: number;
  /** Number of generations to evolve */
  generations: number;
  /** Probability of mutation per gene (0.0 to 1.0) */
  mutationRate: number;
  /** Tournament size for selection */
  tournamentSize: number;
  /** Elitism: number of best individuals to carry over unchanged */
  elitismCount: number;
}

/**
 * Default genetic algorithm configuration.
 */
export const DEFAULT_GENETIC_CONFIG: GeneticConfig = {
  populationSize: 50,
  generations: 100,
  mutationRate: 0.05,
  tournamentSize: 2,
  elitismCount: 2,
};

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Gene: A single hand assignment for one event.
 */
interface Gene {
  /** Index of the event in the sorted events array */
  eventIndex: number;
  /** Original note number */
  noteNumber: number;
  /** Start time of the event */
  startTime: number;
  /** Which hand plays this note */
  hand: 'left' | 'right';
  /** The hand pose/grip for this event */
  pose: HandPose;
  /** Which finger within the grip plays this note */
  finger: FingerType;
  /** Grid position */
  position: GridPosition;
  /** Whether this is a fallback grip */
  isFallback: boolean;
}

/**
 * Chromosome: A complete sequence of genes for all events.
 */
interface Chromosome {
  /** Array of genes, one per event, in time order */
  genes: Gene[];
  /** Cached fitness (total cost) - lower is better */
  fitness: number;
}

/**
 * Event context for grip generation.
 */
interface EventContext {
  event: NoteEvent;
  originalIndex: number;
  position: GridPosition;
  pad: Pad;
}

// ============================================================================
// GeneticSolver Implementation
// ============================================================================

/**
 * GeneticSolver - Genetic Algorithm implementation.
 * 
 * Implements the SolverStrategy interface for pluggable solver support.
 * Uses evolutionary optimization to find globally optimal finger assignments.
 */
export class GeneticSolver implements SolverStrategy {
  public readonly name = 'Genetic Algorithm';
  public readonly type: SolverType = 'genetic';
  public readonly isSynchronous = false; // GA is async due to computation time
  
  private instrumentConfig: InstrumentConfig;
  private gridMapping: GridMapping | null;
  private geneticConfig: GeneticConfig;

  constructor(config: SolverConfig, geneticConfig: GeneticConfig = DEFAULT_GENETIC_CONFIG) {
    this.instrumentConfig = config.instrumentConfig;
    this.gridMapping = config.gridMapping ?? null;
    this.geneticConfig = geneticConfig;
  }

  /**
   * Gets the grid position for a MIDI note.
   */
  private getNotePosition(noteNumber: number): GridPosition | null {
    // 1. Try custom mapping first
    if (this.gridMapping) {
      for (const [key, voice] of Object.entries(this.gridMapping.cells)) {
        if (voice.originalMidiNote === noteNumber) {
          const [rowStr, colStr] = key.split(',');
          return {
            row: parseInt(rowStr, 10),
            col: parseInt(colStr, 10)
          };
        }
      }
    }

    // 2. Fallback to algorithmic mapping
    const tuple = GridMapService.noteToGrid(noteNumber, this.instrumentConfig);
    if (tuple) {
      return { row: tuple[0], col: tuple[1] };
    }

    return null;
  }

  /**
   * Generates a random valid grip for a pad position.
   * Randomly selects from available grips for either hand.
   */
  private generateRandomGene(
    eventContext: EventContext,
    rng: () => number
  ): Gene {
    const { event, originalIndex, position, pad } = eventContext;
    
    // Randomly select hand
    const hand: 'left' | 'right' = rng() < 0.5 ? 'left' : 'right';
    
    // Get valid grips for this hand
    const grips = generateValidGripsWithTier([pad], hand);
    
    // Randomly select one grip
    const gripIndex = Math.floor(rng() * grips.length);
    const selectedGrip = grips[gripIndex];
    
    // Get the first finger from the grip
    const fingers = Object.keys(selectedGrip.pose.fingers) as FingerType[];
    const finger = fingers[0] || 'index';
    
    return {
      eventIndex: originalIndex,
      noteNumber: event.noteNumber,
      startTime: event.startTime,
      hand,
      pose: selectedGrip.pose,
      finger,
      position,
      isFallback: selectedGrip.isFallback,
    };
  }

  /**
   * Initializes the population with random chromosomes.
   */
  private initializePopulation(
    eventContexts: EventContext[],
    populationSize: number,
    rng: () => number
  ): Chromosome[] {
    const population: Chromosome[] = [];
    
    for (let i = 0; i < populationSize; i++) {
      const genes: Gene[] = eventContexts.map(ctx => 
        this.generateRandomGene(ctx, rng)
      );
      
      population.push({
        genes,
        fitness: Infinity, // Will be calculated during evaluation
      });
    }
    
    return population;
  }

  /**
   * Calculates the fitness (total cost) of a chromosome.
   * Lower fitness is better.
   */
  private evaluateChromosome(
    chromosome: Chromosome,
    config: EngineConfiguration
  ): number {
    if (chromosome.genes.length === 0) {
      return 0;
    }
    
    let totalCost = 0;
    const { stiffness, restingPose } = config;
    
    // Calculate costs for each gene transition
    for (let i = 0; i < chromosome.genes.length; i++) {
      const gene = chromosome.genes[i];
      
      // Static grip cost (stretch penalty)
      const staticCost = calculateGripStretchCost(gene.pose);
      totalCost += staticCost;
      
      // Attractor cost (distance from resting position)
      const restPose = gene.hand === 'left' ? restingPose.left : restingPose.right;
      const attractorCost = calculateAttractorCost(gene.pose, restPose, stiffness);
      totalCost += attractorCost;
      
      // Transition cost from previous gene
      if (i > 0) {
        const prevGene = chromosome.genes[i - 1];
        const timeDelta = gene.startTime - prevGene.startTime;
        
        // Only calculate transition if same hand
        if (gene.hand === prevGene.hand) {
          const transitionCost = calculateTransitionCost(prevGene.pose, gene.pose, timeDelta);
          if (transitionCost === Infinity) {
            // Impossible transition - heavy penalty
            totalCost += 1000;
          } else {
            totalCost += transitionCost;
          }
        }
      }
      
      // Fallback grip penalty
      if (gene.isFallback) {
        totalCost += 100;
      }
    }
    
    return totalCost;
  }

  /**
   * Evaluates all chromosomes in the population.
   */
  private evaluatePopulation(
    population: Chromosome[],
    config: EngineConfiguration
  ): void {
    for (const chromosome of population) {
      chromosome.fitness = this.evaluateChromosome(chromosome, config);
    }
  }

  /**
   * Tournament selection: picks tournamentSize random individuals and returns the best.
   */
  private tournamentSelect(
    population: Chromosome[],
    tournamentSize: number,
    rng: () => number
  ): Chromosome {
    let best: Chromosome | null = null;
    
    for (let i = 0; i < tournamentSize; i++) {
      const idx = Math.floor(rng() * population.length);
      const candidate = population[idx];
      
      if (best === null || candidate.fitness < best.fitness) {
        best = candidate;
      }
    }
    
    return best!;
  }

  /**
   * Single-point crossover between two parent chromosomes.
   * Returns two child chromosomes.
   */
  private crossover(
    parent1: Chromosome,
    parent2: Chromosome,
    eventContexts: EventContext[],
    config: EngineConfiguration,
    rng: () => number
  ): [Chromosome, Chromosome] {
    const geneCount = parent1.genes.length;
    
    if (geneCount <= 1) {
      // No crossover possible with 0 or 1 genes
      return [
        { genes: [...parent1.genes], fitness: Infinity },
        { genes: [...parent2.genes], fitness: Infinity },
      ];
    }
    
    // Select random crossover point (1 to geneCount-1)
    const crossoverPoint = 1 + Math.floor(rng() * (geneCount - 1));
    
    // Create children with swapped segments
    const child1Genes: Gene[] = [
      ...parent1.genes.slice(0, crossoverPoint),
      ...parent2.genes.slice(crossoverPoint),
    ];
    
    const child2Genes: Gene[] = [
      ...parent2.genes.slice(0, crossoverPoint),
      ...parent1.genes.slice(crossoverPoint),
    ];
    
    // Repair crossover point if transition is invalid
    this.repairCrossoverPoint(child1Genes, crossoverPoint, eventContexts, config, rng);
    this.repairCrossoverPoint(child2Genes, crossoverPoint, eventContexts, config, rng);
    
    return [
      { genes: child1Genes, fitness: Infinity },
      { genes: child2Genes, fitness: Infinity },
    ];
  }

  /**
   * Repairs an invalid transition at the crossover point.
   */
  private repairCrossoverPoint(
    genes: Gene[],
    crossoverPoint: number,
    eventContexts: EventContext[],
    config: EngineConfiguration,
    rng: () => number
  ): void {
    if (crossoverPoint >= genes.length) return;
    
    const prevGene = genes[crossoverPoint - 1];
    const currGene = genes[crossoverPoint];
    
    // Check if transition is valid
    if (prevGene.hand === currGene.hand) {
      const timeDelta = currGene.startTime - prevGene.startTime;
      const transitionCost = calculateTransitionCost(prevGene.pose, currGene.pose, timeDelta);
      
      if (transitionCost === Infinity) {
        // Invalid transition - re-generate the gene at crossover point
        genes[crossoverPoint] = this.generateRandomGene(eventContexts[crossoverPoint], rng);
      }
    }
  }

  /**
   * Mutates a chromosome with the given mutation rate.
   */
  private mutate(
    chromosome: Chromosome,
    eventContexts: EventContext[],
    mutationRate: number,
    rng: () => number
  ): void {
    for (let i = 0; i < chromosome.genes.length; i++) {
      if (rng() < mutationRate) {
        // Re-generate this gene
        chromosome.genes[i] = this.generateRandomGene(eventContexts[i], rng);
      }
    }
  }

  /**
   * Evolves the population for one generation.
   */
  private evolveGeneration(
    population: Chromosome[],
    eventContexts: EventContext[],
    config: EngineConfiguration,
    rng: () => number
  ): Chromosome[] {
    const { populationSize, tournamentSize, mutationRate, elitismCount } = this.geneticConfig;
    
    // Sort population by fitness (best first)
    population.sort((a, b) => a.fitness - b.fitness);
    
    const newPopulation: Chromosome[] = [];
    
    // Elitism: keep best individuals unchanged
    for (let i = 0; i < elitismCount && i < population.length; i++) {
      newPopulation.push({
        genes: [...population[i].genes],
        fitness: population[i].fitness,
      });
    }
    
    // Generate rest of population through selection and crossover
    while (newPopulation.length < populationSize) {
      // Select parents
      const parent1 = this.tournamentSelect(population, tournamentSize, rng);
      const parent2 = this.tournamentSelect(population, tournamentSize, rng);
      
      // Crossover
      const [child1, child2] = this.crossover(parent1, parent2, eventContexts, config, rng);
      
      // Mutate
      this.mutate(child1, eventContexts, mutationRate, rng);
      this.mutate(child2, eventContexts, mutationRate, rng);
      
      // Add to new population
      newPopulation.push(child1);
      if (newPopulation.length < populationSize) {
        newPopulation.push(child2);
      }
    }
    
    return newPopulation;
  }

  /**
   * Determines difficulty label based on cost.
   */
  private getDifficulty(cost: number): 'Easy' | 'Medium' | 'Hard' | 'Unplayable' {
    if (cost === Infinity || cost > 100) {
      return 'Unplayable';
    } else if (cost > 10) {
      return 'Hard';
    } else if (cost > 3) {
      return 'Medium';
    } else {
      return 'Easy';
    }
  }

  /**
   * Builds the EngineResult from the best chromosome.
   */
  private buildResult(
    bestChromosome: Chromosome,
    totalEvents: number,
    unmappedIndices: Set<number>,
    config: EngineConfiguration,
    evolutionLog: EvolutionLogEntry[]
  ): EngineResult {
    const debugEvents: EngineDebugEvent[] = [];
    const fingerUsageStats: FingerUsageStats = {};
    const fatigueMap: FatigueMap = {};
    
    let unplayableCount = unmappedIndices.size;
    let hardCount = 0;
    let totalDrift = 0;
    let driftCount = 0;

    const totalMetrics: CostBreakdown = {
      movement: 0,
      stretch: 0,
      drift: 0,
      bounce: 0,
      fatigue: 0,
      crossover: 0,
      total: 0,
    };

    // Create gene map by event index
    const geneMap = new Map<number, Gene>();
    for (const gene of bestChromosome.genes) {
      geneMap.set(gene.eventIndex, gene);
    }

    // Build debug events for all events
    for (let i = 0; i < totalEvents; i++) {
      if (unmappedIndices.has(i)) {
        debugEvents.push({
          noteNumber: 0,
          startTime: 0,
          assignedHand: 'Unplayable',
          finger: null,
          cost: Infinity,
          difficulty: 'Unplayable',
        });
        continue;
      }

      const gene = geneMap.get(i);
      if (!gene) {
        unplayableCount++;
        debugEvents.push({
          noteNumber: 0,
          startTime: 0,
          assignedHand: 'Unplayable',
          finger: null,
          cost: Infinity,
          difficulty: 'Unplayable',
        });
        continue;
      }

      // Calculate individual gene cost for difficulty rating
      const staticCost = calculateGripStretchCost(gene.pose);
      const restPose = gene.hand === 'left' ? config.restingPose.left : config.restingPose.right;
      const attractorCost = calculateAttractorCost(gene.pose, restPose, config.stiffness);
      const geneCost = staticCost + attractorCost + (gene.isFallback ? 100 : 0);

      const difficulty = this.getDifficulty(geneCost);
      if (difficulty === 'Hard') hardCount++;

      // Update finger usage stats
      const fingerKey = `${gene.hand === 'left' ? 'L' : 'R'}-${gene.finger.charAt(0).toUpperCase() + gene.finger.slice(1)}`;
      fingerUsageStats[fingerKey] = (fingerUsageStats[fingerKey] || 0) + 1;

      // Calculate drift from home
      const homeCentroid = gene.hand === 'left' 
        ? config.restingPose.left.centroid 
        : config.restingPose.right.centroid;
      const drift = Math.sqrt(
        Math.pow(gene.pose.centroid.x - homeCentroid.x, 2) + 
        Math.pow(gene.pose.centroid.y - homeCentroid.y, 2)
      );
      totalDrift += drift;
      driftCount++;

      // Cost breakdown
      const costBreakdown: CostBreakdown = {
        movement: geneCost * 0.4,
        stretch: staticCost,
        drift: attractorCost,
        bounce: 0,
        fatigue: geneCost * 0.1,
        crossover: 0,
        total: geneCost,
      };

      totalMetrics.movement += costBreakdown.movement;
      totalMetrics.stretch += costBreakdown.stretch;
      totalMetrics.drift += costBreakdown.drift;
      totalMetrics.fatigue += costBreakdown.fatigue;
      totalMetrics.total += costBreakdown.total;

      debugEvents.push({
        noteNumber: gene.noteNumber,
        startTime: gene.startTime,
        assignedHand: gene.hand,
        finger: gene.finger,
        cost: geneCost,
        costBreakdown,
        difficulty,
        row: gene.position.row,
        col: gene.position.col,
      });
    }

    // Calculate averages
    const eventCount = debugEvents.length - unplayableCount;
    const averageMetrics: CostBreakdown = eventCount > 0 ? {
      movement: totalMetrics.movement / eventCount,
      stretch: totalMetrics.stretch / eventCount,
      drift: totalMetrics.drift / eventCount,
      bounce: 0,
      fatigue: totalMetrics.fatigue / eventCount,
      crossover: 0,
      total: totalMetrics.total / eventCount,
    } : {
      movement: 0, stretch: 0, drift: 0, bounce: 0, fatigue: 0, crossover: 0, total: 0,
    };

    // Initialize fatigue map
    const fingerTypes: FingerType[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
    for (const finger of fingerTypes) {
      fatigueMap[`L-${finger.charAt(0).toUpperCase() + finger.slice(1)}`] = 0;
      fatigueMap[`R-${finger.charAt(0).toUpperCase() + finger.slice(1)}`] = 0;
    }

    // Calculate score (0-100)
    let score = 100 - (5 * hardCount) - (20 * unplayableCount);
    if (score < 0) score = 0;

    return {
      score,
      unplayableCount,
      hardCount,
      debugEvents,
      fingerUsageStats,
      fatigueMap,
      averageDrift: driftCount > 0 ? totalDrift / driftCount : 0,
      averageMetrics,
      evolutionLog,
    };
  }

  /**
   * Solves the performance using Genetic Algorithm.
   * This is an async operation due to the computational cost.
   * 
   * @param performance - The performance data to analyze
   * @param config - Engine configuration
   * @param manualAssignments - Optional manual overrides (handled as constraints)
   * @returns Promise resolving to EngineResult with evolution log
   */
  public async solve(
    performance: Performance,
    config: EngineConfiguration,
    manualAssignments?: Record<number, { hand: 'left' | 'right', finger: FingerType }>
  ): Promise<EngineResult> {
    const { populationSize, generations } = this.geneticConfig;
    
    // Seeded PRNG for reproducibility (could be made configurable)
    let seed = 42;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    // Sort events by time
    const sortedEvents = [...performance.events]
      .map((event, originalIndex) => ({ event, originalIndex }))
      .sort((a, b) => a.event.startTime - b.event.startTime);

    // Map events to grid positions and filter unmapped
    const unmappedIndices = new Set<number>();
    const eventContexts: EventContext[] = [];

    for (const { event, originalIndex } of sortedEvents) {
      const position = this.getNotePosition(event.noteNumber);
      if (!position) {
        unmappedIndices.add(originalIndex);
        continue;
      }
      
      eventContexts.push({
        event,
        originalIndex,
        position,
        pad: { row: position.row, col: position.col },
      });
    }

    // Handle empty events case
    if (eventContexts.length === 0) {
      return this.buildResult(
        { genes: [], fitness: 0 },
        performance.events.length,
        unmappedIndices,
        config,
        []
      );
    }

    // Apply manual assignments as fixed genes
    const fixedGenes = new Map<number, Gene>();
    if (manualAssignments) {
      for (const [indexStr, assignment] of Object.entries(manualAssignments)) {
        const index = parseInt(indexStr, 10);
        const context = eventContexts.find(ctx => ctx.originalIndex === index);
        if (context) {
          const grips = generateValidGripsWithTier([context.pad], assignment.hand);
          const grip = grips.find(g => 
            Object.keys(g.pose.fingers).includes(assignment.finger)
          ) || grips[0];
          
          fixedGenes.set(index, {
            eventIndex: index,
            noteNumber: context.event.noteNumber,
            startTime: context.event.startTime,
            hand: assignment.hand,
            pose: grip.pose,
            finger: assignment.finger,
            position: context.position,
            isFallback: grip.isFallback,
          });
        }
      }
    }

    // Initialize population
    let population = this.initializePopulation(eventContexts, populationSize, rng);

    // Apply fixed genes to all chromosomes
    for (const chromosome of population) {
      for (let i = 0; i < chromosome.genes.length; i++) {
        const fixedGene = fixedGenes.get(chromosome.genes[i].eventIndex);
        if (fixedGene) {
          chromosome.genes[i] = { ...fixedGene };
        }
      }
    }

    // Evaluate initial population
    this.evaluatePopulation(population, config);

    // Evolution log for visualization
    const evolutionLog: EvolutionLogEntry[] = [];

    // Record initial population stats
    const initialFitnesses = population.map(c => c.fitness);
    evolutionLog.push({
      generation: 0,
      bestCost: Math.min(...initialFitnesses),
      averageCost: initialFitnesses.reduce((a, b) => a + b, 0) / initialFitnesses.length,
      worstCost: Math.max(...initialFitnesses),
    });

    // Evolution loop
    for (let gen = 1; gen <= generations; gen++) {
      // Evolve one generation
      population = this.evolveGeneration(population, eventContexts, config, rng);

      // Re-apply fixed genes
      for (const chromosome of population) {
        for (let i = 0; i < chromosome.genes.length; i++) {
          const fixedGene = fixedGenes.get(chromosome.genes[i].eventIndex);
          if (fixedGene) {
            chromosome.genes[i] = { ...fixedGene };
          }
        }
      }

      // Evaluate new population
      this.evaluatePopulation(population, config);

      // Record generation stats
      const fitnesses = population.map(c => c.fitness);
      evolutionLog.push({
        generation: gen,
        bestCost: Math.min(...fitnesses),
        averageCost: fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length,
        worstCost: Math.max(...fitnesses),
      });

      // Yield to event loop periodically to prevent blocking
      if (gen % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Find best chromosome
    population.sort((a, b) => a.fitness - b.fitness);
    const bestChromosome = population[0];

    return this.buildResult(
      bestChromosome,
      performance.events.length,
      unmappedIndices,
      config,
      evolutionLog
    );
  }
}

/**
 * Factory function to create a GeneticSolver instance.
 */
export function createGeneticSolver(
  config: SolverConfig,
  geneticConfig: GeneticConfig = DEFAULT_GENETIC_CONFIG
): GeneticSolver {
  return new GeneticSolver(config, geneticConfig);
}

