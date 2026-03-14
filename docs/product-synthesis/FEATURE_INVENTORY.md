# Feature Inventory

## Scope

This inventory aims to capture the full current product surface implied by code and active documentation, including user-visible features, hidden code-only capabilities, incomplete flows, and features whose status is ambiguous.

Status labels used here:

- `implemented`: current code clearly supports it
- `partial`: user can see or touch it, but the flow is incomplete or limited
- `hidden`: implemented in code but not clearly surfaced in main UX
- `duplicate`: available in more than one overlapping surface
- `legacy/unclear`: present in code/docs but not clearly part of the active product
- `broken-looking`: present, but current build/test state or obvious drift reduces confidence

## Creation / Authoring

| Feature Name | Category | Description | User-visible? | Primary page/route | Supporting files/components | Related state/domain objects | Status | Evidence | Notes / ambiguities |
|---|---|---|---|---|---|---|---|---|---|
| Create empty song | creation / authoring | Adds a metadata-only song entry to the portfolio | Yes | `/` | `src/pages/Dashboard.tsx:handleAddSongClick`, `src/services/SongService.ts:createSong` | `Song`, `SongMetadata` | implemented | Dashboard add card calls `createSong('New Song', ...)` | Produces a song that immediately leads to "no MIDI" states until linked |
| Seed default test song | creation / authoring | Ensures a bundled demo/test song exists | Mostly hidden | app bootstrap, `/` | `src/main.tsx:bootstrap`, `src/pages/Dashboard.tsx`, `src/services/SongService.ts:seedDefaultTestSong`, `src/data/testData.ts` | `Song`, base64 MIDI, `ProjectState` | implemented | Bootstrap and Dashboard both seed it | This quietly changes first-run product state |
| Create project state from MIDI | creation / authoring | Converts MIDI into performance, voices, config, mapping, and pose defaults | Hidden | triggered from Dashboard link/re-link flow | `src/services/SongService.ts:createProjectStateFromMidi`, `src/utils/midiImport.ts` | `ProjectState`, `Performance`, `Voice[]`, `GridMapping`, `NaturalHandPose[]` | implemented | Current import path uses `linkMidiToSong` | Core creation step is not exposed as a named user concept |
| Link MIDI to existing song | creation / authoring | Attaches a MIDI file to a song and rebuilds its project state | Yes | `/` | `src/components/dashboard/SongCard.tsx`, `src/pages/Dashboard.tsx:handleMidiLinked`, `src/services/SongService.ts:linkMidiToSong` | `Song`, `ProjectState`, `Performance` | implemented | Song card label triggers hidden file input | Re-link overwrites project state from MIDI, which may surprise users |
| Import song directly from MIDI | creation / authoring | Create a brand-new song from a MIDI file in one step | Not in main UI | no current routed entry | `src/services/SongService.ts:importSongFromMidi` | `Song`, `ProjectState` | hidden | Method exists, but Dashboard no longer offers import CTA | Important capability exists but is not currently surfaced |

## Editing / Layout Authoring

