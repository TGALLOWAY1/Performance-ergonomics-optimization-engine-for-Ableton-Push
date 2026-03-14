# Feature Inventory

## Scope

This inventory reflects features that are present in the current repository, grouped by product importance and maturity. "Core" means required for the main performance-to-layout workflow. "Secondary" means supporting but not essential. "Debug / Developer Tools" are intentionally diagnostic. "Experimental" captures hidden, weakly integrated, or dormant capabilities.

## Core Features

| Feature | Current behavior | Primary entry points |
|---|---|---|
| Song portfolio | Lists persisted songs and acts as app home | `src/pages/Dashboard.tsx` |
| Create song container | Creates a new song with default metadata | Dashboard "Add New Song" |
| MIDI link / re-link | Attaches MIDI to an existing song and regenerates song state | `SongCard`, `SongService.linkMidiToSong` |
| Built-in default test song | Seeds a default MIDI-backed song on startup | `songService.seedDefaultTestSong()` |
| Song-specific hydration | Loads a song's persisted `ProjectState` when entering routed pages | `useSongStateHydration` |
| Per-song auto-save | Saves workbench state back to the selected song | `Workbench`, `SongService.saveSongState` |
| Explicit empty-grid import | Imported voices go to staging; grid starts empty | `midiImport.ts`, `SongService.createProjectStateFromMidi` |
| Voice library / staging area | Shows unassigned voices for drag-and-drop layout authoring | `VoiceLibrary` |
| Manual drag-and-drop layout editing | Assign, move, swap, and unassign voices on the grid | `LayoutDesigner` |
| Layout clearing | Removes all assignments from the current mapping | Workbench "Clear Grid" |
| Natural Hand Pose editor | Lets the user define personalized finger resting pads | `NaturalHandPosePanel` |
| Pose-based full seeding | Fills a mapping from Pose 0 anchors and performance note importance | Workbench "Seed" |
| Pose-priority assignment | Places unassigned voices onto Pose 0 pads first | Workbench "Natural" |
| Random assignment | Places remaining unassigned voices onto empty pads randomly | Workbench "Random" |
| 4x4 bank organization | Maps notes into Push-style quadrant banks | Workbench settings "Organize by 4x4 Banks" |
| Run analysis | Executes solver analysis against current mapping/performance | Workbench "Run Analysis" |
| Biomechanical beam solver | Default ergonomic scoring and assignment engine | `ProjectContext.runSolver`, `BeamSolver` |
| Simulated annealing layout optimization | Mutates mappings to reduce ergonomic cost | Workbench "Auto-Arrange", `ProjectContext.optimizeLayout` |
| Solver-result persistence | Stores results by solver type in project state | `ProjectState.solverResults` |
| Analysis summary | Shows ergonomic score, event count, hand balance, and metric averages | `AnalysisPanel` |
| Sound-to-finger assignment table | Summarizes placed sounds, pads, and most common finger assignment | `SoundAssignmentTable` |
| Timeline view | Displays voices as time lanes with finger labels | `/timeline`, `Timeline` |
| Event analysis view | Displays grouped events, transitions, onion skin, and metrics | `/event-analysis`, `EventAnalysisPanel` |
| Project JSON save/load | Exports and imports full project state | `projectPersistence.ts`, Workbench header |
| Undo / redo | Maintains in-session project history | `useProjectHistory`, Workbench header |
| Theme toggle | Toggles light/dark theme and persists it | `ThemeContext`, `ThemeToggle` |

## Secondary Features

