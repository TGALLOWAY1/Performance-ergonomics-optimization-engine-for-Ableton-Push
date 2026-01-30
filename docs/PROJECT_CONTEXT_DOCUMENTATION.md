# ProjectContext & ProjectState Documentation

## ProjectState Structure

The `ProjectState` interface is the central state container for the entire application. It manages layouts, mappings, engine configurations, and solver results.

### Complete ProjectState Shape

```typescript
ProjectState {
  // Layout Management
  ├── layouts: LayoutSnapshot[]
  │   └── LayoutSnapshot {
  │       ├── id: string
  │       ├── name: string
  │       ├── performance: Performance { events: NoteEvent[], tempo?: number, name?: string }
  │       └── createdAt: string (ISO timestamp)
  │
  ├── activeLayoutId: string | null
  │   └── ID of the currently active layout snapshot
  │
  // Instrument Configuration
  ├── instrumentConfigs: InstrumentConfig[]
  │   └── Array of available instrument configurations
  │
  ├── instrumentConfig: InstrumentConfig
  │   └── Currently active instrument configuration {
  │       ├── id: string
  │       ├── name: string
  │       ├── rows: 8 (fixed for 64-pad mode)
  │       ├── cols: 8 (fixed for 64-pad mode)
  │       ├── bottomLeftNote: number (MIDI note at pad [0,0])
  │       └── layoutMode?: 'drum_64'
  │   }
  │
  ├── sectionMaps: any[]
  │   └── Array of section maps for time-based grid configurations
  │
  ├── projectTempo: number
  │   └── Global project tempo (BPM)
  │
  // Sound Management
  ├── parkedSounds: Voice[]
  │   └── Staging area for sound assets before assignment to grid
  │       └── Voice {
  │           ├── id: string (UUID)
  │           ├── name: string
  │           ├── sourceType: 'midi_track' | 'audio_slice'
  │           ├── sourceFile: string
  │           ├── originalMidiNote: number | null (Cell/MIDI note number)
  │           └── color: string (hex code)
  │       }
  │
  ├── ignoredNoteNumbers?: number[]
  │   └── Array of MIDI note numbers (Cells) to ignore/hide in analysis
  │
  // Grid Mappings
  ├── mappings: GridMapping[]
  │   └── Array of grid mapping configurations {
  │       ├── id: string
  │       ├── name: string
  │       ├── cells: Record<string, Voice>
  │       │   └── Maps pad keys ("row,col") to Voice objects
  │       ├── fingerConstraints: Record<string, string>
  │       │   └── Finger constraints per pad (e.g., "L1", "R5")
  │       ├── scoreCache: number | null
  │       │   └── Cached performability score
  │       ├── notes: string
  │       │   └── Description/notes for this mapping
  │       ├── layoutMode?: 'manual' | 'optimized' | 'random' | 'none'
  │       ├── version?: number
  │       │   └── Version number (incremented on "Save Layout")
  │       └── savedAt?: string (ISO timestamp)
  │   }
  │
  // Manual Finger Assignments
  ├── manualAssignments?: Record<string, Record<string, { hand: 'left' | 'right', finger: FingerType }>>
  │   └── Two-level nested map:
  │       ├── Key 1: layoutId (string)
  │       └── Key 2: eventIndex (stringified number)
  │       └── Value: { hand: 'left' | 'right', finger: FingerType }
  │       └── Purpose: Override automatic finger assignments for specific events
  │
  // Engine Configuration
  ├── engineConfiguration?: EngineConfiguration
  │   └── Biomechanical solver parameters {
  │       ├── beamWidth: number (default: 50)
  │       │   └── Number of top candidates to keep in beam search
  │       ├── stiffness: number (default: 1.0)
  │       │   └── Attractor force strength (0.0-1.0)
  │       └── restingPose: RestingPose {
  │           ├── left: HandPose { centroid: FingerCoordinate, fingers: Partial<Record<FingerType, FingerCoordinate>> }
  │           └── right: HandPose { centroid: FingerCoordinate, fingers: Partial<Record<FingerType, FingerCoordinate>> }
  │       }
  │   }
  │
  // Solver Results
  ├── solverResults?: Record<string, EngineResult>
  │   └── Map of solver results by solver ID {
  │       ├── Keys: solver identifiers ('beam', 'genetic', 'annealing', etc.)
  │       └── Values: EngineResult {
  │           ├── score: number (0-100)
  │           ├── unplayableCount: number
  │           ├── hardCount: number
  │           ├── debugEvents: EngineDebugEvent[]
  │           ├── fingerUsageStats: FingerUsageStats
  │           ├── fatigueMap: FatigueMap
  │           ├── averageDrift: number
  │           └── averageMetrics: CostBreakdown
  │       }
  │   }
  │
  └── activeSolverId?: string
      └── ID of the currently active solver result (determines which result is visualized)
      └── Must correspond to a key in solverResults
}
```

