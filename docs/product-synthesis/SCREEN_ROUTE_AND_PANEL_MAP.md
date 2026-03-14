# Screen, Route, and Panel Map

## Route Inventory

Current routed surfaces are defined in `src/main.tsx`.

| Route | Component | Current purpose | Availability |
|---|---|---|---|
| `/` | `Dashboard` | Song portfolio, song creation, MIDI linking, launch point into editing/analysis | always |
| `/workbench` | `Workbench` | Main layout-editing and analysis workbench | always |
| `/timeline` | `TimelinePage` | Chronological view of the mapped performance | always |
| `/event-analysis` | `EventAnalysisPage` | Event-by-event and transition analysis drill-down | always |
| `/cost-debug` | `CostDebugPage` | Diagnostic view for cost breakdown and annealing trace | development only |

## Likely Navigation Hierarchy

```text
Dashboard (/)
  -> Workbench (/workbench?songId=...)
    -> Timeline View (/timeline?songId=...)
    -> Event Analysis (/event-analysis?songId=...)
    -> Cost Debug (/cost-debug?songId=...) [dev only]

Event Analysis
  -> Back to Workbench
  -> Dashboard

Timeline
  -> Back to Workbench
  -> Dashboard

Cost Debug
  -> Workbench
  -> Timeline
  -> Event Analysis
  -> Dashboard
```

## Route-by-Route Map

### `/` - Dashboard

- Purpose
  - Manage the song portfolio and attach MIDI to song records.
- Key panels / regions
  - Header:
    - Product title `Performability Engine - Song Portfolio`
    - decorative profile/settings icons
  - Main grid:
    - `SongCard` list
    - `Add New Song` card
  - Footer:
    - currently visually present but functionally empty
- Inputs / actions
  - Create new empty song
  - Delete song
  - Link or re-link MIDI
  - Edit title and BPM inline
  - Open Workbench
  - Open Event Analysis
- Outputs / visualizations
  - Song cards with status badges
  - MIDI-linked indicator
  - Basic song metadata summary
- Related workflows
  - Song creation
  - MIDI linkage
  - Route entry into Workbench and Event Analysis
- Concerns
  - Empty-song flow creates a shell without teaching the next step.
  - Footer suggests room for actions, but is currently empty.
  - The portfolio data model is richer than the current UI.
- Primary evidence
  - `src/pages/Dashboard.tsx`
  - `src/components/dashboard/SongCard.tsx`

### `/workbench` - Workbench

- Purpose
  - The central editing and orchestration surface for mapping voices to pads, analyzing playability, and optimizing layouts.
- Major panels / regions
  - Top application header:
    - product title
    - current song indicator
    - links to Dashboard, Timeline View, Event Analysis, Cost Debug
    - settings menu
    - theme toggle
    - undo/redo
    - save/load project controls
  - Mid-level toolbar:
    - `Clear Grid`
    - `Seed`
    - `Natural`
    - `Auto-Arrange`
    - `Random`
    - `Run Analysis`
    - advanced solver controls when enabled
  - Main content left/center:
    - embedded `LayoutDesigner`
  - Main content right:
    - `AnalysisPanel`
- Inputs / actions
  - all core editing and analysis actions
  - route navigation to analysis drill-downs
- Outputs / visualizations
  - grid editor
  - voice library
  - pose editor
  - analysis summary/comparison/optimization views
- Related workflows
  - state hydration
  - mapping authoring
  - pose setup
  - solver execution
  - optimization
  - autosave/export
- Concerns
  - Very dense header and toolbar with mixed action priority.
  - Product language still says `Section Layout Optimizer` in the header subtitle, while current live flow is song/mapping centric.
- Primary evidence
  - `src/workbench/Workbench.tsx`

### Workbench Embedded Panel Map

#### Left embedded panel in Workbench: `LayoutDesigner` left column

- Purpose
  - Support authoring inputs that feed the current mapping.
- Top-level tabs
  - `Library`
  - `Pose`
- `Library` tab major subregions
  - header `Voice Library`
  - tabs:
    - `Detected`
    - `Unassigned`
    - `Placed`
- `Pose` tab major subregions
  - pose summary or edit panel
  - finger palettes
  - preview offset slider
  - save/clear pose actions
- Concerns
  - This panel is one of the strongest workflow hubs in the app.
  - It mixes harmless editing with destructive operations like event deletion.
- Primary evidence
  - `src/workbench/LayoutDesigner.tsx`
  - `src/workbench/VoiceLibrary.tsx`
  - `src/workbench/NaturalHandPosePanel.tsx`

#### Center embedded panel in Workbench: grid region

- Purpose
  - Directly edit and inspect the active mapping.
- Major subregions
  - floating layout mode indicator
  - 8x8 pad grid
  - finger legend below grid
  - context menu for pad actions
- Key controls/components
  - DnD-enabled pads
  - inline cell renaming
  - context actions:
    - show reach for L1
    - show reach for R1
    - assign finger locks
    - clear finger lock
    - remove sound
  - ghost pose markers during pose editing
- Outputs / visualizations
  - finger assignment color overlay
  - finger badge
  - note labels
  - position labels
  - pose markers
  - finger lock marker
- Concerns
  - Highly expressive, but some key interactions are hidden behind right-click.
- Primary evidence
  - `src/workbench/LayoutDesigner.tsx`

#### Right embedded panel in Workbench: `AnalysisPanel`

- Purpose
  - Provide summary and comparison views for the current analysis result.
