# 06 - Redundancy and Cleanup Opportunities

- Audit timestamp: 2026-03-02T22:03:02-0500
- Repo branch: codex/audit/deep-codebase-review
- Audit scope: Duplicate logic/types/components, overlapping responsibilities, naming drift, and refactor candidates with risk/benefit.
- Commands run:
  - `rg -n "new BiomechanicalSolver\(|manualAssignments|setEngineResult\(|saveProject\(|loadProject\(|handleLoadProject|handleMapToQuadrants|handleAutoAssignRandom" src`
  - `rg -n "AnalysisView|ImportWizard|GridArea|Sidebar|EngineResultsPanel|TimelineArea" src`
  - `rg -n "interface FingerState|type Hand|formatFinger|normalizeHand" src`

## Duplicate logic inventory

| Duplicate concern | Reference A | Reference B | Observation | Consolidation direction |
|---|---|---|---|---|
| Solver execution orchestration | `src/context/ProjectContext.tsx:runSolver/optimizeLayout` | `src/workbench/Workbench.tsx` reactive loop and `src/pages/EventAnalysisPage.tsx` effect | Three distinct solver invocation paths with different result sinks (solverResults vs legacy engineResult) | Centralize solver execution in context service with explicit modes (`live`, `snapshot`) |
| Manual assignment parsing (`string->number`) | `src/context/ProjectContext.tsx:runSolver` | `src/workbench/Workbench.tsx` and `src/pages/EventAnalysisPage.tsx` | Same conversion block repeated | Extract helper (e.g., `parseManualAssignments(layoutId, state)`) |
| Save/load JSON project logic | `src/workbench/Workbench.tsx:handleSaveProject/handleLoadProject` | `src/utils/projectPersistence.ts:saveProject/loadProject` | Two project import/export implementations with diverging validation | Keep one canonical import/export module and use it in Workbench |
| Auto-layout random/quadrants | `src/workbench/Workbench.tsx` | `src/workbench/LayoutDesigner.tsx` | Similar randomization and quadrant mapping logic exists in both components | Move to shared service and expose through one orchestrator |
| Song-state hydration logic | `src/workbench/Workbench.tsx` | `src/pages/TimelinePage.tsx`, `src/pages/EventAnalysisPage.tsx` | Near-duplicate load-on-route-entry heuristics | Shared hook: `useSongStateHydration(songId)` |
| Assignment visualization computation | `src/workbench/LayoutDesigner.tsx:fingerAssignmentMap` | `src/pages/TimelinePage.tsx:fingerAssignments` | Parallel index-based derivations from engine debug events | Use one stable event-index mapping utility |

## Duplicate / overlapping type definitions

| Type duplication | References | Observation | Risk |
|---|---|---|---|
| `FingerState` appears in multiple models | `src/engine/models.ts:FingerState` and `src/types/engine.ts:FingerState` | Semantically similar but structurally different fields (`currentGridPos/fatigueLevel` vs `pos/fatigue`) | Mapping mistakes and adapter boilerplate |
| Hand notation variants | `'left'/'right'`, `'LH'/'RH'`, `'L'/'R'` across engine/UI | Multiple normalization helpers (`normalizeHandString`, `normalizeHand`) | Subtle conditional bugs and formatting inconsistencies |
| Initial project state creation | `src/context/ProjectContext.tsx:INITIAL_PROJECT_STATE` and `src/types/projectState.ts:createInitialProjectState` | Duplicate initialization sources can drift over time | Inconsistent defaults on new flows |

## Components with overlapping responsibility

| Component(s) | Overlap | Observation | Cleanup opportunity |
|---|---|---|---|
| `Workbench` + `LayoutDesigner` | Layout mutation controls and orchestration | Both hold assignment/randomize/quadrant behavior hooks | Keep mutation orchestration in Workbench and keep LayoutDesigner presentational+DnD |
| `AnalysisPanel` + `EventAnalysisPage/EventAnalysisPanel` | Analysis visualization surfaces | Summary/compare/process split across two different paths | Define one “summary in Workbench, deep dive in EventAnalysis” contract |
| Dead legacy stack (`AnalysisView` ecosystem) vs current Workbench route | Competing architecture | Unrouted but substantial feature stack still present | Archive or remove legacy stack to reduce maintenance load |

## Utility consolidation candidates

| Utility / function | Current state | Recommendation |
|---|---|---|
| `projectPersistence` save/load APIs | Duplicated with Workbench inline handlers | Make Workbench call utility functions directly |
| `midiImport` legacy wrappers (`parseMidiFile`, `fetchAndParseMidiFile`) | Used mainly by dead stack | Remove or mark internal/test-only |
| Hand/finger formatting helpers | Split between util and local component helpers | Consolidate in one formatting module used by active routes |

## Naming inconsistencies

| Inconsistency | Example references | Recommendation |
|---|---|---|
| Voice vs Sound vs Asset | `VoiceLibrary` props still named `sound`; comments alternate terms | Standardize UI/API naming to `voice` where domain object is pitch-voice |
| Layout vs Mapping | `LayoutSnapshot` (performance container) and `GridMapping` (pad assignment) frequently mixed in UX copy | Use explicit labels in UI: `Performance Layout` vs `Pad Mapping` |
| Hand labels | `left/right` vs `LH/RH` vs `L/R` | Normalize at boundary and keep one internal representation |
| Section terminology in Workbench header | Title says “Section Layout Optimizer” while flow is song/mapping centric | Align route/page labels with actual model entities |

## Suggested refactors (small-to-medium scope)

| Refactor | Files/modules | Benefit | Risk |
|---|---|---|---|
| Introduce `analysisExecutionService` in context | `ProjectContext`, `Workbench`, `EventAnalysisPage` | Removes triple-path solver duplication and stale result bugs | Medium (touches core analysis path) |
| Replace per-page hydration with shared hook | `Workbench`, `TimelinePage`, `EventAnalysisPage`, `SongService` | Consistent route-entry behavior and lower code drift | Medium |
| Canonical import/export API | `projectPersistence`, `Workbench` | Single validation/migration path for project files | Low |
| Remove or archive dead legacy AnalysisView stack | `src/workbench/AnalysisView*.tsx` chain | Lower maintenance and cognitive overhead | Medium (if hidden dependencies exist) |
| Normalize assignment identity to stable event ID | `EventLogTable`, assignment handlers, selectors | Fixes override drift and incorrect edits | Medium-High |
| Move random/quadrant mapping operations to shared service | `Workbench`, `LayoutDesigner`, `autoLayout` | Eliminates duplicated mutation logic | Low-Medium |

