# Ableton Push 3 Performability Tool — Architecture Diagram

High-level architecture: layers, data flow, and main modules.

## System overview

```mermaid
flowchart TB
  subgraph UI["UI Layer"]
    Pages["Pages\n(Dashboard, Workbench, Timeline,\nEvent Analysis, Cost Debug)"]
    Workbench["Workbench\n(LayoutDesigner, GridEditor,\nAnalysisPanel, Timeline)"]
    Components["Components\n(GridVisContainer, PadLayer,\nOnionSkinGrid, ThemeToggle)"]
  end

  subgraph Context["State & Context"]
    ProjectContext["ProjectContext\n(projectState, runSolver,\nengineResult, undo/redo)"]
    ThemeContext["ThemeContext"]
  end

  subgraph Engine["Engine (Pure Logic)"]
    Core["core.ts\nBiomechanicalSolver facade"]
    Solvers["Solvers\n(Beam, Genetic, Annealing)"]
    GridMath["gridMath\nDistance, position"]
    Cost["costFunction\nMovement, stretch, drift"]
    Feasibility["feasibility\nReach, grip, chord"]
    HandPose["handPose\nNeutral positions"]
  end

  subgraph Data["Types & Data"]
    Types["types/\nprojectState, performance,\nlayout, eventAnalysis"]
    Utils["utils/\nperformanceSelectors,\nprojectPersistence, midiImport"]
  end

  subgraph Services["Services & Hooks"]
    SongService["SongService"]
    Hooks["hooks\n(useProjectHistory,\nuseSongStateHydration)"]
  end

  Pages --> ProjectContext
  Workbench --> ProjectContext
  Workbench --> Engine
  Components --> Types
  ProjectContext --> Engine
  ProjectContext --> Types
  ProjectContext --> Utils
  Core --> Solvers
  Core --> Types
  Solvers --> GridMath
  Solvers --> Cost
  Solvers --> Feasibility
  Solvers --> HandPose
  SongService --> Types
  Hooks --> ProjectContext
```

## Layer responsibilities

| Layer | Responsibility |
|-------|----------------|
| **UI** | React pages and workbench; layout designer, grid editor, timeline, analysis panels. No engine logic. |
| **Context** | Single source of truth: `ProjectState`, solver orchestration (`runSolver`), `engineResult`, history (undo/redo). |
| **Engine** | Pure logic: solver facade, beam/genetic/annealing strategies, grid math, cost model, feasibility, hand pose. No UI. |
| **Types** | Shared interfaces: `ProjectState`, `Performance`, `GridMapping`, `EngineResult`, etc. |
| **Utils** | Selectors, persistence, MIDI import/export, formatting. |
| **Services/Hooks** | Song portfolio, project history, state hydration. |

## Data flow (solver run)

```mermaid
sequenceDiagram
  participant UI as Workbench / UI
  participant Ctx as ProjectContext
  participant Core as BiomechanicalSolver
  participant Solver as Beam/Genetic/Annealing
  participant Types as types/

  UI->>Ctx: runSolver(solverType, activeMapping)
  Ctx->>Ctx: get active Performance from projectState
  Ctx->>Core: solver.solve(performance, config)
  Core->>Solver: strategy.solve(...)
  Solver->>Types: reads GridMapping, InstrumentConfig
  Solver-->>Core: EngineResult (assignments, cost, debugEvents)
  Core-->>Ctx: EngineResult
  Ctx->>Ctx: solverResults[solverId] = result
  Ctx->>Ctx: setActiveSolverId(solverId)
  Ctx-->>UI: engineResult updated → re-render grid/timeline
```

## Module dependency (simplified)

```mermaid
flowchart LR
  subgraph NoUI["No UI imports"]
    T["types/"]
    E["engine/"]
    U["utils/"]
  end

  subgraph UI["May import engine/types/utils"]
    W["workbench/"]
    P["pages/"]
    C["components/"]
  end

  subgraph App["App shell"]
    CX["context/"]
    Main["main.tsx"]
  end

  E --> T
  U --> T
  W --> E
  W --> T
  W --> U
  P --> W
  P --> T
  C --> T
  CX --> E
  CX --> T
  CX --> U
  Main --> CX
  Main --> P
```

## Engine internals (solver strategy)

```mermaid
flowchart TB
  subgraph Facade["core.ts (Facade)"]
    BiomechanicalSolver["BiomechanicalSolver"]
    resolveSolver["resolveSolver(type, config)"]
  end

  subgraph Strategies["Pluggable solvers"]
    Beam["BeamSolver"]
    Genetic["GeneticSolver"]
    Annealing["AnnealingSolver"]
  end

  subgraph Shared["Shared engine modules"]
    gridMath["gridMath"]
    costFunction["costFunction"]
    feasibility["feasibility"]
    handPose["handPose"]
    models["models (FingerType, HandState)"]
  end

  BiomechanicalSolver --> resolveSolver
  resolveSolver --> Beam
  resolveSolver --> Genetic
  resolveSolver --> Annealing
  Beam --> gridMath
  Beam --> costFunction
  Beam --> feasibility
  Beam --> handPose
  Beam --> models
  Genetic --> gridMath
  Genetic --> costFunction
  Annealing --> costFunction
```

## File layout (key areas)

```
src/
├── main.tsx              # Router, ThemeProvider, ProjectProvider
├── context/              # ProjectContext, ThemeContext
├── types/                # projectState, performance, layout, eventAnalysis, …
├── engine/               # core, solvers/, gridMath, costFunction, feasibility, handPose
├── workbench/            # Workbench, LayoutDesigner, GridEditor, AnalysisPanel, Timeline
├── pages/                # Dashboard, TimelinePage, EventAnalysisPage, CostDebugPage
├── components/           # ui/, grid-v3/, vis/, dashboard/
├── utils/                # performanceSelectors, projectPersistence, midiImport, …
├── services/             # SongService
└── hooks/                # useProjectHistory, useSongStateHydration, usePracticeLoop
```

---

*See [ARCHITECTURE.md](./ARCHITECTURE.md) for domain concepts, grid constraints, and workflow details.*
