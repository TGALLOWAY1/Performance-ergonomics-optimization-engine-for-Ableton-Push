# Task Flows

## Flow 1: Create or Select a Song

Entry point: Dashboard `/`

Steps:

1. The user opens the dashboard and sees the song portfolio.
2. The user either selects an existing song card or creates a new one with "Add New Song".
3. The selected song becomes the container for future MIDI linking, editing, and analysis.

UI screens used:

- Dashboard
- SongCard

Engine interactions:

- None. This flow touches `SongService` and local storage, not the solver.

State changes:

- Creates or reads a `Song`.

## Flow 2: Link MIDI to a Song

Entry point: Dashboard song card "Link MIDI" or "Re-link"

Steps:

1. The user opens the file picker from a song card.
2. The app reads the MIDI file and parses note events, voices, tempo, and note range.
3. The app derives a new `ProjectState` for the song.
4. The app persists both song metadata and the generated project state.

UI screens used:

- Dashboard
- SongCard

Engine interactions:

- No solver execution yet.
- Uses the import pipeline:
  - `parseMidiFileToProject`
  - `GridMapService.noteToGrid`
  - `SongService.createProjectStateFromMidi`

State changes:

- Updates `Song.midiData`, `midiFileName`, BPM, duration, key.
- Creates `LayoutSnapshot`, `Performance`, `Voice[]`, `InstrumentConfig`, empty `GridMapping`, default Pose 0.

## Flow 3: Open and Hydrate the Workbench

Entry point: Dashboard "Editor" button or direct route `/workbench?songId=<id>`

Steps:

1. The route reads `songId`.
2. `useSongStateHydration` checks whether the current context already matches that song.
3. The persisted project state is loaded from local storage if needed.
4. The workbench resolves the active layout and active mapping.
5. Auto-save is armed for further edits.

UI screens used:

- Workbench

Engine interactions:

- None required on entry.
- Future analysis depends on stored `solverResults` or user-triggered runs.

State changes:

- Hydrates `ProjectContext.projectState`.
- Sets `activeMappingId` if missing.

## Flow 4: Configure Natural Hand Pose

Entry point: Workbench left panel, "Pose" tab

Steps:

1. The user switches from "Library" to "Pose".
2. The user enters pose edit mode.
3. The user selects a finger tool and assigns pads on the grid.
4. The user optionally adjusts preview offset and clears individual or all fingers.
5. The pose is normalized and stored back into `naturalHandPoses[0]`.

UI screens used:

- Workbench
- LayoutDesigner
- NaturalHandPosePanel

Engine interactions:

- No direct solver run is required.
- The pose later influences:
  - neutral pad overrides for solvers
  - pose-based seeding
  - natural assignment order

State changes:

- Updates `ProjectState.naturalHandPoses[0]`.

## Flow 5: Build a Mapping Manually

Entry point: Workbench with imported song state

Steps:

1. The user views unassigned voices in the library.
2. The user drags voices onto grid pads.
3. The user can move, swap, or unassign placed voices.
4. The user can rename voices, hide notes, or remove notes from the raw performance.
5. The mapping is updated with `layoutMode: 'manual'`.

UI screens used:

- Workbench
- VoiceLibrary
- LayoutDesigner

Engine interactions:

- No required engine call during drag-and-drop.
- Later analysis reads the resulting `GridMapping`.

State changes:

- Updates `GridMapping.cells`
- Updates `fingerConstraints` if locks move with sounds
- May update `parkedSounds`, `ignoredNoteNumbers`, or raw performance events

## Flow 6: Generate a Starting Mapping Automatically

Entry point: Workbench toolbar or settings menu

Variants:

1. `Seed`
   - Full deterministic coverage from Pose 0 anchors and note importance.
2. `Natural`
   - Places only unassigned voices, prioritizing Pose 0 pads first.
3. `Random`
   - Places unassigned voices onto empty pads randomly.
4. `Organize by 4x4 Banks`
   - Places sounds using Push-style quadrant logic.

UI screens used:

- Workbench
- LayoutDesigner

Engine interactions:

- `seedMappingFromPose0`
- `getPose0PadsWithOffset`
- `mapToQuadrants`

State changes:

