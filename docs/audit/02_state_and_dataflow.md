# 02 - State and Dataflow Analysis

- Audit timestamp: 2026-03-02T22:03:02-0500
- Repo branch: codex/audit/deep-codebase-review
- Audit scope: State ownership, dataflow paths, source-of-truth consistency, and probable bug vectors from state transitions.
- Commands run:
  - `rg -n --glob '!node_modules/**' --glob '!dist/**' "TODO|FIXME|deprecated|legacy|mock|seed|export|import|undo|redo|manual|ignored|solver|engineResult|mapping|layout" src docs README.md TODO.md`
  - `npm run`
  - `npm test`
  - `npm run typecheck`
  - `npm run build -- --outDir /tmp/push-performance-audit-dist`
  - `npm run dev -- --host 127.0.0.1 --port 4173`
  - Browser route sweep: `/`, `/workbench`, `/event-analysis`, `/timeline`

## Dataflow diagram (text)

1. MIDI file selected in Dashboard (`SongCard` -> `Dashboard.handleMidiLinked`).
2. `SongService.linkMidiToSong()` parses MIDI (`parseMidiFileToProject`) and persists:
   - song metadata + midi payload under `push_perf_songs`
   - full `ProjectState` under `push_perf_project_<projectStateId>`.
3. Routed pages (`Workbench`, `TimelinePage`, `EventAnalysisPage`) optionally load saved `ProjectState` via `songService.loadSongState(songId)`.
4. `ProjectContext` exposes `projectState`, undo/redo, solver APIs, and `engineResult` view state.
5. Workbench and EventAnalysis both run solver logic (manual trigger and/or reactive effects) and update either:
   - `solverResults` map + `activeSolverId` (context path), or
   - `legacyEngineResult` through `setEngineResult` (legacy path).
6. Render surfaces consume mixed state:
   - Grid + heatmap: `LayoutDesigner` from `activeMapping` and `engineResult`
   - Analysis panel: `AnalysisPanel` reads `engineResult` and `getSolverResult(...)`
   - Timeline and EventAnalysis pages derive from `projectState`, `engineResult`, and local playback/UI state.

## State container inventory

| Container | Ownership | Primary writes | Primary reads | Notes |
|---|---|---|---|---|
| `ProjectContext.projectState` | Global app state | `setProjectState`, `runSolver`, `optimizeLayout`, page load effects | Workbench/pages/components | Canonical domain state, but mixed with local per-page IDs and legacy result path |
| `useProjectHistory` internals (`past/present/future`) | Undo/redo layer | `setProjectState`, `undo`, `redo` | Workbench undo/redo and all consumers of context state | History tracks every state write unless `skipHistory=true` |
| `legacyEngineResult` in `ProjectContext` | Back-compat analysis result | `setEngineResult` from Workbench/EventAnalysis effects | `engineResult` getter fallback | Can diverge from `solverResults` model |
| `projectState.solverResults` + `activeSolverId` | Solver result model | `runSolver`, `optimizeLayout` | `ProjectContext.engineResult`, `AnalysisPanel`, Workbench result selector | Intended canonical solver output model |
| `Workbench.activeMappingId` (local state) | Local mapping selection | mapping-change effect, project load effect | `activeMapping` memo and downstream children | Not stored in `ProjectState`; cross-page inconsistency risk |
| `TimelinePage` local playback (`isPlaying`, `currentTime`, `zoom`) | Page-local visualization controls | Page controls and RAF loop | `Timeline` component | No persistence |
| `ThemeContext.theme` | UI theme state | `toggleTheme` | ThemeToggle + CSS class | Not persisted across reload |
| LocalStorage `push_perf_songs` | Song catalog persistence | `SongService` CRUD/link | Dashboard | Flat map by song id |
| LocalStorage `push_perf_project_<id>` | Per-song workbench state persistence | `SongService.saveSongState` | Workbench/Timeline/EventAnalysis load effects | Heavy state blob persisted frequently |
| Mapping cache `mappings[].scoreCache` | Derived optimization score | Workbench reactive solver loop | UI chips/potential sorting | Invalidates on many edits, but writes are entangled with history |
| `manualAssignments[layoutId][eventIndex]` | Manual override constraints | Workbench/EventAnalysis assignment handlers | Solver calls convert key->number | Index stability depends on event ordering/filtering |

## State smells (single-source-of-truth analysis)

