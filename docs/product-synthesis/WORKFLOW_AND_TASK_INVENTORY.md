# Workflow and Task Inventory

## Workflow Map At A Glance

```text
Dashboard
  -> Create song
  -> Link MIDI
  -> Open Workbench

Workbench
  -> Review imported voices / empty grid
  -> Configure Natural Hand Pose (optional in UX, important in code)
  -> Place voices manually or via Seed / Natural / Random
  -> Run Analysis
  -> Auto-Arrange
  -> Iterate / save / export

Drill-downs
  -> Timeline View
  -> Event Analysis
  -> Cost Debug (dev only)
```

## Workflow 1: Create or Select a Song Container

### Core task

Create a song record or choose an existing one as the container for a performance-specific project state.

### Entry points

- Dashboard grid on `/`
- Add New Song card in `src/pages/Dashboard.tsx`
- Existing `SongCard` components

### Prerequisite state/data

- None for creating a new empty song
- Existing `Song` data in localStorage for selecting a saved one

### Inputs required

- For empty song creation:
  - none beyond default values
- For existing song selection:
  - selected song ID

### Main actions

1. Open Dashboard.
2. Click an existing song card's `Editor` or `Analyze` action, or create a new song.

### Outputs generated

- New `Song` metadata entry, if created
- Route transition to Workbench or Event Analysis, if selected

### User decisions

- Which song to work on
- Whether to create a new shell before linking MIDI

### What the system computes or visualizes

- Song cards with title, BPM, status badge, MIDI-link indicator
- Implicit per-song storage lookup

### Success condition

- The user has a song context selected

### Failure / confusion points

- Empty-song creation does not immediately guide the user to link MIDI.
- Status badges imply practice semantics, but the main workflow after that is still mapping/analysis.

### Files / routes / components involved

- `/`
- `src/pages/Dashboard.tsx`
- `src/components/dashboard/SongCard.tsx`
- `src/services/SongService.ts`

## Workflow 2: Link MIDI to a Song

### Core task

Attach a MIDI file to a song so the system can derive a performance, voices, and initial project state.

### Entry points

- `Link MIDI` / `Re-link` control on each `SongCard`

### Prerequisite state/data

- A song must already exist

### Inputs required

- MIDI file chosen by the user

### Main actions

1. Click `Link MIDI` or `Re-link`.
2. Choose a `.mid` or `.midi` file.
3. Wait for parse and local persistence.

### Outputs generated

- Base64 MIDI stored in `Song`
- `ProjectState` saved under `Song.projectStateId`
- Imported `Performance`
- `Voice[]`
- Empty `GridMapping`
- Default `NaturalHandPose`

### User decisions

- Which MIDI file belongs to which song

### What the system computes or visualizes

- MIDI parsing into note events
- Voice extraction from unique note numbers
- Bottom-left note adjustment
- Key inference heuristic
- Duration inference
- MIDI-linked badge on Dashboard

### Success condition

- The song has a linked MIDI file and loadable project state

### Failure / confusion points

- Re-linking effectively rebuilds project state from MIDI, which may overwrite previous mapping work.
- Import summary is not surfaced to the user; warnings such as out-of-range notes remain largely internal.

### Files / routes / components involved

- `/`
- `src/components/dashboard/SongCard.tsx`
- `src/pages/Dashboard.tsx:handleMidiLinked`
- `src/services/SongService.ts:linkMidiToSong`
- `src/utils/midiImport.ts`

## Workflow 3: Hydrate Song State Into the Workbench

### Core task

Load the selected song's stored project state into the global project context.

### Entry points

- Workbench route `/workbench?songId=...`
- Timeline route `/timeline?songId=...`
- Event Analysis route `/event-analysis?songId=...`

### Prerequisite state/data

- A valid `songId`
- Saved project state in localStorage, or seeded default test song

### Inputs required

- Query param `songId`

### Main actions

1. Route loads with `songId`.
2. `useSongStateHydration(songId)` checks current in-memory data and localStorage.
3. If needed, it loads saved state and calls `setProjectState(savedState, true)`.

### Outputs generated

- Global `ProjectState` hydrated into `ProjectContext`
- `songName` metadata for page headers

### User decisions

- None during hydration

### What the system computes or visualizes

- Determines whether current context already has "real data"
- Sets default `activeMappingId` if missing

### Success condition

- Workbench or analysis page reflects the selected song's actual saved state

### Failure / confusion points

