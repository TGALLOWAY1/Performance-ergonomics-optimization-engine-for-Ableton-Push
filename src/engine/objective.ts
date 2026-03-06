/**
 * Canonical Objective Function
 *
 * Single scalar objective with real component breakdown.
 * All displayed costs must be computed from these terms.
 */

// ============================================================================
// Types
// ============================================================================

export interface ObjectiveComponents {
  transition: number;
  stretch: number;
  poseAttractor: number;
  perFingerHome: number;
  alternation: number;
  handBalance: number;
  constraints: number;
}

export interface ObjectiveResult {
  valid: boolean;
  total: number;
  components: ObjectiveComponents;
  invalidReason?: string;
}

// ============================================================================
// Factory
// ============================================================================

export function createZeroComponents(): ObjectiveComponents {
  return {
    transition: 0,
    stretch: 0,
    poseAttractor: 0,
    perFingerHome: 0,
    alternation: 0,
    handBalance: 0,
    constraints: 0,
  };
}

// ============================================================================
// Combination
// ============================================================================

/**
 * Combines component values into a single scalar total.
 * Used for objective minimization and display.
 */
export function combineComponents(components: ObjectiveComponents): number {
  return (
    components.transition +
    components.stretch +
    components.poseAttractor +
    components.perFingerHome +
    components.alternation +
    components.handBalance +
    components.constraints
  );
}

// ============================================================================
// Mapping to CostBreakdown (for EngineResult backward compatibility)
// ============================================================================

/**
 * Maps ObjectiveComponents to the legacy CostBreakdown format.
 * movement <- transition, stretch <- stretch, drift <- poseAttractor,
 * bounce <- alternation, fatigue <- perFingerHome, crossover <- constraints.
 * Total is sum of components (must match combineComponents).
 */
export function objectiveToCostBreakdown(components: ObjectiveComponents): {
  movement: number;
  stretch: number;
  drift: number;
  bounce: number;
  fatigue: number;
  crossover: number;
  total: number;
} {
  const total = combineComponents(components);
  return {
    movement: components.transition,
    stretch: components.stretch,
    drift: components.poseAttractor,
    bounce: components.alternation,
    fatigue: components.perFingerHome,
    crossover: components.constraints,
    total,
  };
}