| Smell | Reference | Observed | Why it matters | Confidence |
|---|---|---|---|---|
| Dual engine-result truths | `src/context/ProjectContext.tsx:activeResult`, `src/workbench/Workbench.tsx:Reactive Solver Loop` | If `activeSolverId` is set, context returns `solverResults[activeSolverId]`; Workbench/EventAnalysis still update `legacyEngineResult` via `setEngineResult`. | UI can display stale/non-reactive results after manual solver runs; state appears inconsistent. | High |
| Reactive loop mutates project state continuously | `src/workbench/Workbench.tsx` reactive effect (`setProjectState` scoreCache write) | Solver effect writes `scoreCache` into mapping after each run; dependency list includes broad state, including `projectState`. | History pollution, re-render churn, possible feedback loops, noisy autosave writes. | High |
| Per-page duplicated hydration logic | `src/workbench/Workbench.tsx`, `src/pages/TimelinePage.tsx`, `src/pages/EventAnalysisPage.tsx` load effects | Each page independently decides when to load from storage with slightly different “has data” heuristics. | Divergent behavior on refresh/navigation; edge cases where pages disagree on readiness. | High |
| `activeMappingId` outside global state | `src/workbench/Workbench.tsx:activeMappingId` | Mapping selection is local to Workbench, while other pages infer mapping from `mappings[0]`. | Cross-page mapping mismatch and confusing analysis/timeline output. | High |
| Weak load validation vs strict types | `src/workbench/Workbench.tsx:handleLoadProject`, `src/utils/projectPersistence.ts:loadProject` | Minimal schema checks and optional defaults; `instrumentConfig` may become null despite strict `ProjectState` expectations. | Runtime null/undefined crashes or latent invalid state objects. | Medium |
| Object-style state writes dominate | `src/workbench/Workbench.tsx` many `setProjectState({...projectState,...})` calls | Non-functional updates used in many handlers instead of updater function. | Higher risk of stale closure overwrites under rapid or concurrent state writes. | Medium |
| Manual assignment index coupling | `src/workbench/EventLogTable.tsx`, `src/workbench/Workbench.tsx:handleAssignmentChange`, `src/utils/performanceSelectors.ts:getActivePerformance` | Assignments are keyed by event index; filtered/sorted views can remap index meaning. | Manual overrides may apply to wrong event after sorting/filtering changes. | High |
| Dead legacy orchestration path still present | `src/workbench/Workbench.tsx:handleProjectLoad`, `src/workbench/AnalysisView.tsx` | Large import/orchestration stacks exist but are not wired to active routes. | Maintenance burden, conceptual drift, misleading “available” behavior. | High |

## Probable bugs from state flow

| Probable bug | Reference | Observed | Repro hint | Confidence |
|---|---|---|---|---|
| Engine result becomes stale after running solver once | `src/context/ProjectContext.tsx:activeResult`, `src/workbench/Workbench.tsx:setEngineResult(result)` | `activeResult` prioritizes `solverResults` when `activeSolverId` exists; reactive `setEngineResult` updates are ignored. | Load song, run Beam once, then drag mappings and observe analysis values not tracking reactive loop output. | High |
| Undo stack flooded by derived score writes | `src/workbench/Workbench.tsx` reactive scoreCache update + `src/hooks/useProjectHistory.ts:setProjectState` | Derived score writes are treated like user edits and pushed to history. | Assign/move pads repeatedly with performance loaded; observe undo stepping through score-only states. | High |
| Wrong event edited from Event Log controls | `src/workbench/EventLogTable.tsx` sort + index-based callback | Table sorts by cost, then passes sorted-row `index` to assignment callback instead of original `eventIndex`. | In Event Analysis, edit assignment on visible top row; affected event differs from displayed row order. | High |
| Timeline finger overlays mismatch events | `src/pages/TimelinePage.tsx:fingerAssignments`, `src/utils/performanceSelectors.ts:getActivePerformance` | Timeline uses raw `activeLayout.performance.events`, while engine often computed on filtered events. | Hide notes (ignored notes), then inspect timeline finger labels for shifted or missing mappings. | Medium |
| Mapping divergence across routes | `src/pages/TimelinePage.tsx:activeMapping useMemo`, `src/pages/EventAnalysisPage.tsx` mapping selection | Timeline/EventAnalysis default to first mapping, ignoring Workbench local mapping selection. | Create/duplicate mappings and switch in Workbench; navigate to Timeline/Event Analysis and compare selected mapping behavior. | High |
| Invalid loaded state accepted | `src/workbench/Workbench.tsx:handleLoadProject`, `src/utils/projectPersistence.ts:loadProject` | JSON load checks only a subset; key required structures can be absent or null. | Load a minimally structured JSON with missing config fields and trigger render paths that assume presence. | Medium |

## Source-of-truth recommendation (for follow-on implementation planning)

- Canonicalize to one engine result model: `projectState.solverResults + activeSolverId`.
- Treat `scoreCache` as derived ephemeral data outside undo history or recompute on render.
- Promote active mapping selection into global state or route query state so all pages resolve the same mapping.
- Replace index-based manual assignment keys with stable event IDs.