- Hydration is implicit.
- If the stored project state was built from an empty or stale song shell, routed pages may land in a "no MIDI data" state.

### Files / routes / components involved

- `src/hooks/useSongStateHydration.ts`
- `src/context/ProjectContext.tsx`
- `src/services/SongService.ts:loadSongState`

## Workflow 4: Review Imported Material and Understand Initial State

### Core task

See what the imported MIDI produced and understand what needs to happen next.

### Entry points

- Workbench after hydration

### Prerequisite state/data

- Imported performance and voices

### Inputs required

- None

### Main actions

1. Enter the Workbench.
2. Review `Voice Library` tabs:
   - `Detected`
   - `Unassigned`
   - `Placed`
3. Observe the grid state and layout mode.

### Outputs generated

- None; this is mainly orientation

### User decisions

- Whether to edit Pose first, drag manually, seed, use Natural, or optimize

### What the system computes or visualizes

- Empty grid after import
- Voice counts in staging and detected-note list
- Layout mode chip (`No Layout`)

### Success condition

- The user understands the imported material well enough to begin placing voices

### Failure / confusion points

- The repo intentionally uses an explicit empty-grid model, but the UI does not strongly teach that model.
- Multiple next-step actions are available immediately.

### Files / routes / components involved

- `/workbench`
- `src/workbench/Workbench.tsx`
- `src/workbench/LayoutDesigner.tsx`
- `src/workbench/VoiceLibrary.tsx`
- `src/utils/midiImport.ts`

## Workflow 5: Configure Natural Hand Pose

### Core task

Define where each finger naturally rests so the system can seed and evaluate layouts using a personalized baseline.

### Entry points

- Workbench left panel `Pose` tab

### Prerequisite state/data

- A current project state

### Inputs required

- Finger selections
- Pad clicks on the grid
- Optional preview offset changes

### Main actions

1. Open `Pose` tab.
2. Enter edit mode.
3. Select a finger with click or keyboard shortcut.
4. Click pads on the grid to assign each finger.
5. Optionally preview a vertical offset.
6. Save and normalize pose.

### Outputs generated

- Updated `naturalHandPoses[0]`

### User decisions

- Which pads represent natural hand placement
- Whether to use a lower or higher offset preview

### What the system computes or visualizes

- Assignment count
- Safe offset range
- Ghost markers on the grid
- Validation against duplicate or off-grid assignments

### Success condition

- Pose 0 is saved and can be reused by later layout-generation actions

### Failure / confusion points

- The feature is well-developed, but its strategic importance is only implied.
- Users may not understand that `Natural`, `Seed`, solver neutral positions, and `Auto-Arrange` all depend on this pose.

### Files / routes / components involved

- `/workbench`
- `src/workbench/NaturalHandPosePanel.tsx`
- `src/workbench/LayoutDesigner.tsx`
- `src/types/naturalHandPose.ts`
- `src/engine/handPose.ts`

## Workflow 6: Build a Mapping Manually

### Core task

Place voices on pads by hand and refine their placement iteratively.

### Entry points

- Workbench library and grid

### Prerequisite state/data

- Voices in staging or already placed
- Active mapping

### Inputs required

- Drag/drop actions
- Optional renames, recolors, visibility toggles, finger locks

### Main actions

1. Drag voices from `Unassigned` to pads.
2. Move or swap placed voices as needed.
3. Rename/recolor voices if helpful.
4. Hide some notes from analysis if desired.
5. Apply finger locks or reachability inspection via context menu.

### Outputs generated

- Updated `GridMapping.cells`
- Updated `layoutMode='manual'`
- Possible updates to `fingerConstraints`, `ignoredNoteNumbers`, and voice metadata

### User decisions

- Which voice belongs on which pad
- Which notes to hide
- Which pads require finger locks

### What the system computes or visualizes

- Drag targets
- Selected pad state
- Context menu options
- Finger-color overlays if analysis exists

### Success condition

- The user has a coherent mapping they want to analyze or optimize

### Failure / confusion points

- There are several edit surfaces for the same underlying voice data.
- Hidden actions such as finger locks and reachability are powerful but not discoverable.
- Visibility toggling and destructive event deletion live in the same library region, which can cause caution or confusion.

### Files / routes / components involved

- `/workbench`
- `src/workbench/LayoutDesigner.tsx`
- `src/workbench/VoiceLibrary.tsx`
- `src/workbench/Workbench.tsx`

## Workflow 7: Generate a Starting Mapping Automatically

### Core task

Use a helper rather than full manual placement to get to a workable starting layout.