- Creates or updates the active `GridMapping`
- Sets `layoutMode` to `optimized`, `manual`, `random`, or `auto` depending on path

## Flow 7: Run Analysis on the Current Mapping

Entry point: Workbench "Run Analysis"

Steps:

1. The user triggers analysis from the toolbar.
2. The workbench resolves the filtered active performance and the active mapping.
3. The selected solver runs, defaulting to beam unless advanced mode chooses genetic.
4. The result is stored in `solverResults` and may become `activeSolverId`.
5. The right analysis panel reflects the updated result.

UI screens used:

- Workbench
- AnalysisPanel

Engine interactions:

- `BiomechanicalSolver`
- `BeamSolver` or `GeneticSolver`
- optional neutral-pad override from Pose 0
- manual assignments passed into solver if present

State changes:

- Updates `ProjectState.solverResults`
- Updates `activeSolverId`

## Flow 8: Optimize the Layout

Entry point: Workbench "Auto-Arrange"

Steps:

1. The user clicks "Auto-Arrange".
2. The workbench checks that the active mapping exists and covers every note in the filtered performance.
3. The annealing solver mutates mappings and scores them with a fast beam evaluation loop.
4. The best mapping replaces the current mapping.
5. The annealing result is stored and can be viewed in analysis.

UI screens used:

- Workbench
- AnalysisPanel optimization tab

Engine interactions:

- `computeMappingCoverage`
- `AnnealingSolver`
- `BeamSolver` as layout evaluator

State changes:

- Rewrites the active `GridMapping`
- Updates mapping metadata such as `layoutMode`, `scoreCache`, `version`, `savedAt`
- Stores `solverResults['annealing']`

## Flow 9: Inspect the Chronological Result

Entry point: Workbench "Timeline View" or direct route `/timeline?songId=<id>`

Steps:

1. The route hydrates the song state.
2. The page resolves the active layout and active mapping.
3. Voices are converted into timeline lanes.
4. Finger labels are derived from the current engine result and displayed on note blocks.
5. The user scrubs or zooms the timeline for inspection.

UI screens used:

- Timeline page
- Timeline component

Engine interactions:

- No new solve.
- Reads `engineResult.debugEvents` to derive finger labels.

State changes:

- No domain-state mutation.
- Uses local UI state for `currentTime` and `zoom`.

## Flow 10: Deep-Dive Event and Transition Analysis

Entry point: Dashboard "Analyze", Workbench "Event Analysis", or direct route `/event-analysis?songId=<id>`

Steps:

1. The route hydrates the song state.
2. The page reads the active engine result and filtered performance.
3. Debug events are grouped into analyzed events.
4. Consecutive transitions are computed.
5. The onion-skin model is built for the selected event.
6. The user navigates via the timeline or event log.
7. The user can override hand/finger assignments for specific events.
8. The user can inspect practice-loop controls and export analysis JSON.

UI screens used:

- Event Analysis page
- EventTimelinePanel
- EventLogTable
- OnionSkinGrid
- TransitionMetricsPanel
- PracticeLoopControls

Engine interactions:

- `analyzeEvents`
- `analyzeAllTransitions`
- `buildOnionSkinModel`

State changes:

- Optional updates to `manualAssignments`
- Local UI state for selected event, left tab, and practice loop

## Flow 11: Save, Load, and Export

Entry point: Workbench header and Event Analysis export bar

Steps:

1. The user exports the current project as JSON, or loads a previously exported project file.
2. The loader validates the incoming project shape before replacing current state.
3. The user optionally exports event-analysis artifacts as separate JSON files.

UI screens used:

- Workbench
- Event Analysis page

Engine interactions:

- No solver required.

State changes:

- `saveProject` serializes current `ProjectState`
- `loadProject` may replace current `ProjectState`
- event-export paths produce files only

## Actual Recommended Flow Implied by Current Code

The codebase implicitly recommends this path:

1. Pick or create a song.
2. Link MIDI.
3. Open the workbench.
4. Define Pose 0 if personalization matters.
5. Use `Seed` or `Natural` to reach full mapping coverage.
6. Run analysis.
7. Use `Auto-Arrange` once a valid starting mapping exists.
8. Inspect timeline and event analysis for validation.