- Tabs
  - `Performance Summary`
  - `Model Comparison` when advanced mode is on
  - `Optimization Process`
- Key contents
  - ergonomic score
  - total events
  - hand balance bar
  - cost-metric breakdown
  - finger assignments table
  - solver comparison table
  - evolution graph
  - annealing process graph and stats
- Concerns
  - Strong surface, but conceptually overlaps with Event Analysis.
- Primary evidence
  - `src/workbench/AnalysisPanel.tsx`

### `/timeline` - Timeline View

- Purpose
  - Show the mapped performance as a chronological strip of voices and events.
- Major panels / regions
  - Header:
    - back to Workbench
    - title
    - song chip
    - zoom slider
  - Main body:
    - `Timeline` component
- Inputs / actions
  - adjust zoom
  - click timeline to seek
- Outputs / visualizations
  - voice lanes
  - event blocks
  - optional finger labels over notes
  - current time indicator
- Related workflows
  - time-based inspection after mapping/analysis
- Concerns
  - Current screen is much narrower in scope than some repo docs imply.
  - It is a viewer, not a full practice or playback system.
- Primary evidence
  - `src/pages/TimelinePage.tsx`
  - `src/workbench/Timeline.tsx`

### `/event-analysis` - Event Analysis

- Purpose
  - Deep-dive into grouped events, transitions, and localized difficulty.
- Major panels / regions
  - Header:
    - back link
    - page title
    - performance name
    - score / hard / unplayable summary
    - links to Dashboard and Workbench
  - Export bar:
    - `Export Metrics`
    - `Export Hard Transitions`
    - `Export Loop Settings`
  - Main three-column layout:
    - left column:
      - `Timeline` tab
      - `Event Log` tab
    - center column:
      - `OnionSkinGrid`
    - right column:
      - `PracticeLoopControls`
      - `TransitionMetricsPanel`
- Inputs / actions
  - select transitions
  - keyboard up/down
  - toggle left-panel tab
  - modify manual hand/finger assignment from event log
  - start/stop practice loop stepping
  - export JSON
- Outputs / visualizations
  - transition heatmap list
  - per-note event log
  - onion-skin grid
  - transition metrics
  - event difficulty header summary
- Related workflows
  - transition investigation
  - manual override
  - analysis export
- Concerns
  - This page is the clearest "deep analysis" surface, but it partly duplicates Workbench analysis.
  - Practice is only visual stepping, not audio or MIDI playback.
- Primary evidence
  - `src/pages/EventAnalysisPage.tsx`
  - `src/workbench/EventAnalysisPanel.tsx`

### `/cost-debug` - Cost Debug

- Purpose
  - Developer-only inspection of cost breakdown and annealing trace data.
- Major panels / regions
  - Header with route links
  - mode selectors and sort controls
  - event list or annealing views
  - detail pane for selected event / metric
- Inputs / actions
  - choose sort mode
  - choose debug mode
  - select an event
- Outputs / visualizations
  - per-event cost breakdown
  - aggregate average cost breakdown
  - annealing trace or annealing metrics
- Related workflows
  - developer verification
  - debugging unexpected solver behavior
- Concerns
  - Valuable for internal validation, but not a normal end-user workflow.
- Primary evidence
  - `src/pages/CostDebugPage.tsx`

## Concept Redundancy Across Screens

| Concept | Where it appears | Notes |
|---|---|---|
| Current song context | Dashboard, Workbench header, Timeline header, Event Analysis header, Cost Debug header | Good continuity, but each screen expresses it slightly differently |
| Analysis summary | Workbench analysis panel, Event Analysis header, Cost Debug aggregate view | Different levels of detail but overlapping conceptual ownership |
| Finger assignment | Workbench grid overlay, Workbench assignments table, Timeline labels, Event log, Onion-skin vectors | Important concept, but repeated many times |
| Mapping identity | Workbench layout mode chip, settings duplicate layout, active mapping state | There is no strong page-level mapping identity artifact such as a mapping name/version chip in all routes |

## Page-Level Redundancies

1. Workbench and Event Analysis both behave like "analysis home" pages.
2. Timeline and Event Analysis are separate drill-downs, but both inspect time-ordered result behavior.
3. Cost Debug and Event Analysis both expose low-level consequence data for solver decisions, but with different audiences.

## Pages / Surfaces That Seem Overloaded

### Workbench

- Combines:
  - portfolio-level navigation
  - editing
  - pose personalization
  - optimization
  - solver comparison
  - persistence
  - route hub behavior
- This makes it powerful, but also the most cognitively dense screen.

### Event Analysis

- It is coherent internally, but it also absorbs:
  - event log editing
  - practice stepping
  - export tools
  - transition browsing
  - onion-skin visualization
- It is more of a "sub-workbench" than a narrow drill-down.

## Pages / Surfaces That Seem Underdefined

### Timeline

- The route exists and works, but it currently exposes a narrower value proposition than the rest of the product.
- It looks like a viewer, not a full practice mode.

### Dashboard

- The data model implies a stronger portfolio/practice-management role than the current UI fulfills.

## Workflow Hubs

The main workflow hubs in the current product are:

1. `src/pages/Dashboard.tsx`
   - entry and song selection hub
2. `src/workbench/Workbench.tsx`
   - main authoring and orchestration hub
3. `src/workbench/LayoutDesigner.tsx`
   - hands-on task execution hub
4. `src/workbench/EventAnalysisPanel.tsx`
   - deep inspection hub

