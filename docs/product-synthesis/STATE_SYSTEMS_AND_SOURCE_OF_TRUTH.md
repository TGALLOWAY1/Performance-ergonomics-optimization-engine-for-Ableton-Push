# State Systems and Source of Truth

## Executive Summary

The app is closest to a single-source-of-truth model when viewed through `ProjectContext.projectState`, but several important product behaviors depend on layered state:

- global domain state in `ProjectState`
- route hydration logic
- derived filtered performance
- persisted per-song localStorage state
- per-page view state
- engine-computed solver outputs

The current architecture is much closer to a coherent product-facing state model than some older repo docs suggest, but there are still a few ownership ambiguities.

## State Container Inventory

| State system | What it owns | Source of truth? | Persistence | Primary evidence |
|---|---|---|---|---|
| `ProjectContext.projectState` | main project domain state | yes, primary | song-local localStorage plus optional JSON import/export | `src/context/ProjectContext.tsx` |
| `useProjectHistory` | undo/redo wrapper around `ProjectState` | yes for in-session mutation history | in-memory only | `src/hooks/useProjectHistory.ts` |
| `ProjectContext.engineResult` | currently selected result to visualize | derived source, not canonical itself | indirectly via `solverResults` in `ProjectState` | `src/context/ProjectContext.tsx` |
| `ProjectState.solverResults` | stored per-solver analysis outputs | yes for analysis-result persistence | saved with project state | `src/types/projectState.ts`, `src/context/ProjectContext.tsx` |
| `SongService` localStorage map | song catalog and metadata | yes for portfolio layer | localStorage | `src/services/SongService.ts` |
| `push_perf_project_<id>` localStorage entries | persisted project states by song | yes for per-song persisted work | localStorage | `src/services/SongService.ts`, `src/utils/projectPersistence.ts` |
| `ThemeContext` | current theme | yes for theme | localStorage | `src/context/ThemeContext.tsx` |
| Per-page local UI state | zoom, selected event, menu toggles, progress, edit mode | no, transient | no | page and component files |

## Primary Product Source of Truth: `ProjectState`

### What it contains

`ProjectState` is the main product-facing state object. It currently aggregates:

- imported musical material:
  - `layouts`
  - `instrumentConfigs`
  - `instrumentConfig`
- editable layout material:
  - `mappings`
  - `activeLayoutId`
  - `activeMappingId`
  - `parkedSounds`
- filtering and overrides:
  - `ignoredNoteNumbers`
  - `manualAssignments`
- solver configuration and outputs:
  - `engineConfiguration`
  - `solverResults`
  - `activeSolverId`
- personalization:
  - `naturalHandPoses`
- legacy or dormant structure:
  - `sectionMaps`

Primary evidence:

- `src/types/projectState.ts`
- `src/context/ProjectContext.tsx`

### Why it is the effective source of truth

- Workbench edits write into it.
- Route hydration loads it.
- Timeline and Event Analysis read from it.
- Project export/import serializes it.
- Solver outputs are stored back into it.

## Secondary Durable Source of Truth: `Song` Catalog

The song layer is separate from `ProjectState`.

### What it owns

- portfolio metadata
- pointer to `projectStateId`
- embedded MIDI payload
- original MIDI filename

### Why it matters product-wise

- It defines the user's library and entry points.
- It gives the app a "song portfolio" product shell.
- It is not the actual editing source of truth for mappings or analysis.

Evidence:

- `src/types/song.ts`
- `src/services/SongService.ts`

## Derived State Systems

### Active engine result

- `ProjectContext.engineResult` is derived from:
  - `projectState.solverResults[projectState.activeSolverId]`
- This means the user-facing analysis surface depends on both stored results and which solver is selected.

Evidence:

- `src/context/ProjectContext.tsx`

### Active performance

- `getActivePerformance(projectState)` derives a filtered `Performance` based on `ignoredNoteNumbers`.
- `getRawActivePerformance(projectState)` returns the unfiltered version.

Evidence:

- `src/utils/performanceSelectors.ts`

### Workbench finger-assignment color map

- `LayoutDesigner` derives `fingerAssignmentMap` from:
  - `engineResult.debugEvents`
  - `manualAssignments`
  - filtered performance

Evidence:

- `src/workbench/LayoutDesigner.tsx`

### Timeline finger labels

- `TimelinePage` derives `fingerAssignments` from:
  - `engineResult.debugEvents`
  - active layout performance
  - voices found in the active mapping

Evidence:

- `src/pages/TimelinePage.tsx`

### Event-analysis models

- Event Analysis derives:
  - `AnalyzedEvent[]`
  - `Transition[]`
  - `OnionSkinModel`
from current `engineResult` and `performance`.

Evidence:

- `src/workbench/EventAnalysisPanel.tsx`
- `src/engine/eventMetrics.ts`
- `src/engine/transitionAnalyzer.ts`
- `src/engine/onionSkinBuilder.ts`

