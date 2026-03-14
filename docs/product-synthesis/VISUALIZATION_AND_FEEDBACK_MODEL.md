# Visualization and Feedback Model

## Purpose

This document describes how the current product communicates system state, playability, difficulty, and editing consequences to the user. It focuses on user-facing feedback loops, not internal rendering mechanics.

## High-Level Feedback Pattern

The current product communicates through a layered feedback stack:

1. Structural state:
   - which song is loaded
   - whether MIDI is linked
   - whether a mapping exists
2. Mapping state:
   - which voices are unassigned, placed, hidden, or locked
3. Analysis state:
   - ergonomic score
   - finger assignments
   - cost breakdowns
   - hard/unplayable counts
4. Temporal state:
   - timeline ordering
   - event transitions
   - onion-skin before/after context
5. Optimization state:
   - layout mode
   - solver comparison
   - annealing progress

## Dashboard Feedback

### Visual signals used

| Signal | What it tells the user | Evidence |
|---|---|---|
| Status badge `In Progress` | song was practiced recently | `src/components/dashboard/SongCard.tsx` |
| Status badge `Mastered` | song has a high performance rating | same |
| MIDI linked check indicator | song has MIDI attached | same |
| Title and BPM display | minimal song identity | same |

### What is missing or unclear

- The Dashboard communicates portfolio status, but not mapping status.
- There is no visible summary of whether a song already has a usable mapping or only linked MIDI.
- Practice-oriented signals exist in metadata, but do not connect to a real practice route.

## Workbench Grid Feedback

### Grid-level visualizations

| Visualization | Meaning | Evidence | Notes |
|---|---|---|---|
| Pad fill color by finger | which hand/finger is associated with the placed voice | `src/workbench/LayoutDesigner.tsx:fingerAssignmentMap` | One of the strongest immediate feedback loops |
| Finger badge `L2`, `R3`, etc. | exact finger label for a placed pad | same | More explicit than color alone |
| Finger-lock icon | a pad has a user-imposed finger lock | same | Good compact signal |
| Pose ghost marker | pad participates in current Pose 0 preview or edit state | same plus `NaturalHandPosePanel` helpers | Bridges personalization and mapping |
| Layout mode chip | whether layout is `Manual`, `Random`, `Optimized`, or `No Layout` | same | Important but still high-level |
| Note labels / position labels | note names or grid coordinates shown on pads | `src/workbench/Workbench.tsx` settings + `LayoutDesigner` | Optional layer for expert inspection |
| Reachability tint | green / yellow / gray reach zones from anchor pad | `src/engine/feasibility.ts`, `LayoutDesigner` | Hidden but valuable |

### Feedback on manual edits

- Dragging voices changes visible placement immediately.
- Renaming or recoloring voices updates list and grid presentation.
- Visibility toggle hides notes from filtered performance, indirectly changing later analysis.
- Finger locks provide a persistent visual cue on the affected pad.

### Feedback gaps

- The system does not summarize "what changed" after a drag or batch assignment.
- There is no explicit visualization of coverage status before optimization except via blocking alert when optimization is attempted.
- The current grid does not directly visualize why a finger assignment is preferred, only the resulting assignment itself.

## Workbench Analysis Feedback

### Summary layer

| Metric / visualization | Purpose | Evidence |
|---|---|---|
| Ergonomic score | top-level quality signal | `src/workbench/AnalysisPanel.tsx` |
| Total events | scope of analyzed material | same |
| Hand balance bar | left/right distribution | same |
| Average movement/stretch/drift/bounce/fatigue/crossover | reveals what kind of strain is dominating | same |
| Finger assignments table | maps analyzed usage back to notes/voices | `src/workbench/SoundAssignmentTable.tsx` |

### Comparison layer

| Visualization | Purpose | Evidence |
|---|---|---|
| Solver comparison table | compare beam vs genetic outcomes | `src/workbench/AnalysisPanel.tsx` |
| Evolution graph | show genetic optimization progress over generations | same |

### Optimization-process layer

| Visualization | Purpose | Evidence |
|---|---|---|
| Annealing process graph | show search trajectory through optimization run | `src/workbench/AnalysisPanel.tsx` |
| Initial/final cost, improvement, acceptance rate | summarize optimizer performance | same |

### Feedback gaps

- There is no explicit "analysis is stale / current / based on which solver" banner in the main summary area.
- There is no compact explanation of how to interpret the ergonomic score scale.
- Optimization feedback explains process after the fact, but not the preconditions the user should satisfy before running it.

## Timeline Feedback

### Visualizations used