### Entry points

- Workbench toolbar
- Workbench settings menu

### Prerequisite state/data

- Imported performance
- Active mapping
- Sometimes a valid natural hand pose

### Inputs required

- Chosen helper action:
  - `Seed`
  - `Natural`
  - `Random`
  - `Organize by 4x4 Banks`

### Main actions

1. Choose the helper mode.
2. System assigns voices according to that helper's rule set.

### Outputs generated

- Updated `GridMapping.cells`
- Updated `layoutMode`

### User decisions

- Which assignment strategy to trust as a starting point

### What the system computes or visualizes

- `Seed`:
  - full-coverage mapping driven by note frequency and pose anchor pads
- `Natural`:
  - fills pose pads first, then remaining pads deterministically
- `Random`:
  - random placement of unassigned voices only
- `Organize by 4x4 Banks`:
  - quadrant-based placement driven by note ranges

### Success condition

- The user gets a mapping they can inspect or refine

### Failure / confusion points

- The semantic differences between these helper actions are not strongly explained in UI copy.
- `Seed` is especially important because it guarantees coverage for later optimization, but that is not obvious until optimization fails without it.

### Files / routes / components involved

- `src/workbench/Workbench.tsx`
- `src/engine/seedMappingFromPose0.ts`
- `src/utils/autoLayout.ts`
- `src/types/naturalHandPose.ts`

## Workflow 8: Run Analysis on the Current Mapping

### Core task

Evaluate the current mapping's playability.

### Entry points

- Workbench toolbar `Run Analysis`

### Prerequisite state/data

- Active performance
- Optional active mapping

### Inputs required

- Solver choice when advanced mode is on

### Main actions

1. Click `Run Analysis`.
2. Optionally choose `beam` or `genetic`.
3. Review results in the right-hand analysis panel.

### Outputs generated

- `EngineResult`
- Stored solver result under `solverResults[solverType]`
- `activeSolverId`

### User decisions

- Whether to use only default beam analysis or compare solver families

### What the system computes or visualizes

- Ergonomic score
- Hand balance
- Average cost components
- Finger usage
- Optional solver comparison graphs

### Success condition

- User can interpret whether the mapping is acceptable, hard, or poor

### Failure / confusion points

- The button says `Run Analysis`, but the product also has layout optimization and several analysis routes.
- Advanced comparison is powerful but niche.

### Files / routes / components involved

- `/workbench`
- `src/workbench/Workbench.tsx`
- `src/context/ProjectContext.tsx:runSolver`
- `src/workbench/AnalysisPanel.tsx`

## Workflow 9: Optimize the Mapping

### Core task

Have the system rearrange the layout to reduce ergonomic cost.

### Entry points

- Workbench toolbar `Auto-Arrange`

### Prerequisite state/data

- Active mapping
- Assigned sounds on the grid
- Performance data
- Full note coverage

### Inputs required

- Current mapping and performance

### Main actions

1. Click `Auto-Arrange`.
2. System validates there is performance data, placed sounds, and full coverage.
3. Annealing solver runs.
4. Best mapping overwrites the current mapping.

### Outputs generated

- Updated mapping cells
- `layoutMode='optimized'`
- incremented `version`
- `savedAt`
- annealing result stored under `solverResults['annealing']`

### User decisions

- Whether the current layout is ready for optimization

### What the system computes or visualizes

- Best mapping found by annealing
- Optimization trace and stats in analysis panel

### Success condition

- User receives a new optimized layout and can assess it

### Failure / confusion points

- Optimization overwrites the mapping in place.
- Product protects against incomplete coverage, but only after the user attempts the action.
- Users may not understand whether optimization respects Pose 0. In code, it does.

### Files / routes / components involved

- `/workbench`
- `src/workbench/Workbench.tsx:handleOptimizeLayout`
- `src/context/ProjectContext.tsx:optimizeLayout`
- `src/engine/mappingCoverage.ts`
- `src/engine/solvers/AnnealingSolver.ts`

## Workflow 10: Inspect the Result Through Timeline View

### Core task

See the mapped performance in chronological form.

### Entry points

- Workbench header link `Timeline View`
- direct route `/timeline?songId=...`

### Prerequisite state/data

- Hydrated project state
- Active layout and mapping

### Inputs required

- Optional zoom changes
- click-to-seek on the timeline

### Main actions

1. Open timeline route.
2. Adjust zoom.
3. Inspect voice lanes and finger labels.
4. Click to seek current time marker.