| Feature Name | Category | Description | User-visible? | Primary page/route | Supporting files/components | Related state/domain objects | Status | Evidence | Notes / ambiguities |
|---|---|---|---|---|---|---|---|---|---|
| Drag voice from library to grid | editing | Assign unplaced voice to pad by drag/drop | Yes | `/workbench` | `src/workbench/LayoutDesigner.tsx:handleDragEnd`, `src/workbench/VoiceLibrary.tsx` | `Voice`, `GridMapping.cells`, `parkedSounds` | implemented | DnD-kit workflow in LayoutDesigner | Main direct authoring interaction |
| Move or swap placed voices | editing | Move a placed voice to another pad or swap with occupied pad | Yes | `/workbench` | `src/workbench/LayoutDesigner.tsx:handleDragEnd` | `GridMapping.cells`, `fingerConstraints` | implemented | Explicit swap logic preserves/moves constraints | Important for iterative layout tuning |
| Unassign voice back to staging | editing | Drop placed voice into staging area to remove it from grid | Yes | `/workbench` | `src/workbench/LayoutDesigner.tsx`, `src/workbench/VoiceLibrary.tsx:DroppableStagingArea` | `GridMapping.cells`, `parkedSounds` | implemented | Drop target `staging-area` | User-facing language still mixes staging/library/unassigned |
| Rename placed voice | editing | Double-click grid cell or placed list entry to rename | Yes | `/workbench` | `src/workbench/LayoutDesigner.tsx`, `src/workbench/VoiceLibrary.tsx:PlacedSoundItem` | `Voice.name` | implemented | Inline edit paths in both grid and placed list | Same concept appears in multiple places |
| Rename / recolor staging voice | editing | Edit name and color from library list | Yes | `/workbench` | `src/workbench/VoiceLibrary.tsx:DraggableSound` | `Voice.name`, `Voice.color` | implemented | Library item edit panel | No centralized "voice details" model |
| Delete voice from library and mappings | editing | Permanently remove a voice from staging and any mappings | Yes | `/workbench` | `src/workbench/VoiceLibrary.tsx`, `src/workbench/Workbench.tsx:handleDeleteSound` | `Voice`, `GridMapping.cells`, `parkedSounds` | implemented | Delete button confirmed with `window.confirm` | Destructive and strong; no undo-specific UX cue |
| Clear staging area | editing | Delete all unassigned voices from staging | Yes | `/workbench` | `src/workbench/VoiceLibrary.tsx:handleClearStaging`, `src/workbench/LayoutDesigner.tsx` | `parkedSounds` | implemented | Button shown in Unassigned tab when non-empty | Destructive; effectively deletes voices rather than just hiding them |
| Duplicate active mapping | editing | Create a copy of current mapping | Yes | `/workbench` settings | `src/workbench/Workbench.tsx:handleDuplicateMapping` | `GridMapping`, `activeMappingId` | implemented | Settings menu action | No explicit compare workflow after duplication |
| Clear grid | editing | Remove all pad assignments and set layout mode to `none` | Yes | `/workbench` | `src/workbench/Workbench.tsx:handleClearGrid` | `GridMapping.cells`, `layoutMode` | implemented | Toolbar action | Depends on parked voices still existing as references |
| Organize by 4x4 banks | editing | Auto-place voices into quadrant-based regions | Yes | `/workbench` settings | `src/workbench/Workbench.tsx:handleMapToQuadrants`, `src/utils/autoLayout.ts` | `GridMapping`, `InstrumentConfig.bottomLeftNote` | implemented | Settings menu action | Product meaning of "quadrants" is not explained in UI |
| Random assignment | editing | Randomly place unassigned voices on empty pads | Yes | `/workbench` | `src/workbench/Workbench.tsx:handleAutoAssignRandom` | `GridMapping`, `parkedSounds`, `layoutMode='random'` | implemented | Toolbar button `Random` | Old docs called this "Assign Manually"; current label is clearer |
| Finger locks on pads | editing | Constrain a pad to a specific finger/hand label | Yes | `/workbench` | `src/workbench/LayoutDesigner.tsx` context menu | `GridMapping.fingerConstraints` | implemented | Context menu allows `L1-L5` and `R1-R5` | Powerful but undiscoverable |
| Remove sound via context menu | editing | Right-click a placed pad and remove its voice | Yes | `/workbench` | `src/workbench/LayoutDesigner.tsx` context menu | `GridMapping.cells` | implemented | Context menu `Remove Sound` | Duplicates drag-to-staging removal |
| Hide voice from analysis/view | editing / filtering | Toggle note-number visibility without deleting it | Yes | `/workbench` | `src/workbench/VoiceLibrary.tsx`, `src/workbench/LayoutDesigner.tsx`, `src/utils/performanceSelectors.ts` | `ignoredNoteNumbers`, filtered `Performance` | implemented | Eye / hidden icon toggles | This is both an editing and analysis-scope feature |
| Permanently delete all events for note | editing / filtering | Remove every event for a note number from the active performance | Yes | `/workbench` | `src/workbench/LayoutDesigner.tsx:handleDestructiveDelete`, `src/workbench/VoiceLibrary.tsx` | `LayoutSnapshot.performance.events` | implemented | Detected tab delete action | Very strong destructive action inside library list |