## Persisted State

### Portfolio persistence

- Key: `push_perf_songs`
- Contains:
  - `Song` objects by ID

### Per-song workbench persistence

- Key format: `push_perf_project_<projectStateId>`
- Contains:
  - full `ProjectState`

### Theme persistence

- Key: `push_perf_theme`
- Contains:
  - `dark` or `light`

### Project file persistence

- Portable JSON export/import of `ProjectState`

Evidence:

- `src/services/SongService.ts`
- `src/utils/projectPersistence.ts`
- `src/context/ThemeContext.tsx`

## Imported / Exported State

| Import / export path | What enters or leaves the system | Canonical object touched |
|---|---|---|
| MIDI link to existing song | MIDI file in, derived `ProjectState` + metadata out | `Song`, `ProjectState` |
| hidden direct MIDI import service path | MIDI file in, new `Song` + `ProjectState` out | `Song`, `ProjectState` |
| Project JSON export/import | full project state in/out | `ProjectState` |
| Event-analysis exports | analysis artifacts out only | derived event-analysis models |

## Local State Patterns

### Workbench local state

Primarily visual or interaction state:

- settings menu open/closed
- show note labels
- show position labels
- show finger assignment overlay
- selected solver
- advanced mode toggle
- solver progress
- optimization loading state
- song-local current ID ref handling

Evidence:

- `src/workbench/Workbench.tsx`

### LayoutDesigner local state

- selected sound or cell
- drag state
- left-tab choice
- pose edit mode
- active pose finger
- preview offset
- context menu state
- reachability visualization state

Evidence:

- `src/workbench/LayoutDesigner.tsx`

### Timeline local state

- `currentTime`
- `zoom`

Evidence:

- `src/pages/TimelinePage.tsx`

### Event Analysis local state

- left-panel tab
- selected event index
- practice-loop internal play state and interval refs

Evidence:

- `src/workbench/EventAnalysisPanel.tsx`
- `src/hooks/usePracticeLoop.ts`

## Duplicated or Mirrored State

### `engineResult` vs `solverResults`

Current code truth:

- the canonical stored analysis results are `ProjectState.solverResults`
- `engineResult` is a derived convenience selector

Remaining confusion:

- older docs and audits still describe an older dual-source model
- `ProjectContext` still exposes a deprecated no-op `setEngineResult` for compatibility

Evidence:

- `src/context/ProjectContext.tsx`
- stale contrast in `docs/PROJECT_OVERVIEW.md`, `docs/audit/02_state_and_dataflow.md`

### Filtered performance vs raw performance

- Filtered performance is used for analysis.
- Raw performance is still used in some display or library contexts.

Why this matters:

- the user can hide voices without deleting them
- some visualizations may diverge if they assume different source performance

Evidence:

- `src/utils/performanceSelectors.ts`
- `src/workbench/VoiceLibrary.tsx`
- `src/pages/TimelinePage.tsx`

### Voice metadata across staging and mapping cells

- Renaming/recoloring a voice updates:
  - `parkedSounds`
  - any matching mapped `Voice` instances in `GridMapping.cells`

This is a synchronization pattern, not a purely normalized reference model.

Evidence:

- `src/workbench/Workbench.tsx:handleUpdateSound`
- `src/workbench/Workbench.tsx:handleUpdateMappingSound`

## State Ownership Confusion Points

| Confusion point | Why it is confusing | Evidence |
|---|---|---|
| `layouts` vs `mappings` | One owns the performance, the other owns the placement, but product copy often just says "layout" for both | `src/types/projectState.ts`, `src/types/layout.ts`, Workbench copy |
| `sectionMaps` presence | It lives in primary state but has little active UX behavior | `src/types/projectState.ts` |
| `setInitialStateFromNeutralPose` mapping resolution | This context helper still falls back to the first mapping, unlike the stricter active-mapping model elsewhere | `src/context/ProjectContext.tsx` |
| Event identity fallback | Manual assignments are intended to use `eventKey`, but some flows still fallback to stringified indices | `src/types/projectState.ts`, `src/workbench/EventLogTable.tsx` |

## Likely Product-Facing Source-of-Truth Summary

If a product designer or systems analyst needs the shortest true statement:

1. `Song` is the portfolio container.
2. `ProjectState` is the actual workbench source of truth.
3. `Performance` plus `GridMapping` plus `NaturalHandPose` are the core domain inputs.
4. `solverResults` is the durable analysis-result store.
5. Most other important states are either:
   - derived views of those objects, or
   - local UI state for a given screen.

## Implications for Future Product Artifacts

- A product spec should explicitly separate:
  - portfolio state
  - musical input state
  - mapping state
  - personalization state
  - analysis-result state
- Any future UX architecture should make it obvious which object is being edited at each step.
- Acceptance criteria should include cross-route consistency for `activeMappingId`, hidden-note filtering, and selected solver result.

