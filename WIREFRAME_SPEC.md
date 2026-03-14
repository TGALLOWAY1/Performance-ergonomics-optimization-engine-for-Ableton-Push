# Wireframe Spec

## Scope

This spec describes structure only. It does not prescribe visual style, branding, or motion. Each screen description is grounded in the current repository behavior and should be treated as a layout-zone contract for future wireframing.

## Dashboard

Primary goal:

- Let the user manage songs and launch into editing or analysis.

### Layout zones

Zone A: Global header

- Product title
- short subtitle explaining the portfolio purpose
- utility icons or future account/settings placeholders

Zone B: Song portfolio grid

- repeating song cards
- each card should surface:
  - song title
  - BPM
  - MIDI-linked status
  - quick status badge
  - primary actions: Editor, Analyze
  - secondary actions: Link/Re-link MIDI, delete, rename

Zone C: Add-song card

- visually distinct from existing songs
- clear affordance for creating a new song container

Zone D: Optional footer utility strip

- currently empty in behavior
- can remain reserved for future global actions, but should not compete with the song grid

### Information hierarchy

1. Song identity and MIDI readiness
2. Primary next actions: open workbench or open analysis
3. Secondary metadata and maintenance actions

### Interaction notes

- The user should understand whether a song has MIDI linked before opening other screens.
- The card should make editing vs analysis feel like distinct destinations.

## Workbench

Primary goal:

- Let the user build, personalize, analyze, and optimize a mapping.

### Layout zones

Zone A: Global workspace header

- product title and workspace subtitle
- current song pill with autosave status
- route links to Dashboard, Timeline, Event Analysis, and Cost Debug
- theme toggle
- undo/redo
- save/load project controls
- settings menu for view and layout utilities

Zone B: Action toolbar

- clear grid
- Seed
- Natural
- Auto-Arrange
- Random
- Run Analysis
- advanced solver controls and result selector

This zone should read as the decision strip for "what happens next to the mapping."

Zone C: Left panel

- tab strip: Library | Pose

Library state:

- list of unassigned voices
- list of placed voices or detected notes as needed
- per-voice controls: edit, hide, delete
- destructive note deletion should be clearly separate from temporary hiding

Pose state:

- Pose 0 summary
- edit mode toggle
- finger palette
- preview offset
- clear/save actions

Zone D: Center editor canvas

- layout mode indicator
- large 8x8 pad grid as the main focal surface
- cells should support labels, heatmap overlays, lock indicators, and pose markers
- context menu and reachability overlay anchored to the grid
- finger legend under the grid

Zone E: Right analysis panel

- compact summary of current solver output
- tabs:
  - performance summary
  - model comparison
  - optimization process
- sound assignment table in summary state

### Information hierarchy

1. Current song and current mapping state
2. Primary mapping actions
3. Left panel as source material / personalization
4. Center grid as main authoring surface
5. Right panel as "read the result" companion

### Interaction notes

- The toolbar should distinguish:
  - authoring helpers that create coverage
  - analysis actions that score the current state
  - optimization actions that rewrite the mapping
- The grid is the dominant surface and should not be visually crowded by secondary panels.

## Event Analysis

Primary goal:

- Explain transition difficulty at the event level and allow manual event overrides.

### Layout zones

Zone A: Header

- back link to workbench
- page title
- song/performance identifier
- compact difficulty summary
- links back to Dashboard and Workbench

Zone B: Export bar

- Export Metrics
- Export Hard Transitions
- Export Loop Settings

Zone C: Left diagnostic column

- tab strip: Timeline | Event Log

Timeline state:

- ordered list of event transitions
- row shows:
  - event indices
  - timestamp
  - time delta
  - difficulty bar
  - quick hand/finger indicators

Event Log state:

- sortable event table
- per-event hand selector
- per-event finger selector
- cost column

Zone D: Center visualization column

- large onion-skin grid
- should dominate the screen after the left navigation column
- must communicate:
  - current event pads
  - next event pads
  - shared pads
  - movement vectors

Zone E: Right metrics column

- practice loop controls at the top
- transition metrics card below
- metrics include time delta, distance, speed pressure, stretch, composite score, and flags

### Information hierarchy

1. Which transition is selected
2. Spatial movement context on the onion-skin grid
3. Numeric explanation of difficulty
4. Manual override controls and exports

### Interaction notes

- Event selection should feel like the master control for the whole page.
- Event log reassignment is an editing action inside an otherwise diagnostic screen and should be visually separated from read-only metrics.

## Timeline

Primary goal:

- Show the mapped performance as a chronological lane chart for fast pattern inspection.

### Layout zones

Zone A: Header

- back link to workbench
- page title
- song identifier
- zoom slider

Zone B: Top ruler

- time ticks in seconds
- optional minor subdivisions when zoom allows

Zone C: Left lane label strip

- one row per mapped voice
- voice color marker
- voice name

Zone D: Main timeline canvas

- horizontal note blocks positioned by start time and duration
- vertical grid lines
- finger labels rendered on blocks when space permits
- now-bar / seek indicator

### Information hierarchy

1. Voice identity by row
2. Time position and clustering of notes
3. Finger labels as an overlay

### Interaction notes

- This is an inspection screen, not a mapping editor.
- Clicking the timeline should seek the cursor only; editing remains in the workbench.

## Cross-Screen Wireframe Rules

- Keep Dashboard focused on song selection and readiness.
- Keep Workbench focused on authoring and summary feedback.
- Keep Event Analysis focused on explanation and per-event override.
- Keep Timeline focused on chronology and pattern readability.
- Treat Cost Debug as a non-primary developer surface and exclude it from end-user wireframe priorities unless explicitly designing internal tools.
