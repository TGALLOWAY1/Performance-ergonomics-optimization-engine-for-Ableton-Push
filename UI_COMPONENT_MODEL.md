# UI Component Model

## App Shell

| Component | Responsibility | Consumes | Triggers |
|---|---|---|---|
| `ThemeProvider` | Global theme state and root class management | `push_perf_theme` local storage | theme toggle |
| `ProjectProvider` | Makes `ProjectState`, history, and solver APIs available | initial project defaults | project updates, undo/redo, solver runs, optimization |
| `Routes` in `main.tsx` | Maps URLs to product surfaces | route path and query params | page-level screen mounting |

## Dashboard Surface

| Component | Responsibility | Consumes | Triggers |
|---|---|---|---|
| `Dashboard` | Portfolio shell and song list | `SongService.getAllSongs()`, MIDI-linked status | create song, delete song, link MIDI, open editor/analyze |
| `SongCard` | Per-song summary and actions | `SongMetadata`, `hasMidiLinked` | rename song, edit BPM, delete, link/re-link MIDI, navigate to workbench/event analysis |

Logical hierarchy:

```text
Dashboard
  Header
  Song Grid
    SongCard
  Add Song Card
```

## Workbench Surface

| Component | Responsibility | Consumes | Triggers |
|---|---|---|---|
| `Workbench` | Main orchestrator for hydration, autosave, layout actions, navigation, and analysis controls | `ProjectContext`, `songId`, `useSongStateHydration` | save/load, undo/redo, route navigation, analysis run, optimization, layout helper actions |
| `Button` | Shared action primitive | variant/size/loading state | user action handlers |
| `ThemeToggle` | Theme mode switch | `ThemeContext` | toggles theme |
| `AnalysisPanel` | Inline summary/comparison/optimization analysis | `engineResult`, `activeMapping`, `performance`, stored solver results | tab switching only |

Logical hierarchy:

```text
Workbench
  Header
  Action Toolbar
  LayoutDesigner
  AnalysisPanel
```

## LayoutDesigner Subtree

| Component | Responsibility | Consumes | Triggers |
|---|---|---|---|
| `LayoutDesigner` | Three-part editor shell handling drag/drop, selection, context menu, voice visibility, and pose edit mode | `parkedSounds`, `activeMapping`, `instrumentConfig`, `projectState`, `engineResult` | assign/move/remove sounds, update project state, toggle library/pose mode |
| `VoiceLibrary` | Manages unassigned, placed, and detected voice lists | `parkedSounds`, `activeMapping`, raw active performance, ignored notes | select/edit/delete voices, toggle visibility, destructive delete, clear staging |
| `DraggableSound` | Draggable library item with inline edit controls | `Voice`, visibility state | drag, edit, delete, visibility toggle |
| `PlacedSoundItem` | List item for already placed voices | placed `Voice`, cell key | select and rename |
| `NaturalHandPosePanel` | Pose editing control surface | `pose0`, active finger, preview offset, edit mode | select finger, clear assignments, save/normalize pose, toggle edit mode |
| `DroppableCell` | One grid pad with assignment, label, heatmap, lock, and pose marker layers | assigned sound, finger assignment map, finger constraint, pose ghost marker | click, double-click rename, drag/drop, context menu |
| `FingerLegend` | Visual legend for left/right finger color mapping | theme CSS variables | none |

Logical hierarchy:

```text
LayoutDesigner
  Left Panel
    VoiceLibrary
      DraggableSound
      PlacedSoundItem
    NaturalHandPosePanel
  Center Grid
    8x8 DroppableCell matrix
    FingerLegend
  Floating Context Menu
```

## AnalysisPanel Subtree

| Component | Responsibility | Consumes | Triggers |
|---|---|---|---|
| `AnalysisPanel` | Hosts tabs for summary, solver comparison, and optimization process | current and stored solver results, active mapping, performance | switches internal tab |
| `SoundAssignmentTable` | Summarizes placed sounds, pads, and most common assigned finger | `activeMapping`, `engineResult` | optional sound rename |
| `EvolutionGraph` | Visualizes genetic-algorithm convergence | `geneticResult.evolutionLog`, beam reference cost | none |
| `AnnealingProcessGraph` | Visualizes annealing temperature and cost over time | `annealingResult.optimizationLog` | none |

## Timeline Surface

| Component | Responsibility | Consumes | Triggers |
|---|---|---|---|
| `TimelinePage` | Route shell for timeline hydration and voice/finger derivation | `ProjectContext`, `songId`, `engineResult`, active mapping | zoom changes, back navigation, seek |
| `Timeline` | Lane-based visualization of mapped voices over time | `Performance`, `Voice[]`, `fingerAssignments`, `currentTime`, `zoom` | seek on click |

Logical hierarchy:

```text
TimelinePage
  Header
  Timeline
    Ruler
    Voice Lane Labels
    Note Blocks
    Now Bar
```

## Event Analysis Surface

| Component | Responsibility | Consumes | Triggers |
|---|---|---|---|
| `EventAnalysisPage` | Route shell for hydration, difficulty summary, and manual assignment writes | `ProjectContext`, `songId`, filtered performance, `engineResult` | navigation and assignment override callback |
| `EventAnalysisPanel` | Builds analyzed events, transitions, onion-skin model, and export actions | `engineResult`, `performance` | left-tab changes, event selection, export clicks, practice loop |
| `EventTimelinePanel` | Selectable transition list with difficulty bars | `AnalyzedEvent[]`, `Transition[]`, selected index | select focused transition |
| `EventLogTable` | Sorted event table with per-event hand/finger overrides | `EngineDebugEvent[]` | writes `manualAssignments` |
| `OnionSkinGrid` | Spatial visualization of current/next/previous event states and movement vectors | `OnionSkinModel` | optional hover callbacks |
| `TransitionMetricsPanel` | Shows metrics for the selected transition | current analyzed event, current transition | none |
| `PracticeLoopControls` | Controls the visual practice loop for a selected transition | selected event index, playback state | start/stop practice loop |

Logical hierarchy:

```text
EventAnalysisPage
  Header
  EventAnalysisPanel
    Export Bar
    Left Column
      EventTimelinePanel or EventLogTable
    Center Column
      OnionSkinGrid
    Right Column
      PracticeLoopControls
      TransitionMetricsPanel
```

## Cost Debug Surface

| Component | Responsibility | Consumes | Triggers |
|---|---|---|---|
| `CostDebugPage` | Developer-facing diagnostic route for event costs and annealing telemetry | `engineResult`, `songId` | mode switch, sort selection, event selection |
| `EventCostsView` | Displays sortable event-level cost breakdowns | `debugEvents` | selects event, changes sort mode |
| `AnnealingTrajectoryView` | Shows annealing time-series behavior | `annealingTrace` | none |
| `AnnealingMetricsView` | Shows annealing aggregate metrics | `annealingTrace` | none |

## Component Boundaries That Matter For Redesign

- `Workbench` is not just a page wrapper; it is the coordination boundary for persistence, solver actions, and navigation.
- `LayoutDesigner` owns most interaction complexity for the main authoring flow.
- `AnalysisPanel` is a summary surface, while `EventAnalysisPanel` is the detailed diagnostic surface.
- `EventAnalysisPanel` depends on derived models; it does not own raw project state beyond emitting manual assignment overrides.
- `Timeline` is read-only and depends on already-selected mapping plus already-computed solver output.
