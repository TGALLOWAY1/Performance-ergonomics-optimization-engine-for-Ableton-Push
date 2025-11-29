# Simulated Annealing Solver Implementation

**Date:** 2025-01-02
**Branch:** 36-implement-simulated-annealing-algorithm

## Summary

Implemented a complete Simulated Annealing optimization solver for automatically rearranging pad layouts to minimize ergonomic cost. The solver uses a mutation-based approach to explore the solution space, gradually cooling to find optimal Voice-to-Pad assignments. Includes full UI integration and visualization of the optimization process.

## Key Changes

### Phase 1: Mutation Logic (`src/engine/solvers/mutationService.ts`)

Created the mutation service that physically moves sounds around the grid:

**Functions:**
- `getEmptyPads(mapping: GridMapping): PadCoord[]` - Returns all unoccupied pad coordinates
- `applyRandomMutation(mapping: GridMapping): GridMapping` - Randomly mutates a mapping using:
  - **Swap Operation** (50% chance): Swaps two occupied pads' Voices
  - **Move Operation** (50% chance): Moves a Voice from an occupied pad to an empty pad

**Features:**
- Immutable state (returns new GridMapping objects)
- Preserves all Voice properties during mutations
- Preserves finger constraints when moving/swapping
- Invalidates score cache after mutation

### Phase 2: Annealing Solver (`src/engine/solvers/AnnealingSolver.ts`)

Implemented the core Simulated Annealing algorithm:

**Configuration:**
- `INITIAL_TEMP`: 500
- `COOLING_RATE`: 0.99
- `ITERATIONS`: 1000
- `FAST_BEAM_WIDTH`: 2 (for fast evaluation during annealing)
- `FINAL_BEAM_WIDTH`: 50 (for high-quality final result)

**Algorithm Flow:**
1. Starts with current GridMapping
2. Evaluates initial cost using fast Beam Search (beamWidth=2)
3. Main loop (1000 iterations):
   - Mutates mapping using `applyRandomMutation`
   - Evaluates candidate cost with fast Beam Search
   - Metropolis acceptance criterion:
     - Accepts better solutions immediately
     - Probabilistically accepts worse solutions: `Math.exp(-delta / temp)`
   - Tracks best mapping found
   - Records telemetry (step, temp, cost, accepted)
   - Cools temperature: `temp *= COOLING_RATE`
   - Yields every 50 iterations to prevent UI freezing
4. Final step: Runs high-quality Beam Search (beamWidth=50) on best mapping

**Features:**
- Async-only solver (prevents blocking)
- Exposes `getBestMapping()` method to retrieve optimized layout
- Stores full telemetry in `optimizationLog` for visualization

### Phase 3: UI Integration

**ProjectContext Updates (`src/context/ProjectContext.tsx`):**
- Added `optimizeLayout()` method that:
  - Instantiates AnnealingSolver
  - Runs optimization
  - Updates project state with optimized mapping
  - Preserves mapping ID, name, and notes
  - Sets `layoutMode` to `'optimized'`
  - Increments version number
  - Stores result in `solverResults` map
  - Wrapped in history for undo/redo support

**Workbench Updates (`src/workbench/Workbench.tsx`):**
- Added "Auto-Arrange Grid" button in toolbar
- Shows "Optimizing Layout (Annealing)..." loading state
- Disabled during optimization or when no mapping/performance data exists
- Updated solver result selector to display "Simulated Annealing" correctly

### Phase 4: Visualization (`src/workbench/AnalysisPanel.tsx`)

Added comprehensive visualization of the optimization process:

**New Tab: "Optimization Process"**
- Dual Y-axis chart:
  - **Left Y-axis**: Cost (green line) - shows noisy exploration at high temp, smooths as it converges
  - **Right Y-axis**: Temperature (red line/area) - shows smooth decay curve
- Data points colored by acceptance (green = accepted, gray = rejected)
- Tooltip explanation: "The algorithm initially explores random layouts (High Temp) and eventually settles on the most ergonomic configuration."