---

## ProjectContext API

The `ProjectContext` provides a React context with the following public API, accessible via the `useProject()` hook.

### State Access

- **`projectState: ProjectState`** - The complete project state object
- **`engineResult: EngineResult | null`** - Currently active engine result (derived from `solverResults[activeSolverId]` or legacy state)

### State Management

- **`setProjectState(state, skipHistory?)`**
  - Updates the project state
  - Accepts either a new state object or a function `(prev: ProjectState) => ProjectState`
  - If `skipHistory` is `true`, the change is not added to undo/redo history
  - Automatically adds to history unless `skipHistory` is true or during undo/redo operations

### Undo/Redo

- **`undo(): void`**
  - Reverts to the previous state in history
  - Moves current state to "future" stack
  - Sets `isUndoingRef` flag to prevent adding undo operation to history

- **`redo(): void`**
  - Advances to the next state in "future" stack
  - Moves current state to "past" stack
  - Sets `isRedoingRef` flag to prevent adding redo operation to history

- **`canUndo: boolean`** - True if there are states in the past stack
- **`canRedo: boolean`** - True if there are states in the future stack

**Undo/Redo Implementation Details:**
- Uses `useProjectHistory` hook with three stacks: `past`, `present`, `future`
- Maximum history size: 50 states
- When a new change is made, the future stack is cleared (standard undo/redo behavior)
- Undo/redo operations use refs to prevent adding themselves to history
- History is cleared when `initialState` changes externally (e.g., on project load)

### Solver Operations

- **`runSolver(solverType, activeMapping?): Promise<void>`**
  - Runs a biomechanical solver (Beam Search, Genetic Algorithm, etc.)
  - Parameters:
    - `solverType: SolverType` - The solver algorithm to run ('beam' | 'genetic' | 'annealing')
    - `activeMapping?: GridMapping | null` - Optional grid mapping (defaults to first mapping)
  - Process:
    1. Gets filtered performance from active layout
    2. Retrieves manual assignments for current layout
    3. Creates solver with instrument config, mapping, and engine configuration
    4. Runs solver (sync for beam, async for genetic)
    5. Stores result in `solverResults[solverType]`
    6. Auto-sets as active if no active solver is set
  - Does NOT overwrite results from different solvers (allows comparison)

- **`setActiveSolverId(solverId: string): void`**
  - Sets which solver result should be visualized
  - Validates that the solver ID exists in `solverResults`
  - Updates `activeSolverId` in project state

- **`getSolverResult(solverId: string): EngineResult | null`**
  - Retrieves a specific solver result by ID
  - Returns `null` if not found

- **`optimizeLayout(activeMapping?): Promise<void>`**
  - Optimizes the layout using Simulated Annealing
  - Rearranges pad assignments to minimize ergonomic cost
  - Parameters:
    - `activeMapping?: GridMapping | null` - The mapping to optimize (defaults to first mapping)
  - Process:
    1. Gets filtered performance
    2. Creates AnnealingSolver
    3. Runs optimization
    4. Updates the mapping in project state (preserves ID, name, notes)
    5. Sets `layoutMode` to 'optimized'
    6. Increments version number
    7. Stores result in `solverResults['annealing']`
    8. Auto-sets as active if no active solver is set

