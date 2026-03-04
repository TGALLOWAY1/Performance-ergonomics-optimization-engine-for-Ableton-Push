# 01 - Feature Map

- Audit timestamp: 2026-03-02T22:03:02-0500
- Repo branch: codex/audit/deep-codebase-review
- Audit scope: User-facing feature map across Dashboard, Workbench, Timeline, Event Analysis, persistence/import-export, and theme behavior.
- Commands run:
  - `rg -n --glob '!node_modules/**' --glob '!dist/**' "TODO|FIXME|deprecated|legacy|mock|seed|export|import|undo|redo|manual|ignored|solver|engineResult|mapping|layout" src docs README.md TODO.md`
  - `npm run`
  - `npm test`
  - `npm run typecheck`
  - `npm run build -- --outDir /tmp/push-performance-audit-dist`
  - `npm run dev -- --host 127.0.0.1 --port 4173`
  - Browser route sweep: `/`, `/workbench`, `/event-analysis`, `/timeline`

## Baseline health observations

| Check | Result | Evidence |
|---|---|---|
| `npm test` | Missing script | `package.json:scripts`, terminal output `Missing script: "test"` |
| `npm run typecheck` | Missing script | `package.json:scripts`, terminal output `Missing script: "typecheck"` |
| `npm run build` | Fails TypeScript | `src/pages/Dashboard.tsx:handleDeleteSong` unused arg; `src/workbench/LayoutDesigner.tsx:onRequestMapToQuadrants` unresolved symbol; `src/workbench/VoiceLibrary.tsx` unused symbols; `src/workbench/Workbench.tsx:handleSaveLayoutVersion` unused |
| Runtime console | Route-level warnings/noise present | `src/utils/performanceSelectors.ts:getRawActivePerformance` warning spam; `src/workbench/SoundAssignmentTable.tsx` debug logging; browser console `favicon.ico 404` |

## Dashboard / Song library

| Feature | Trigger | Compute | Render | Source of truth | Status | Evidence |
|---|---|---|---|---|---|---|
| List songs | `Dashboard:refreshSongs()` in `useEffect` | `songService.getAllSongs()` | Grid of `SongCard` | LocalStorage key `push_perf_songs` | Working | `src/pages/Dashboard.tsx:refreshSongs`, `src/services/SongService.ts:getAllSongs`, `src/components/dashboard/SongCard.tsx` |
| Create song card | `Dashboard:handleAddSongClick` | `songService.createSong(...)` | New `SongCard` after `refreshSongs()` | `SongService.getSongsMap/saveSongsMap` | Working (minimal metadata) | `src/pages/Dashboard.tsx:handleAddSongClick`, `src/services/SongService.ts:createSong` |
| Link MIDI to existing song | `SongCard:handleLinkMidiFileChange` -> `onLinkMidi` | `songService.linkMidiToSong` -> `parseMidiFileToProject` -> `saveProjectStateToStorage` | MIDI-linked badge on card, Workbench loadable state | `songs` map + `push_perf_project_<projectStateId>` | Working | `src/components/dashboard/SongCard.tsx:handleLinkMidiFileChange`, `src/pages/Dashboard.tsx:handleMidiLinked`, `src/services/SongService.ts:linkMidiToSong` |
| Edit title/BPM | Double-click UI in `SongCard` | `songService.updateSongMetadata` | Updated values in card | `songs[metadata]` | Working | `src/components/dashboard/SongCard.tsx:handleSaveEdit`, `src/pages/Dashboard.tsx:handleUpdateSong`, `src/services/SongService.ts:updateSongMetadata` |
| Delete song | `SongCard:handleDeleteClick` | `songService.deleteSong` + project-state removal | Card disappears | `songs` map + project state key | Working (no confirmation) | `src/components/dashboard/SongCard.tsx:handleDeleteClick`, `src/pages/Dashboard.tsx:handleDeleteSong`, `src/services/SongService.ts:deleteSong` |
| Open Workbench | `SongCard:handleWorkbenchClick` | Router query param `songId` | Workbench page | URL `workbench?songId=...` + saved project state | Working | `src/components/dashboard/SongCard.tsx:handleWorkbenchClick`, `src/main.tsx` |
| Open Event Analysis | `SongCard:handleAnalyzeEventsClick` | Router query param `songId` | Event Analysis page | URL `event-analysis?songId=...` | Working | `src/components/dashboard/SongCard.tsx:handleAnalyzeEventsClick`, `src/main.tsx` |
| "Practice" button on card | Visible CTA in card | No handler | Button only | None | Partially implemented | `src/components/dashboard/SongCard.tsx` (button with no `onClick`) |
| Portfolio grouping/filtering | "All Songs" sidebar only | No grouping pipeline | Static sidebar | N/A | Partially implemented | `src/pages/Dashboard.tsx` (single static filter button) |