| Feature | Current behavior | Primary entry points |
|---|---|---|
| Song metadata editing | Inline rename and BPM edit on song cards | `SongCard` |
| Song deletion | Removes song metadata and its associated project state | `SongCard`, `SongService.deleteSong` |
| Voice rename / recolor | Edits voice names and colors in library items | `VoiceLibrary` |
| In-grid sound rename | Double-click rename for placed sounds | `DroppableCell`, `PlacedSoundItem` |
| Voice visibility filter | Hides note numbers from filtered performance without deleting raw data | `VoiceLibrary`, `performanceSelectors.ts` |
| Destructive note deletion | Permanently removes all events for a note number from the active performance | `VoiceLibrary` -> `handleDestructiveDelete` |
| Reachability visualization | Shows left/right finger reach maps for a chosen pad | `LayoutDesigner` context menu |
| Finger constraint locks | Locks a pad to `L1-L5` or `R1-R5` style constraints | `LayoutDesigner` context menu |
| Layout duplication | Clones the active mapping as another variant | Workbench settings "Duplicate Layout" |
| Mapping metadata | Keeps `name`, `notes`, `layoutMode`, `version`, and `savedAt` on mappings | `GridMapping`, Workbench logic |
| Mapping score cache | Caches score on mappings for later reference | `GridMapping.scoreCache` |
| Advanced solver selection | Exposes beam vs genetic analysis in advanced mode | Workbench advanced toggle |
| Solver result switching | Lets user switch which stored solver result is visualized | Workbench advanced mode |
| Model comparison tab | Compares beam and genetic results | `AnalysisPanel` comparison tab |
| Optimization process tab | Visualizes annealing process and stats | `AnalysisPanel` optimization tab |
| Event log reassignment | Allows manual per-event hand/finger override from event log table | `EventLogTable`, Event Analysis page |
| Practice loop controls | Steps between event N and N+1 at fixed speeds | `PracticeLoopControls`, `usePracticeLoop` |
| Event-analysis exports | Exports full metrics, hard transitions, and loop settings as JSON | `eventExport.ts` |
| Timeline zoom | Scales horizontal timeline density | `TimelinePage` |
| Song status badges | Shows "In Progress" or "Mastered" heuristics on cards | `SongCard` |

## Debug / Developer Tools

| Feature | Current behavior | Primary entry points |
|---|---|---|
| Dev-only Cost Debug route | Detailed per-event and annealing diagnostic view | `/cost-debug` in development only |
| Event cost sorting | Sorts debug events by time or highest cost | `CostDebugPage` |
| Annealing trajectory view | Visualizes optimization steps and temperature acceptance | `CostDebugPage` |
| Annealing metrics view | Exposes annealing aggregate telemetry | `CostDebugPage` |
| Debug event model | Per-event cost breakdown, pad, finger, difficulty, and event key | `EngineDebugEvent` |
| Annealing trace model | Full iteration trace with component shares | `AnnealingIterationSnapshot` |
| Extensive fixture/test corpus | Encodes solver behavior expectations and mapping coverage cases | `src/engine/__tests__` |
| Seeded RNG for deterministic optimization | Supports reproducible mutation paths | `seededRng.ts`, annealing solver |
| Built-in default test MIDI | Gives developers and testers an always-available starting song | `src/data/testData.ts` |

## Experimental Features

| Feature | Why it is experimental or weakly integrated | Evidence |
|---|---|---|
| Genetic solver as user-facing workflow | Available only behind advanced controls and mainly used for comparison | Workbench advanced mode, `GeneticSolver` |
| `sectionMaps` | Present in the data model but not meaningfully surfaced in current UI | `ProjectState`, `SectionMap` |
| Multiple instrument configs | `instrumentConfigs[]` exists, but the UI behaves as single-config | `ProjectState`, import logic |
| Layout templates | `LayoutTemplate` and `STANDARD_KIT_TEMPLATE` exist but are not surfaced in the active workflow | `src/types/layout.ts` |
| Practice loop as playback tool | Current implementation only steps event selection; no real audio/MIDI playback | `usePracticeLoop.ts` |
| Timeline transport | Timeline has `currentTime` and `isPlaying` props but no active playback engine | `TimelinePage`, `Timeline` |
| Legacy default hand-pose model in note space | Coexists with newer Pose 0 pad-space model | `handPose.ts`, `naturalHandPose.ts` |
| Deprecated `setEngineResult` compatibility stub | Maintained only to avoid breaking older consumers | `ProjectContext.tsx` |

## Feature Boundaries To Carry Forward

- Import does not auto-place sounds.
- Optimization is valid only with full note coverage.
- Event analysis is derived from solver debug output, not raw MIDI alone.
- The workbench is the operational center; alternate routes are drill-down views, not independent editing systems.