- **`setInitialStateFromNeutralPose(activeMapping?): Promise<void>`**
  - Sets initial finger assignments using a greedy heuristic seeded from neutral hand pose
  - Creates a reasonable starting point for solvers instead of random initialization
  - Parameters:
    - `activeMapping?: GridMapping | null` - The mapping to use (defaults to first mapping)
  - Process:
    1. Gets filtered performance
    2. Builds greedy initial assignment using neutral pose
    3. Updates `manualAssignments[currentLayoutId]` with assignments
    4. Optionally re-runs beam solver to compute costs for visualization

### Legacy API (Deprecated)

- **`setEngineResult(result: EngineResult | null): void`**
  - **@deprecated** Use `runSolver()` instead
  - Directly sets the legacy engine result state
  - Does NOT store in `solverResults` map
  - Kept for backwards compatibility

---

## How State Changes Trigger Engine Runs

### Automatic Solver Execution

The engine does **NOT** automatically run when state changes. Solvers must be explicitly invoked via:

1. **`runSolver()`** - User-initiated solver run (e.g., clicking "Run Solver" button)
2. **`optimizeLayout()`** - Layout optimization automatically runs annealing solver and stores result
3. **`setInitialStateFromNeutralPose()`** - Optionally re-runs beam solver after setting assignments

### State Dependencies for Solver Runs

When a solver runs, it reads the following from `projectState`:

1. **Performance Data:**
   - `layouts[activeLayoutId].performance` - Source performance events
   - Filtered through `getActivePerformance()` which:
     - Filters out events with `noteNumber` in `ignoredNoteNumbers`
     - Returns `null` if no active layout

2. **Grid Mapping:**
   - Uses provided `activeMapping` parameter, or
   - Falls back to `mappings[0]` (first mapping)

3. **Manual Assignments:**
   - Reads `manualAssignments[currentLayoutId]`
   - Converts string keys to numbers for engine
   - Passes to solver as constraints

4. **Engine Configuration:**
   - Uses `engineConfiguration` or `DEFAULT_ENGINE_CONFIGURATION`
   - Includes beam width, stiffness, and resting pose

5. **Instrument Config:**
   - Uses `instrumentConfig` for Voice-to-Pad mapping

### State Updates After Solver Runs

When a solver completes:

1. **Result Storage:**
   - Result is stored in `solverResults[solverType]`
   - Does NOT overwrite results from other solvers
   - Allows comparing multiple solver results

2. **Active Solver Selection:**
   - If `activeSolverId` is unset, the new solver is auto-set as active
   - Otherwise, existing active solver remains active

3. **History Tracking:**
   - State update is added to undo/redo history (unless `skipHistory` is true)
   - Undo/redo operations restore the entire `ProjectState`, including `solverResults`

### Undo/Redo and Engine Results

**Important:** When undoing/redoing, the entire `ProjectState` is restored, including:
- `solverResults` map (all solver results)
- `activeSolverId` (which result is visualized)
- `manualAssignments` (finger assignment overrides)
- `mappings` (grid configurations)
- `engineConfiguration` (solver parameters)

**However:** Undo/redo does **NOT** re-run solvers. The stored `EngineResult` objects are restored as-is. If you undo to a state where a solver hasn't been run yet, `engineResult` will be `null` or point to a different solver's result.

**Best Practice:** After undo/redo, if you need fresh solver results, explicitly call `runSolver()` again.

---

## Summary

The `ProjectContext` manages a comprehensive `ProjectState` that includes layouts, mappings, engine configurations, and solver results. State changes are tracked in an undo/redo history system, but solvers are **not** automatically re-run when state changes. Solvers must be explicitly invoked, and their results are stored in a map that allows comparing multiple solver algorithms simultaneously.