## Workbench

| Feature | Trigger | Compute | Render | Source of truth | Status | Evidence |
|---|---|---|---|---|---|---|
| Load selected song into context | `Workbench` mount + `songId` effect | `songService.loadSongState(songId)` then `setProjectState(..., true)` | Song badge, grid/voice data | `ProjectContext.projectState` hydrated from LocalStorage | Working | `src/workbench/Workbench.tsx` load effect around songId, `src/services/SongService.ts:loadSongState` |
| Debounced autosave | `useEffect` on `projectState` | `songService.saveSongState` after 1s | No explicit UI state change except song badge text | LocalStorage `push_perf_project_<id>` | Working | `src/workbench/Workbench.tsx` autosave effect, `src/services/SongService.ts:saveSongState` |
| Undo/Redo | Toolbar buttons + keyboard shortcuts | `ProjectContext.undo/redo` from `useProjectHistory` | Undo/Redo controls + state rollback | History stacks in `useProjectHistory` | Working with caveats | `src/workbench/Workbench.tsx` buttons and key listener, `src/hooks/useProjectHistory.ts` |
| Drag/drop sound assignment | DnD interactions in `LayoutDesigner` | `onAssignSound`, `onUpdateMapping`, `onRemoveSound` mutate mappings | Grid cells + voice library state | `projectState.mappings` + `projectState.parkedSounds` | Working | `src/workbench/LayoutDesigner.tsx:handleDragEnd`, `src/workbench/Workbench.tsx:handleAssignSound` |
| Random assignment | Workbench "Randomize" button | `handleAutoAssignRandom` assigns unassigned voices to empty pads | Grid updates + layout mode indicator | `projectState.mappings[].cells/layoutMode` | Working | `src/workbench/Workbench.tsx:handleAutoAssignRandom` |
| Clear grid | Workbench "Clear Grid" button | `handleUpdateMapping({cells:{},layoutMode:'none'})` | Empty grid + mode chip | Active mapping cells/layoutMode | Working | `src/workbench/Workbench.tsx:handleClearGrid` |
| Quadrant auto-layout | Settings menu -> "Organize by 4x4 Banks" | `mapToQuadrants(...)` then mapping update | Grid assignments replaced | `projectState.mappings` | Working | `src/workbench/Workbench.tsx:handleMapToQuadrants`, `src/utils/autoLayout.ts` |
| Run solver (beam/genetic) | "Run Analysis" button | `ProjectContext.runSolver(selectedSolver, activeMapping)` | Progress + solver result dropdown + analysis | `projectState.solverResults` / `activeSolverId` | Working (manual trigger path) | `src/workbench/Workbench.tsx:handleRunSolver`, `src/context/ProjectContext.tsx:runSolver` |
| Reactive solver recompute loop | Workbench `useEffect` on mapping/performance/config | `new BiomechanicalSolver(...).solve(...)` then `setEngineResult` + scoreCache write | Analysis panel and heatmap coloring | Legacy `engineResult` + mapping scoreCache | Partially implemented / risky | `src/workbench/Workbench.tsx` "Reactive Solver Loop" |
| Solver result switching | Solver result select control | `setActiveSolverId` in context | Visualized result switches | `projectState.activeSolverId` | Working | `src/workbench/Workbench.tsx` solver select, `src/context/ProjectContext.tsx:setActiveSolverId` |
| Optimize layout (annealing) | "Auto-Arrange" button | `ProjectContext.optimizeLayout(activeMapping)` | Mapping rewritten, mode `optimized` | `projectState.mappings` + `solverResults['annealing']` | Working (manual trigger) | `src/workbench/Workbench.tsx:handleOptimizeLayout`, `src/context/ProjectContext.tsx:optimizeLayout` |
| Save project JSON | Header "Save Project" | Serialize `projectState` and download | Browser download | `projectState` snapshot | Working | `src/workbench/Workbench.tsx:handleSaveProject` |
| Load project JSON | Header "Load" file input | Parse JSON + minimal shape checks + `setProjectState(..., true)` | Rehydrates layout/mapping | Loaded file contents | Working (light validation) | `src/workbench/Workbench.tsx:handleLoadProject` |
| Save layout version | Local handler increments mapping version | Function exists, not wired to UI | No reachable UI action | N/A | Partially implemented | `src/workbench/Workbench.tsx:handleSaveLayoutVersion` and commented prop usage |
| Unified MIDI import in Workbench | `handleProjectLoad` function | Parse MIDI + hard-reset mapping/layout | Not wired to live UI | N/A | Dead path | `src/workbench/Workbench.tsx:handleProjectLoad`, only referenced in commented legacy effect |

## Timeline (if present)