| Visualization | Meaning | Evidence |
|---|---|---|
| Voice lanes | which voices occur over time | `src/workbench/Timeline.tsx` |
| Note blocks | event timing and duration | same |
| Finger labels overlay | which finger is thought to play a given event | `src/pages/TimelinePage.tsx`, `Timeline.tsx` |
| Zoom slider | density control for inspection | `src/pages/TimelinePage.tsx` |
| Current time marker | current seek position | `src/workbench/Timeline.tsx` |

### Feedback gaps

- Timeline does not strongly indicate which mapping or solver result the finger labels came from.
- It is useful as an overview, but not yet a rich practice-feedback surface.
- There is no difficulty-strip or aggregated stress overlay over time.

## Event Analysis Feedback

### Event timeline panel

| Visualization | Meaning | Evidence |
|---|---|---|
| Difficulty heat bars per transition | relative transition difficulty | `src/workbench/EventTimelinePanel.tsx` |
| `from -> to` indices and timestamps | sequence and location in time | same |
| hand-switch / finger-change tags | categorical difficulty flags | same |

### Event log table

| Visualization / control | Meaning | Evidence |
|---|---|---|
| sorted rows by cost | exposes hardest raw debug events first | `src/workbench/EventLogTable.tsx` |
| hand selector | manual override control | same |
| finger selector | manual override control | same |
| cost colorization | rough severity cue | same |

### Onion-skin grid

| Visualization | Meaning | Evidence |
|---|---|---|
| current/previous/next pads | local temporal context | `src/components/vis/OnionSkinGrid.tsx`, `src/engine/onionSkinBuilder.ts` |
| shared/current-only/next-only pads | continuity vs movement | `src/types/eventAnalysis.ts` |
| vector arrows / finger moves | movement path between moments | same |

### Transition metrics panel

| Metric | Meaning | Evidence |
|---|---|---|
| Time Delta | speed demand | `src/workbench/TransitionMetricsPanel.tsx` |
| Grid Distance | spatial movement size | same |
| Composite and Stretch percentages | summary difficulty components | same |
| Speed Pressure bar | urgency visualization | same |
| Flags | hand switch / finger change | same |
| Event details | pad count and sample pads | same |

### Practice-loop feedback

| Visualization / state | Meaning | Evidence |
|---|---|---|
| Play / Stop | whether loop stepping is active | `src/workbench/PracticeLoopControls.tsx` |
| Looping transition `N -> N+1` label | focused transition | same |
| Speed selector | relative stepping speed | same |
| automatic event-index stepping | animated change of focus | `src/hooks/usePracticeLoop.ts` |

### Feedback gaps

- Practice-loop output is visual only; no audio/MIDI confirmation or embodied practice feedback exists.
- Event Analysis is the best explanatory view, but still requires the user to mentally connect it back to actual mapping changes in Workbench.
- There is no direct "apply suggestion" loop from hard transitions back into layout-edit recommendations.

## Cost / Constraint Feedback

### Constraint feedback currently shown

| Feedback | Where | Current form |
|---|---|---|
| finger locks | Workbench grid | lock badge and context-menu active state |
| reachability | Workbench grid | green/yellow/gray overlay by anchor |
| unmapped-note optimization block | Workbench | alert dialog listing sample unmapped MIDI notes |
| hard/unplayable counts | Event Analysis header, solver outputs | numeric summary |

### Cost feedback currently shown

| Feedback | Where | Current form |
|---|---|---|
| average cost components | Workbench analysis panel | metric grid |
| per-event cost | Event log, Cost Debug | numeric per row/event |
| cost breakdown components | Cost Debug | full component detail |
| transition composite difficulty | Event timeline and metrics panel | percentages and heat bars |

### Missing or unclear constraint feedback

- No persistent coverage meter before optimization.
- No explicit explanation of finger-lock consequences after applying them.
- No visual comparison of current mapping cost vs prior mapping cost unless the user inspects annealing stats or advanced solver views.

## Manual Edits vs Optimized Results

### Current comparison cues

| Cue | Meaning | Evidence |
|---|---|---|
| layout mode chip | rough origin of the current mapping | `LayoutDesigner` |
| optimization tab | shows annealing process for optimized layout | `AnalysisPanel` |
| solver selector | allows switching the currently viewed analysis result | Workbench advanced mode |

### Missing comparison cues

- No explicit diff view between pre- and post-optimization mappings.
- No moved-pad count or changed-constraint count.
- No stable "baseline vs candidate" side-by-side mapping workflow.

## Overall Assessment

The product already has a strong feedback vocabulary for expert users:

- color
- badges
- metrics
- transition heatmaps
- onion-skin context
- debug breakdowns

Its main weakness is not lack of feedback, but lack of hierarchy and closure. The user gets many signals, but the app does not consistently tell them:

- which signal matters most right now
- whether the analysis is current
- what concrete next action to take
- how one screen's findings should feed the next editing action