## Pose / Personalization

| Feature Name | Category | Description | User-visible? | Primary page/route | Supporting files/components | Related state/domain objects | Status | Evidence | Notes / ambiguities |
|---|---|---|---|---|---|---|---|---|---|
| Edit Natural Hand Pose | personalization | Assign each finger to a preferred pad | Yes | `/workbench` | `src/workbench/NaturalHandPosePanel.tsx` | `NaturalHandPose`, `fingerToPad` | implemented | Dedicated Pose tab and editor | This is one of the clearest personalized features |
| Pose keyboard shortcuts | personalization | Use `1-5` and `6-0` to choose fingers while editing pose | Yes | `/workbench` | `src/workbench/NaturalHandPosePanel.tsx` | `FingerId` | implemented | Keyboard handler in panel | Only available in edit mode |
| Pose preview offset | personalization | Preview vertical shift of pose rows | Yes | `/workbench` | `src/workbench/NaturalHandPosePanel.tsx`, `src/types/naturalHandPose.ts` | `previewOffset`, `maxUpShiftRows` | implemented | Slider with safety messaging | Preview is visible, but exact product meaning is advanced |
| Save and normalize pose | personalization | Save edited pose after normalization and validation | Yes | `/workbench` | `src/workbench/NaturalHandPosePanel.tsx`, `src/types/naturalHandPose.ts` | `NaturalHandPose` | implemented | `Save & Normalize Pose` button | Important system rule hidden in terminology, not broader product copy |
| Pose ghost markers on grid | personalization / visualization | Show finger markers on pads during pose edit mode | Yes | `/workbench` | `src/workbench/LayoutDesigner.tsx`, `src/workbench/NaturalHandPosePanel.tsx:getPoseGhostMarkers` | `NaturalHandPose`, `PadCoord` | implemented | Ghost markers rendered in cells | Good bridge between pose and grid, but mode-specific |
| Pose-driven seed mapping | personalization / optimization | Fill mapping deterministically from pose anchors and note importance | Yes | `/workbench` | `src/workbench/Workbench.tsx:handleSeedFromPose0`, `src/engine/seedMappingFromPose0.ts` | `NaturalHandPose`, `Performance`, `GridMapping` | implemented | Toolbar button `Seed` | Returns mapping with `layoutMode: 'optimized'`, which is semantically odd for a seed operation |
| Pose-driven natural assignment | personalization / authoring | Assign unassigned voices to pose pads first, then other pads | Yes | `/workbench` | `src/workbench/Workbench.tsx:handleAutoAssignNaturalPose` | `NaturalHandPose`, `Voice`, `GridMapping` | implemented | Toolbar button `Natural` | Strong signal that Pose 0 is not optional in intended workflow |

## Optimization / Analysis