| Feature | Trigger | Compute | Render | Source of truth | Status | Evidence |
|---|---|---|---|---|---|---|
| Timeline page load by songId | `TimelinePage` song load effect | `songService.loadSongState` if no in-memory data | Timeline shell + song badge | `projectState` | Working | `src/pages/TimelinePage.tsx` load effect |
| Playback/seek | Play/Stop buttons + now-bar click | `requestAnimationFrame` updates `currentTime`; `onSeek` sets time | Scrolling timeline and now bar | Local `TimelinePage` state | Working | `src/pages/TimelinePage.tsx:animate/togglePlay/handleSeek`, `src/workbench/Timeline.tsx` |
| Finger overlay labels | Derived `fingerAssignments` from engine debug events | Index-aligns `debugEvents[i]` to performance events | Per-note finger text in timeline blocks | `engineResult.debugEvents` + performance events | Partially implemented / fragile | `src/pages/TimelinePage.tsx:fingerAssignments`, `src/workbench/Timeline.tsx` |
| Practice mode toggle | Toggle UI in header | No state/use | Decorative toggle | None | Partially implemented | `src/pages/TimelinePage.tsx` practice mode block has no state wiring |
| Scroll speed selector | Dropdown UI | No speed multiplier wired to playback | Decorative selector | None | Partially implemented | `src/pages/TimelinePage.tsx` scroll speed block |

## Event analysis

| Feature | Trigger | Compute | Render | Source of truth | Status | Evidence |
|---|---|---|---|---|---|---|
| Event analysis page load by songId | `EventAnalysisPage` load effect | `songService.loadSongState` fallback if context empty | Header + panel | `projectState` | Working | `src/pages/EventAnalysisPage.tsx` load effect |
| Engine compute for event analysis | `useEffect` on performance/mapping | `new BiomechanicalSolver(...).solve(...)` and set context legacy engine result | Event panel visuals | Legacy `engineResult` in context | Working with duplication caveat | `src/pages/EventAnalysisPage.tsx` engine effect |
| Event timeline + log + onion skin + transition metrics | Internal panel state and memoized analyzers | `analyzeEvents`, `analyzeAllTransitions`, `buildOnionSkinModel` | Three-pane event analysis UI | Derived from `engineResult.debugEvents` | Working | `src/workbench/EventAnalysisPanel.tsx` |
| Export event metrics / hard transitions / loop settings | Export buttons in panel | `eventExport` JSON utilities + download | File downloads | Derived event-analysis models | Working | `src/workbench/EventAnalysisPanel.tsx` + `src/utils/eventExport.ts` |

## Project import/export and persistence

| Feature | Trigger | Compute | Render | Source of truth | Status | Evidence |
|---|---|---|---|---|---|---|
| Song metadata + MIDI linkage persistence | Dashboard actions | `SongService` localStorage read/write | Dashboard cards | `push_perf_songs` key | Working | `src/services/SongService.ts` |
| Per-song project state persistence | Workbench autosave/load | `saveProjectStateToStorage/loadProjectStateFromStorage` | Workbench/Timeline/EventAnalysis restoration | `push_perf_project_<id>` key | Working | `src/services/SongService.ts:saveSongState/loadSongState`, `src/utils/projectPersistence.ts` |
| Manual project JSON export/import | Workbench save/load buttons | Inline JSON download/parse in Workbench | User file transfer | local file | Working | `src/workbench/Workbench.tsx:handleSaveProject/handleLoadProject` |
| Layout-only import/export utilities | Utility functions exist | Not used by routed pages | No active UI in current flow | N/A | Dead path | `src/utils/projectPersistence.ts:exportLayout/importLayout`, only used by `src/workbench/AnalysisView.tsx` |

## Theme toggling

| Feature | Trigger | Compute | Render | Source of truth | Status | Evidence |
|---|---|---|---|---|---|---|
| Dark/light toggle | `ThemeToggle` button | `ThemeContext.toggleTheme` adds/removes `.theme-light` | CSS variable theme update | Local React state in `ThemeProvider` | Working | `src/components/ThemeToggle.tsx`, `src/context/ThemeContext.tsx`, `src/styles/theme.css` |
| Theme persistence across reload | N/A | No localStorage or system sync | Resets to dark on refresh | None | Partially implemented | `src/context/ThemeContext.tsx` (no persistence logic) |

## Route-level feature status summary

| Route | Major user capability | Net status |
|---|---|---|
| `/` Dashboard | Song CRUD + MIDI link + launch flows | Working with partial affordances |
| `/workbench` | Layout editing + analysis + persistence | Working with correctness/state-flow risks |
| `/timeline` | Playback/visual timeline | Working with partial controls and mapping alignment risks |
| `/event-analysis` | Detailed event/transition analysis + exports | Working with duplicated solver execution path |
| `/cost-debug` (dev only) | Debug tooling | Working (dev-gated) |