### Outputs generated

- None persisted

### User decisions

- Which zoom level to use
- Which time region to inspect

### What the system computes or visualizes

- Voices extracted from active mapping
- Finger labels derived from `engineResult.debugEvents`
- Chronological lane rendering of events

### Success condition

- User can understand sequence, density, and finger labeling over time

### Failure / confusion points

- Finger labels are a derived overlay and may be fragile if analysis state and performance filtering diverge.
- Current route is simpler than some older docs imply; it is more an inspection view than a practice mode.

### Files / routes / components involved

- `/timeline`
- `src/pages/TimelinePage.tsx`
- `src/workbench/Timeline.tsx`

## Workflow 11: Deep-Dive Event and Transition Analysis

### Core task

Inspect difficult moments and transitions in detail.

### Entry points

- Song card `Analyze`
- Workbench header `Event Analysis`
- direct route `/event-analysis?songId=...`

### Prerequisite state/data

- Hydrated project state
- Available `engineResult`
- Performance events

### Inputs required

- Transition selection
- Optional keyboard up/down navigation
- Optional manual hand/finger override from event log

### Main actions

1. Open Event Analysis.
2. Select a transition in the left panel.
3. Observe onion-skin grid and transition metrics.
4. Optionally switch to event log and edit assignments.
5. Optionally use practice-loop stepping.
6. Optionally export JSON artifacts.

### Outputs generated

- Optional updated `manualAssignments`
- Optional exported JSON files

### User decisions

- Which transition to focus on
- Whether to override a hand/finger choice
- Whether to export detailed analysis

### What the system computes or visualizes

- Grouped events via `analyzeEvents`
- Transitions via `analyzeAllTransitions`
- Onion-skin model via `buildOnionSkinModel`
- Difficulty summary in header

### Success condition

- User can identify and reason about hard event-to-event movements

### Failure / confusion points

- This route overlaps conceptually with Workbench analysis and Timeline.
- Practice loop implies rehearsal support but currently only flips selection index on a timer.

### Files / routes / components involved

- `/event-analysis`
- `src/pages/EventAnalysisPage.tsx`
- `src/workbench/EventAnalysisPanel.tsx`
- `src/engine/eventMetrics.ts`
- `src/engine/transitionAnalyzer.ts`
- `src/engine/onionSkinBuilder.ts`

## Workflow 12: Save, Load, and Export

### Core task

Preserve or move the current project or analysis artifacts.

### Entry points

- Workbench header `Save Project`
- Workbench header `Load`
- Event-analysis export buttons

### Prerequisite state/data

- Existing project state for save/export
- Valid JSON file for load

### Inputs required

- JSON file for project load

### Main actions

1. Save full project as JSON, or let autosave persist locally.
2. Load project JSON when desired.
3. Export event-analysis JSON artifacts from Event Analysis.

### Outputs generated

- `project.json`
- event metrics JSON
- hard transitions JSON
- practice loop settings JSON

### User decisions

- Whether they want portable project state or song-local autosave only
- Which analysis artifact to export

### What the system computes or visualizes

- Strict validation for portable project import
- Lenient validation for localStorage hydration

### Success condition

- User can recover, move, or inspect work outside the app

### Failure / confusion points

- The app uses multiple persistence modes without a unified mental model.
- Project export/import and analysis export are separate, but this is not framed as a coherent artifact system.

### Files / routes / components involved

- `src/workbench/Workbench.tsx`
- `src/utils/projectPersistence.ts`
- `src/workbench/EventAnalysisPanel.tsx`
- `src/utils/eventExport.ts`

## Workflow Duplication / Reconnection Notes

### Where workflows duplicate each other

- Analysis summary exists in Workbench and again in Event Analysis.
- Timeline is a separate route rather than a drill-down embedded in a single analysis hierarchy.
- Voice editing can happen in grid cells, staged list items, and placed list items.

### Where workflows reconnect

- Event Analysis and Timeline both depend on the same hydrated `ProjectState` and current `engineResult`.
- Most routes reconnect through `songId` and `useSongStateHydration`.
- Workbench remains the main source of authoring changes even when analysis routes are used for inspection.

### Where workflows are incomplete, confusing, or dead-ended

- New empty song -> no immediate guidance to link MIDI.
- Event-analysis practice loop -> no real playback.
- Template-driven or section-driven workflows -> implied by models, not live in routed UX.
- Direct import of new song from MIDI -> implemented in service, not exposed in current Dashboard UI.