| Feature Name | Category | Description | User-visible? | Primary page/route | Supporting files/components | Related state/domain objects | Status | Evidence | Notes / ambiguities |
|---|---|---|---|---|---|---|---|---|---|
| Run beam analysis | optimization / analysis | Run the biomechanical solver and store result under `beam` | Yes | `/workbench` | `src/workbench/Workbench.tsx:handleRunSolver`, `src/context/ProjectContext.tsx:runSolver` | `solverResults`, `activeSolverId`, `EngineResult` | implemented | Default analysis path | User sees "Run Analysis," not "Run Beam" |
| Run genetic analysis | optimization / analysis | Run async genetic solver with progress bar | Yes, when advanced | `/workbench` | `src/workbench/Workbench.tsx`, `src/context/ProjectContext.tsx:runSolver` | `solverResults['genetic']` | implemented | Advanced toggle and progress bar | Advanced-only, so somewhat hidden |
| Solver result switching | optimization / analysis | Choose which stored solver result drives visualized analysis | Yes, when advanced | `/workbench` | `src/workbench/Workbench.tsx`, `src/context/ProjectContext.tsx:setActiveSolverId` | `activeSolverId`, `solverResults` | implemented | Result selector in advanced mode | Comparison meaning depends on mapping consistency |
| Auto-arrange / annealing layout optimization | optimization / analysis | Optimize current mapping and overwrite it with best mapping | Yes | `/workbench` | `src/workbench/Workbench.tsx:handleOptimizeLayout`, `src/context/ProjectContext.tsx:optimizeLayout` | `GridMapping`, `solverResults['annealing']`, `layoutMode='optimized'` | implemented | Toolbar button `Auto-Arrange` | Optimization is blocked unless mapping coverage is complete |
| Mapping coverage enforcement before optimization | optimization / analysis | Prevent optimize if performance notes are unmapped | Hidden but user-visible via alert | `/workbench` | `src/workbench/Workbench.tsx`, `src/engine/mappingCoverage.ts` | `MappingCoverageResult` | implemented | Alert names unmapped notes | Important product rule not surfaced before failure |
| Analysis summary panel | optimization / analysis | Show ergonomic score, event count, hand balance, cost metrics, assignment table | Yes | `/workbench` | `src/workbench/AnalysisPanel.tsx` | `EngineResult.averageMetrics`, `fingerUsageStats` | implemented | Summary tab | Primary "at a glance" analysis surface |
| Solver comparison panel | optimization / analysis | Compare beam vs genetic cost, balance, fatigue, evolution graph | Yes, when advanced | `/workbench` | `src/workbench/AnalysisPanel.tsx` | `solverResults['beam']`, `solverResults['genetic']` | implemented | Comparison tab gated by `showAdvanced` | Niche but active |
| Optimization-process panel | optimization / analysis | Visualize annealing progress and acceptance rate | Yes | `/workbench` | `src/workbench/AnalysisPanel.tsx` | `solverResults['annealing'].optimizationLog` | implemented | Optimization tab | Tied to annealing result availability |
| Finger assignment table | optimization / analysis | Show note-to-finger assignment summary | Yes | `/workbench` | `src/workbench/SoundAssignmentTable.tsx`, `src/workbench/AnalysisPanel.tsx` | `GridMapping`, `EngineResult.debugEvents` | implemented | Summary tab lower section | Another analysis representation of the same solver output |

## Visualization / Inspection

| Feature Name | Category | Description | User-visible? | Primary page/route | Supporting files/components | Related state/domain objects | Status | Evidence | Notes / ambiguities |
|---|---|---|---|---|---|---|---|---|---|
| Grid finger-color overlay | visualization | Color placed pads by inferred or manual finger assignment | Yes | `/workbench` | `src/workbench/LayoutDesigner.tsx:fingerAssignmentMap` | `manualAssignments`, `EngineResult.debugEvents` | implemented | Cell background and badges | Depends on analysis already existing |
| Finger legend | visualization | Show left/right finger color legend | Yes | `/workbench` | `src/workbench/FingerLegend.tsx`, `src/workbench/LayoutDesigner.tsx` | finger color system | implemented | Always visible under grid | Good explanatory affordance |
| Reachability heatmap | visualization | Visualize reachable pads from a selected anchor for L1/R1 | Yes | `/workbench` | `src/workbench/LayoutDesigner.tsx`, `src/engine/feasibility.ts:getReachabilityMap` | `ReachabilityLevel` | implemented | Context menu `Show Reach for L1/R1` | Hidden feature with strong analysis value |
| Layout mode indicator | visualization | Show current mapping origin/status such as Manual, Random, Optimized | Yes | `/workbench` | `src/workbench/LayoutDesigner.tsx` | `GridMapping.layoutMode`, `version` | implemented | Floating grid chip | Helpful but not enough for full layout identity |
| Timeline page | visualization | Show performance chronologically across voice lanes with finger labels | Yes | `/timeline` | `src/pages/TimelinePage.tsx`, `src/workbench/Timeline.tsx` | `Performance`, derived `voices`, finger labels | implemented | Full route | Current page is simpler than several docs suggest |
| Event analysis page | visualization | Deep-dive route with transition list, onion-skin grid, metrics, practice loop | Yes | `/event-analysis` | `src/pages/EventAnalysisPage.tsx`, `src/workbench/EventAnalysisPanel.tsx` | `AnalyzedEvent`, `Transition`, `OnionSkinModel` | implemented | Full route | This is the richest analysis surface |
| Cost debug page | visualization / debug | Developer-only route for per-event cost breakdown and annealing trace | Dev-only | `/cost-debug` | `src/pages/CostDebugPage.tsx` | `EngineDebugEvent`, `annealingTrace`, `CostBreakdown` | implemented | Dev-gated route and page | Explicitly not part of production UX |