**Optimization Statistics Cards:**
- Initial Cost
- Final Cost
- Improvement percentage
- Acceptance Rate

**Features:**
- Empty state message when no optimization data available
- Responsive SVG visualization matching existing `EvolutionGraph` style
- Sampled data points to avoid overcrowding (shows every Nth point for large datasets)

## Type System Updates

**`src/engine/solvers/types.ts`:**
- Added `'annealing'` to `SolverType` union
- Added `optimizationLog` field to `EngineResult` interface:
  ```typescript
  optimizationLog?: Array<{ step: number; temp: number; cost: number; accepted: boolean }>;
  ```

**`src/engine/solvers/AnnealingSolver.ts`:**
- Exported `AnnealingTelemetry` interface for type safety

## Integration Points

**`src/engine/core.ts`:**
- Added `createAnnealingSolver` import
- Updated `resolveSolver()` to handle `'annealing'` type
- Updated `getAvailableSolverTypes()` to include `'annealing'`

**`src/engine/solvers/index.ts`:**
- Exported `AnnealingSolver`, `createAnnealingSolver`, and `AnnealingTelemetry`

## Files Created

| File | Purpose |
|------|---------|
| `src/engine/solvers/mutationService.ts` | Mutation logic for moving/swapping Voices on grid |
| `src/engine/solvers/AnnealingSolver.ts` | Simulated Annealing solver implementation |

## Files Modified

| File | Changes |
|------|---------|
| `src/engine/solvers/types.ts` | Added `optimizationLog` to `EngineResult`, added `'annealing'` to `SolverType` |
| `src/engine/solvers/index.ts` | Exported AnnealingSolver components |
| `src/engine/core.ts` | Integrated AnnealingSolver into solver factory |
| `src/context/ProjectContext.tsx` | Added `optimizeLayout()` method |
| `src/workbench/Workbench.tsx` | Added "Auto-Arrange Grid" button and loading state |
| `src/workbench/AnalysisPanel.tsx` | Added "Optimization Process" tab with visualization |

## Algorithm Details

### Acceptance Probability (Metropolis Criterion)

```typescript
delta = candidateCost - currentCost;

if (delta < 0) {
  // Better solution: accept immediately
  accepted = true;
} else if (delta > 0) {
  // Worse solution: accept probabilistically
  acceptanceProbability = Math.exp(-delta / currentTemp);
  accepted = Math.random() < acceptanceProbability;
}
```

### Performance Optimizations

1. **Fast Evaluation**: Uses `beamWidth=2` during annealing loop for speed
2. **High-Quality Final**: Uses `beamWidth=50` for final result accuracy
3. **UI Responsiveness**: Yields every 50 iterations with `await new Promise(resolve => setTimeout(resolve, 0))`

## Testing Verification

✅ Mutation service correctly swaps and moves Voices
✅ Annealing solver finds better layouts over iterations
✅ UI button triggers optimization and shows loading state
✅ Optimized mapping replaces current mapping in project state
✅ Visualization displays cost and temperature curves correctly
✅ Statistics cards show accurate improvement metrics
✅ Empty state displays when no optimization data available
✅ Solver result selector includes "Simulated Annealing" option

## User Experience

**Workflow:**
1. User assigns some sounds to grid manually or via "Assign Manually"
2. User clicks "Auto-Arrange Grid" button
3. Solver runs (2-3 seconds with loading indicator)
4. Grid automatically updates with optimized layout
5. User can view optimization process in "Optimization Process" tab
6. Layout is marked as `layoutMode: 'optimized'` and version incremented

**Visual Feedback:**
- Loading state: "Optimizing Layout (Annealing)..."
- Graph shows cost decreasing and temperature cooling
- Statistics show improvement percentage
- Layout updates automatically when optimization completes

## Technical Notes

- The solver requires an initial GridMapping (cannot optimize empty layout)
- All mutations preserve Voice immutability
- Best mapping is tracked throughout the process, not just at the end
- Telemetry is stored for visualization but doesn't affect optimization logic
- The solver is async-only to prevent blocking the UI during the 1000-iteration loop

