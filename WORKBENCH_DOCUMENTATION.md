# Workbench Component Documentation

## Workbench Orchestration

### Project Loading Lifecycle

• **URL Parameter Detection:**
  - Workbench reads `songId` from URL query parameters via `useSearchParams()`
  - Example: `/workbench?songId=abc123`

• **Load Prevention Logic:**
  - Uses refs (`hasAttemptedLoadRef`, `loadedSongIdRef`) to prevent double-loading the same song in one session
  - Checks `localStorage.getItem('workbench_current_song_id')` to detect if this is the same song as last time
  - Validates if current `projectState` has meaningful data:
    - `hasPerformanceEvents`: Any layout has performance events
    - `hasVoices`: `parkedSounds.length > 0`
    - `hasMappingCells`: Any mapping has assigned cells
  - Only loads if: different song OR same song but no real data (page refresh scenario)

• **Load Process (`useEffect` hook, lines 103-185):**
  1. Gets song metadata via `songService.getSong(songId)` for display name
  2. Calls `songService.loadSongState(songId)` to retrieve `ProjectState` from LocalStorage
  3. Calls `setProjectState(savedState, true)` with `skipHistory=true` (initial load doesn't go to undo stack)
  4. Sets `activeMappingId` to first mapping if available
  5. Sets `hasLoadedSong` flag to `true`
  6. Stores `songId` in `localStorage.setItem('workbench_current_song_id', songId)`

• **Auto-Save Mechanism (`useEffect` hook, lines 188-210):**
  - Watches `projectState`, `currentSongId`, and `hasLoadedSong`
  - Debounced save (1 second delay) to prevent excessive LocalStorage writes
  - Skips saving if:
    - No song loaded (`!currentSongId || !hasLoadedSong`)
    - Project state is empty (initial state)
  - Calls `songService.saveSongState(currentSongId, projectState)` after debounce
  - Clears timeout on unmount to prevent memory leaks

• **Unmount Save (`useEffect` hook, lines 236-243):**
  - Uses refs to capture current values in cleanup function
  - Immediately saves on component unmount (flushes pending debounced save)
  - Ensures no data loss when navigating away

### Reactive Solver Loop

• **Automatic Engine Execution (`useEffect` hook, lines 502-606):**
  - Watches dependencies: `activeMapping`, `activeLayout.performance.events`, `instrumentConfig`, `ignoredNoteNumbers`, `engineConfiguration`
  - 300ms debounce to prevent browser crashes during rapid drag operations
  - Process:
    1. Gets filtered performance via `getActivePerformance(projectState)` (excludes ignored notes)
    2. Retrieves manual assignments for current layout
    3. Creates `BiomechanicalSolver` with instrument config, mapping, and engine configuration
    4. Runs `solver.solve(filteredPerformance, parsedAssignments)`
    5. Calls `setEngineResult(result)` to update context
    6. Updates `scoreCache` in the active mapping
  - **Critical:** This runs automatically whenever layout changes, providing real-time feedback

• **Manual Solver Execution (`handleRunSolver`, lines 288-331):**
  - User-initiated via "Run Optimization" button
  - Supports progress tracking for genetic solver (simulated progress bar)
  - Calls `runSolver(selectedSolver, activeMapping)` from ProjectContext
  - Sets active solver ID after completion
  - Handles errors with user-friendly alerts

### Project Load Handler (`handleProjectLoad`, lines 341-471)

• **Purpose:** Unified handler for loading MIDI files (both default and user imports)

• **Process:**
  1. Parses MIDI file via `parseMidiFileToProject(file)` or `fetchMidiProject(url)`
  2. Extracts: performance events, instrument config, voices, grid mapping
  3. **HARD RESET:** Creates entirely new state (doesn't merge with existing):
     - New layout with imported performance
     - Replaces `instrumentConfigs` array
     - Replaces `mappings` array (with `layoutMode: 'none'` - empty grid)
     - Replaces `parkedSounds` array (ALL voices go to staging)
     - Resets `ignoredNoteNumbers` to empty
  4. Sets `activeLayoutId` to new layout
  5. Sets `activeMappingId` to new mapping
  6. Verifies engine works with new data (runs test solve)

• **Key Design:** Follows "Explicit Layout Model" - grid starts empty, users must explicitly assign sounds

### Component Props from ProjectContext

• **State Access:**
  - `projectState: ProjectState` - Complete project state
  - `engineResult: EngineResult | null` - Currently active engine result (derived from `solverResults[activeSolverId]`)

• **State Management:**
  - `setProjectState(state, skipHistory?)` - Updates state, optionally skipping history

• **Undo/Redo:**
  - `undo()`, `redo()`, `canUndo`, `canRedo` - History navigation

• **Solver Operations:**
  - `runSolver(solverType, activeMapping?)` - Runs biomechanical solver
  - `setActiveSolverId(solverId)` - Switches which result is visualized
  - `getSolverResult(solverId)` - Retrieves specific solver result
  - `optimizeLayout(activeMapping?)` - Layout optimization via Simulated Annealing
  - `setInitialStateFromNeutralPose(activeMapping?)` - Sets initial finger assignments

---

## Layout Editing Interactions

### Grid Rendering (LayoutDesigner Component)

• **Grid Structure:**
  - 8x8 grid (64 pads total)
  - Visual: Row 7 is top, Row 0 is bottom (inverted from logical indexing)
  - Each cell is a `DroppableCell` component that supports drag & drop

• **Cell Data Lookup:**
  - `getCellSound(row, col)` retrieves Voice from `activeMapping.cells[cellKey]`
  - `cellKey` format: `"row,col"` (e.g., `"0,0"` for bottom-left)

• **Heatmap Visualization:**
  - **Finger Assignment Map** (`fingerAssignmentMap`, lines 478-535):
    - Pre-computed `Map<noteNumber, {finger, hand, difficulty}>`
    - Priority: Manual assignments override engine results
    - Uses LAST occurrence of each note (so manual changes show up)
  - **Cell Coloring Priority:**
    1. **Finger colors** (if `heatmapFinger` and `heatmapHand` available) - Uses CSS variables `--finger-L1`, `--finger-R2`, etc.
    2. **Difficulty colors** (if difficulty but no finger) - Red (Unplayable), Orange (Hard), Yellow (Medium), Blue (Easy)
    3. **Default** - Neutral panel background
  - **Finger Badge:** Top-right corner shows `L1`, `R2`, etc. with finger color background

### Drag & Drop Interactions

• **Drag Sources:**
  - **From Library:** Dragging a Voice from `VoiceLibrary` (staging area)
  - **From Grid:** Dragging an already-placed Voice to move it

• **Drop Targets:**
  - **Grid Cell:** Assigns Voice to that pad
  - **Staging Area:** Removes Voice from grid, returns to library

• **Drag Handlers (`handleDragStart`, `handleDragOver`, `handleDragEnd`, lines 573-754):**

  - **`handleDragStart`:**
    - Sets `activeId` and `draggedSound` state
    - Determines if dragging from cell or library
    - Prepares drag overlay preview

  - **`handleDragOver`:**
    - Updates `overId` to highlight drop target
    - Provides visual feedback during drag

  - **`handleDragEnd`:**
    - **Scenario A (New Placement):** Dragging from library → grid cell
      - Calls `onAssignSound(targetCellKey, sound)`
      - Sets `layoutMode: 'manual'` if mapping didn't exist
    - **Scenario B (Move/Swap):** Dragging from grid → grid cell
      - If target empty: Move sound to new position
      - If target occupied: Swap the two sounds
      - Updates finger constraints if they exist (moves constraints with sounds)
      - Calls `onUpdateMapping({ cells: newCells, fingerConstraints: newFingerConstraints })`
    - **Scenario C (Unassign):** Dragging from grid → staging area
      - Calls `onRemoveSound(sourceCellKey)`
      - Adds sound back to `parkedSounds` if not already there

• **Drag Sensors Configuration:**
  - Uses `@dnd-kit/core` with `PointerSensor` and `KeyboardSensor`
  - Activation constraint: 5px movement required (prevents accidental drags on clicks)
  - Allows normal clicks for selection

### Click Interactions

• **Cell Click (`handleCellClick`, lines 893-905):**
  - Selects the sound at that cell
  - Sets `selectedCellKey` state
  - Deselects if clicking empty cell

• **Cell Double-Click (`handleCellDoubleClick`, lines 908-920):**
  - Enters edit mode for sound name
  - Focuses name input field

• **Context Menu (Right-Click, lines 923-1517):**
  - Shows menu with options:
    - **Reachability Visualization:** Show reach zones for L1/R1 fingers
    - **Finger Constraint Assignment:** Lock pad to specific finger (L1-L5, R1-R5)
    - **Remove Sound:** Unassign voice from pad
  - Updates `fingerConstraints` in mapping when assigning locks

### Sound Assignment Handlers

• **`handleAssignSound(cellKey, sound)` (lines 662-697):**
  - Assigns single Voice to single Pad
  - Creates new mapping if none exists (with `layoutMode: 'manual'`)
  - Updates existing mapping if active mapping exists
  - Sets `layoutMode: 'manual'` when user modifies layout

• **`handleAssignSounds(assignments)` (lines 699-732):**
  - Batch assignment of multiple Voices to Pads
  - Used by auto-layout functions (quadrants, random placement)

• **`handleUpdateMapping(updates)` (lines 734-744):**
  - Updates mapping metadata (name, notes, cells, fingerConstraints)
  - Preserves mapping ID and other fields

• **`handleRemoveSound(cellKey)` (lines 924-939):**
  - Removes Voice assignment from pad
  - Updates mapping cells object

### Explicit Layout Controls

• **Auto-Assign Random (`handleAutoAssignRandom`, lines 1019-1076):**
  - Maps all unassigned Voices to empty Pads using random placement
  - Does NOT move already-assigned pads
  - Sets `layoutMode: 'random'`
  - Shuffles both voices and empty pads for randomness

• **Map to Quadrants (`handleMapToQuadrants`, lines 783-847):**
  - Uses `mapToQuadrants()` utility to organize sounds into 4x4 banks
  - Sets `layoutMode: 'auto'`
  - Only works with sounds that have `originalMidiNote` set

• **Optimize Layout (`handleOptimizeLayout`, lines 981-1017):**
  - Calls `optimizeLayout(activeMapping)` from ProjectContext
  - Runs Simulated Annealing solver
  - **Overwrites** current layout with optimized result
  - Sets `layoutMode: 'optimized'`

• **Clear Grid (`handleClearGrid`, lines 797-824):**
  - Removes all pad assignments
  - Moves all sounds back to staging area
  - Sets `layoutMode: 'none'`

• **Save Layout Version (`handleSaveLayoutVersion`, lines 1058-1094):**
  - Increments version number
  - Sets `savedAt` timestamp
  - Autosave mechanism persists to LocalStorage

### LayoutDesigner Props

• **Core Props:**
  - `parkedSounds: Voice[]` - Staging area voices
  - `activeMapping: GridMapping | null` - Currently edited mapping
  - `instrumentConfig: InstrumentConfig | null` - Voice-to-Pad mapping config
  - `engineResult: EngineResult | null` - Engine analysis result (from reactive loop)

• **Assignment Callbacks:**
  - `onAssignSound(cellKey, sound)` - Single assignment
  - `onAssignSounds(assignments)` - Batch assignment
  - `onUpdateMapping(updates)` - Update mapping metadata
  - `onRemoveSound(cellKey)` - Remove assignment

• **View Settings:**
  - `showNoteLabels?: boolean` - Show MIDI note numbers on pads
  - `showPositionLabels?: boolean` - Show row,col coordinates
  - `showHeatmap?: boolean` - Show finger assignment colors

• **Project State:**
  - `projectState: ProjectState` - Full project state (for voice visibility, manual assignments)
  - `activeLayout: LayoutSnapshot | null` - Active layout snapshot

---

## AnalysisPanel Visualizations

### Component Props

• **`engineResult: EngineResult | null`**
  - Currently active engine result from ProjectContext
  - Derived from `solverResults[activeSolverId]` or legacy state

• **`activeMapping: GridMapping | null`**
  - Active grid mapping (for sound assignment table)

• **`performance: Performance | null`**
  - Filtered performance data (excludes ignored notes)

• **`onAssignmentChange(index, hand, finger)`**
  - Callback to update manual finger assignments
  - Updates `projectState.manualAssignments[currentLayoutId][eventIndex]`

### Tab Structure

• **Three Tabs:**
  1. **Performance Summary** (default) - Overall metrics and event log
  2. **Model Comparison** - Compare Beam Search vs Genetic Algorithm results
  3. **Optimization Process** - Simulated Annealing visualization

### Difficulty / Heatmaps

• **Grid Cell Heatmap (LayoutDesigner):**
  - **Data Source:** `fingerAssignmentMap` computed from `engineResult.debugEvents`
  - **Priority System:**
    1. Manual assignments (from `projectState.manualAssignments`) take highest priority
    2. Engine results for notes without manual assignments
    3. Uses LAST occurrence of each note (so manual changes override)
  - **Visual Encoding:**
    - **Finger colors:** CSS variables `--finger-L1` through `--finger-R5` (matches FingerLegend)
    - **Difficulty fallback:** Red (Unplayable), Orange (Hard), Yellow (Medium), Blue (Easy)
    - **Finger badge:** Top-right corner shows `L1`, `R2`, etc. with colored background
    - **Border/glow:** Finger color applied to cell border when finger assigned

• **Heatmap Computation (`fingerAssignmentMap`, LayoutDesigner lines 478-535):**
  - Creates `Map<noteNumber, {finger, hand, difficulty}>`
  - Processes manual assignments first (override engine)
  - Then processes engine results for remaining notes
  - Only includes playable events (`assignedHand !== 'Unplayable'`)

### Event Logs

• **EventLogTable Component (`EventLogTable.tsx`):**
  - **Props:**
    - `events: EngineDebugEvent[]` - All debug events from `engineResult.debugEvents`
    - `onAssignmentChange(index, hand, finger)` - Manual assignment callback

• **Table Columns:**
  - **#** - Event index (1-based)
  - **Time** - `startTime` in seconds (formatted to 2 decimals)
  - **Note** - MIDI note number (`noteNumber`)
  - **Hand** - Dropdown selector (Left/Right) - editable
  - **Finger** - Dropdown selector (Thumb, Index, Middle, Ring, Pinky) - editable
  - **Cost** - Total cost (color-coded: green < 5, yellow 5-10, red > 10, ∞ for Unplayable)

• **Visual Features:**
  - **Difficulty Highlighting:** Hard events have red background tint (`bg-red-500/10`)
  - **Editable Assignments:** Hand and Finger dropdowns allow manual overrides
  - **Cost Color Coding:** Visual feedback for difficulty
  - **Scrollable:** Virtual scrolling for large event lists

• **Manual Assignment Flow:**
  1. User changes Hand or Finger dropdown in table
  2. Calls `onAssignmentChange(eventIndex, hand, finger)`
  3. Workbench updates `projectState.manualAssignments[currentLayoutId][eventIndex]`
  4. Reactive solver loop re-runs engine (respects manual assignments as constraints)
  5. Grid heatmap updates to show manual assignments (they take priority)

### Sound Assignments / Finger Distributions

• **SoundAssignmentTable Component (`SoundAssignmentTable.tsx`):**
  - **Purpose:** Shows which Voices are assigned to which Pads and which fingers play them

• **Data Building (`assignmentData`, lines 123-204):**
  1. Iterates through `activeMapping.cells` to get all pad assignments
  2. For each Voice, looks up its `originalMidiNote`
  3. Builds `noteToFingerMap` from `engineResult.debugEvents`:
     - Groups events by `noteNumber`
     - Tracks frequency of each `hand + finger` combination
     - Finds most common assignment for each note
  4. Creates table rows with:
     - Sound name (editable, double-click to rename)
     - Pad location `[row,col]`
     - Assigned finger (e.g., "L-Thumb", "R-Index", or "—" if unplayable)

• **Table Columns:**
  - **Sound** - Voice name with color indicator (editable via double-click)
  - **Pad** - Grid coordinates `[row,col]` (monospace font)
  - **Finger** - Most common finger assignment (color-coded: blue for Left, green for Right)

• **Visual Features:**
  - **Color Coding:** Left hand = blue (`text-blue-300 bg-blue-900/30`), Right hand = green (`text-green-300 bg-green-900/30`)
  - **Editable Names:** Double-click sound name to rename (updates Voice in mapping)
  - **Sorted Display:** Rows sorted by row (descending, top first), then column (ascending)
  - **Empty States:** Shows helpful messages when no mapping or no sounds assigned

• **Finger Usage Statistics:**
  - **Source:** `engineResult.fingerUsageStats` (e.g., `{"L-Thumb": 5, "R-Index": 12, ...}`)
  - **Display:** Used in Performance Summary tab for hand balance visualization
  - **Hand Balance Bar:** Shows percentage split between left/right hands
    - Left hand: Blue bar (`bg-[var(--finger-L2)]`)
    - Right hand: Green bar (`bg-[var(--finger-R2)]`)
    - Calculated from finger usage stats

### Performance Summary Tab

• **Summary Stats (`stats`, lines 33-57):**
  - **Ergonomic Score:** `engineResult.score` (0-100)
  - **Total Events:** `performance.events.length`
  - **Hand Balance:** Calculated from `fingerUsageStats`
    - Counts events per hand (L-* vs R-* keys)
    - Calculates percentages
    - Displays as horizontal bar chart

• **Cost Metrics Breakdown:**
  - **Source:** `engineResult.averageMetrics` (CostBreakdown)
  - **Display:** Grid of 6 metrics:
    - Movement (blue color)
    - Stretch (pinky color)
    - Drift (right hand color)
    - Bounce (warning color)
    - Fatigue (ring finger color)
    - Crossover (left hand color)
  - **Format:** Label + value (monospace, color-coded)

### Model Comparison Tab

• **Comparison Metrics (`comparisonMetrics`, lines 60-105):**
  - Compares Beam Search vs Genetic Algorithm results
  - Uses `getSolverResult('beam')` and `getSolverResult('genetic')` from ProjectContext
  - Metrics:
    - Total Cost (average cost × event count)
    - Left/Right Hand Balance (percentages)
    - Fatigue Score (sum of all finger fatigue values)

• **Evolution Graph (Genetic Algorithm):**
  - **Data:** `geneticResult.evolutionLog` (array of `EvolutionLogEntry`)
  - **Visualization:** SVG line chart showing:
    - Best cost line (blue, solid)
    - Average cost line (gray, semi-transparent)
    - Beam Search reference line (dashed, for comparison)
  - **Axes:** Generation (X), Cost (Y)
  - **Legend:** Shows all three lines with labels

### Optimization Process Tab

• **Annealing Process Graph:**
  - **Data:** `annealingResult.optimizationLog` (array of iteration snapshots)
  - **Visualization:** Dual Y-axis SVG chart:
    - **Left Y-axis:** Cost (blue line, noisy at start, smooths out)
    - **Right Y-axis:** Temperature (orange line, smooth decay)
    - **X-axis:** Iteration step
  - **Features:**
    - Temperature area (filled, semi-transparent orange)
    - Cost data points (colored by acceptance: blue if accepted, gray if rejected)
    - Grid lines for both axes
    - Legend explaining both lines

• **Optimization Statistics:**
  - **Initial Cost:** First iteration cost
  - **Final Cost:** Last iteration cost
  - **Improvement:** Percentage reduction
  - **Acceptance Rate:** Percentage of accepted moves

### Connection to ProjectContext

• **Data Flow:**
  1. Workbench reactive solver loop generates `engineResult`
  2. `engineResult` stored in `projectState.solverResults[solverType]`
  3. `activeSolverId` determines which result is active
  4. `engineResult` prop passed to AnalysisPanel (derived from `solverResults[activeSolverId]`)
  5. AnalysisPanel visualizes all metrics from `EngineResult` structure

• **Manual Assignment Updates:**
  1. User edits assignment in EventLogTable
  2. Calls `onAssignmentChange(index, hand, finger)`
  3. Workbench updates `projectState.manualAssignments[currentLayoutId][eventIndex]`
  4. Reactive solver loop detects change (watches `projectState`)
  5. Re-runs engine with manual assignments as constraints
  6. New `engineResult` generated and visualized

---

## Summary

The Workbench orchestrates the entire editing experience:
- **Lifecycle:** Loads songs from LocalStorage, auto-saves changes, prevents double-loading
- **Reactive Engine:** Automatically re-runs solver when layout changes (300ms debounce)
- **Layout Editing:** Drag & drop, click handlers, explicit layout controls (random, optimize, clear)
- **Visualization:** Grid heatmaps show finger assignments with priority system (manual > engine)
- **Analysis:** AnalysisPanel provides three tabs with comprehensive metrics, event logs, and finger distributions

All components connect to ProjectContext for state management, and the reactive solver loop ensures real-time feedback as users edit layouts.