## Event Analysis / Practice

| Feature Name | Category | Description | User-visible? | Primary page/route | Supporting files/components | Related state/domain objects | Status | Evidence | Notes / ambiguities |
|---|---|---|---|---|---|---|---|---|---|
| Event timeline list | analysis / inspection | Scrollable transition list colored by composite difficulty | Yes | `/event-analysis` | `src/workbench/EventTimelinePanel.tsx` | `Transition.metrics.compositeDifficultyScore` | implemented | Left panel timeline tab | Event means grouped moment, not raw note |
| Event log table | analysis / inspection | Sorted table of debug events with manual hand/finger override controls | Yes | `/event-analysis` | `src/workbench/EventLogTable.tsx` | `EngineDebugEvent`, `manualAssignments` | implemented | Left panel log tab | Sort order uses eventKey fallback logic; still somewhat brittle |
| Onion-skin grid | analysis / visualization | Shows current, previous, next pads and finger movement context | Yes | `/event-analysis` | `src/components/vis/OnionSkinGrid.tsx`, `src/engine/onionSkinBuilder.ts` | `OnionSkinModel` | implemented | Center panel | Current tests indicate data-shape drift around this model |
| Transition metrics panel | analysis / inspection | Shows time delta, distance, speed pressure, stretch, and flags | Yes | `/event-analysis` | `src/workbench/TransitionMetricsPanel.tsx` | `TransitionMetrics` | implemented | Right panel | Clear drill-down component |
| Practice loop | analysis / practice | Visual loop stepping between selected event and next event at chosen speed | Yes | `/event-analysis` | `src/workbench/PracticeLoopControls.tsx`, `src/hooks/usePracticeLoop.ts` | selected event index, timer state | partial | Hook comments explicitly say MVP visual-only stepping | No actual MIDI/audio playback |
| Export event metrics JSON | analysis / export | Download all event and transition metrics | Yes | `/event-analysis` | `src/workbench/EventAnalysisPanel.tsx`, `src/utils/eventExport.ts` | `AnalyzedEvent[]`, `Transition[]` | implemented | Export button | Output is analysis-specific, separate from project JSON |
| Export hard transitions JSON | analysis / export | Download transitions above difficulty threshold | Yes | `/event-analysis` | same as above | `Transition[]` | implemented | Export button | Threshold hardcoded at `0.7` in handler |
| Export practice-loop settings JSON | analysis / export | Download currently selected loop index and available speeds | Yes | `/event-analysis` | same as above | selected index, speed options | implemented | Export button | Mostly a configuration artifact, not a rich practice artifact |

## Persistence / Import / Export

| Feature Name | Category | Description | User-visible? | Primary page/route | Supporting files/components | Related state/domain objects | Status | Evidence | Notes / ambiguities |
|---|---|---|---|---|---|---|---|---|---|
| Per-song autosave | persistence | Persist current project state to song-specific localStorage entry | Mostly implicit | `/workbench` | `src/workbench/Workbench.tsx`, `src/services/SongService.ts:saveSongState` | `ProjectState`, `Song.projectStateId` | implemented | 1-second debounced save | Major product behavior with little explicit UX explanation |
| Song metadata persistence | persistence | Persist song metadata and MIDI linkage | Yes | `/` | `src/services/SongService.ts` | `Song`, `SongMetadata` | implemented | LocalStorage `push_perf_songs` | Local-first only |
| Project JSON export | persistence / export | Download full `ProjectState` as JSON | Yes | `/workbench` | `src/workbench/Workbench.tsx`, `src/utils/projectPersistence.ts:saveProject` | `ProjectState` | implemented | Save Project button | Separate from per-song autosave |
| Project JSON import | persistence / import | Load full `ProjectState` from JSON with strict validation | Yes | `/workbench` | `src/workbench/Workbench.tsx`, `src/utils/projectPersistence.ts:loadProject` | `ProjectState` | implemented | Load button and validation result banner | Current build errors reduce confidence in type correctness |
| Strict file validation | persistence / import | Reject malformed project files and default some additive fields | Hidden | `/workbench` load flow | `src/utils/projectPersistence.ts:validateProjectStrict` | `ProjectState`, `NaturalHandPose` | implemented | Validation result structure | Good hidden capability |
| Lenient localStorage hydration | persistence | Sanitize saved state from localStorage | Hidden | all routed song pages | `src/utils/projectPersistence.ts:validateProjectState` | `ProjectState` | implemented | Used by `SongService.loadSongState` | Important difference from file import path |

## Theming / UI Shell

| Feature Name | Category | Description | User-visible? | Primary page/route | Supporting files/components | Related state/domain objects | Status | Evidence | Notes / ambiguities |
|---|---|---|---|---|---|---|---|---|---|
| Theme toggle | theming / UI shell | Toggle light/dark theme | Yes | `/workbench` | `src/components/ThemeToggle.tsx`, `src/context/ThemeContext.tsx` | `theme` | implemented | Header theme toggle | Currently only exposed on Workbench |
| Theme persistence | theming / UI shell | Persist theme in localStorage | Hidden but user-observable | app-wide | `src/context/ThemeContext.tsx` | localStorage key `push_perf_theme` | implemented | Reads and writes from localStorage | Older audit docs claiming non-persistence are stale |
| Song/workbench navigation shell | theming / UI shell | Provide route links between portfolio, workbench, timeline, event analysis, and dev debug | Yes | multiple routes | `src/main.tsx`, headers in page components | route/query state | implemented | Current routes explicitly defined | Strong navigation redundancy around analysis |

## Hidden, Duplicate, and Planned-Looking Features

### Duplicate features across pages

| Duplicated concept | Surfaces | Evidence | Product concern |
|---|---|---|---|
| Performance analysis | Workbench `AnalysisPanel`, `EventAnalysisPage`, `TimelinePage`, `CostDebugPage` | `src/workbench/AnalysisPanel.tsx`, `src/pages/EventAnalysisPage.tsx`, `src/pages/TimelinePage.tsx`, `src/pages/CostDebugPage.tsx` | Hard to tell which is canonical summary vs drill-down vs debug |
| Finger assignment visualization | Grid heatmap, finger assignment table, timeline labels, event log, onion skin | same | Strong value, but repeated in disconnected representations |
| Manual edit of assignment meaning | Grid drag, finger locks, event log overrides | `LayoutDesigner`, `EventLogTable` | Multiple kinds of "assignment" are easy to confuse |

### Hidden features that exist in code but are not clearly surfaced

| Feature | Evidence | Why it matters |
|---|---|---|
| `SongService.importSongFromMidi` | `src/services/SongService.ts` | Product can support direct import, but current main UX does not expose it |
| Layout templates | `src/types/layout.ts:STANDARD_KIT_TEMPLATE`, `LAYOUT_TEMPLATES` | Suggests intended template workflow that is not visible |
| `sectionMaps` data model | `src/types/performance.ts:SectionMap`, `src/types/projectState.ts` | Suggests a song-section workflow that is currently dormant |
| Reachability visualization | `src/workbench/LayoutDesigner.tsx` context menu | Valuable analysis aid but discoverability is low |

### Features that appear planned but incomplete

| Feature | Evidence | Current reading |
|---|---|---|
| Practice as a first-class user workflow | Song cards route only to Editor and Analyze; practice loop is visual-only | The product seems to want practice support, but it is not yet a complete user flow |
| Rich section-based optimization | Workbench header says "Section Layout Optimizer"; `sectionMaps` remain in state | Product language still implies a broader section model than active UX supports |
| Template-based assignment | Template types exist, but `templateSlot` is always `null` in `LayoutDesigner` | Planned or abandoned |
| Alternative instrument layouts | `InstrumentConfig.layoutMode` only supports `'drum_64'`, but docs mention future modes | Planned, not active |

