3.1 High-Level Overview
Project Purpose
A React SPA that analyzes MIDI performances for Ableton Push, computes ergonomic “performability” scores via a biomechanical engine, and offers a visual workbench for remapping pad layouts and reviewing analytics. 

Core Concepts / Domain

Performances: Time-ordered MIDI note events with tempo and metadata. 

Grid/Instrument Configs: Mapping between MIDI notes (voices/cells) and 8×8 Push pads, with layout templates. 

Biomechanical Performability Engine: Assigns hands/fingers to notes using reachability, movement, stretch, drift, fatigue, and crossover costs to produce scores and debug data. 

Projects & Layouts: Persisted state containing performances, mappings, instrument configs, and manual assignments. 

Song Portfolio: Dashboard for managing songs, importing MIDI, and seeding mock data. 

Top-Level Architecture

Entry Point & Routing: src/main.tsx sets up Theme/Project providers and routes to Dashboard, Workbench, and Timeline pages. 

Context: ProjectContext holds project state/history and latest engine results; ThemeContext toggles light/dark styling. 

UI Structure: src/pages (Dashboard, Timeline); src/workbench (layout editor, analysis panels); shared components/hooks/utilities under src/components, src/hooks, src/utils.

Engine & Models: Performability engine logic in src/engine; domain types in src/types; services for MIDI/import and song persistence in src/services and src/utils.

3.2 Mid-Level Architecture
Dashboard / Song Library
Key Files

src/pages/Dashboard.tsx – Lists songs, imports MIDI, and links to Workbench. 

src/components/dashboard/SongCard.tsx – Card UI with difficulty badges and navigation.

src/services/SongService.ts – LocalStorage CRUD, MIDI import parsing, project-state persistence. 

Main Data Flows

On mount, seeds mock songs and loads metadata from LocalStorage. 

Importing a MIDI file parses to a project structure and saves new song metadata. 

Clicking a card navigates to /workbench to edit layouts. 

Project State & Theming
Key Files

src/context/ProjectContext.tsx – Provides project state, undo/redo history, and engine results. 

src/types/projectState.ts – Defines layouts, instrument configs, mappings, ignored notes, and manual finger overrides. 

Main Data Flows

useProjectHistory (not shown) manages state snapshots for undo/redo.

Engine results are stored alongside state for UI panels to consume.

Workbench (Layout & Analysis Workbench)
Key Files

src/workbench/Workbench.tsx – Central orchestrator for importing MIDI, managing mappings, running the engine, and rendering designer/analysis panels. 

src/workbench/LayoutDesigner.tsx, GridArea.tsx, etc. (not opened) – Grid assignment UI.

src/workbench/AnalysisPanel.tsx & related components – Visualize engine outputs (heatmaps, logs).

Main Data Flows

Import Flow: handleProjectLoad parses MIDI (file/URL), hard-resets layouts/instrument configs/mappings, and seeds parked sounds, then runs the solver for verification. 

Engine Loop: An effect recomputes engine results whenever mappings, performance events, instrument config, or ignored notes change; results cached into mapping scores. 

Assignment Flow: Users assign voices to pads; if no mapping exists, a new one is created with default metadata. 

Persistence Flow: JSON export/import of project state is supported via handleSaveProject/handleLoadProject. 

Performability Engine
Key Files

src/engine/core.ts – BiomechanicalSolver implementing finger assignment, cost evaluation, and result aggregation. 

src/engine/costFunction.ts, feasibility.ts, gridMapService.ts, gridMath.ts, models.ts – Cost calculators, reach/ordering checks, MIDI-to-grid mapping, geometry utilities, and constants.

Main Data Flows

For each note event, derive target pad from mapping or algorithmic grid map; determine candidate hands/fingers by position; evaluate cost (movement, stretch, drift, bounce, fatigue, crossover) plus lookahead penalty; pick minimum-cost assignment. 

Update hand state (positions/fatigue), record note history, and log debug events. 

Aggregate score (penalizing hard/unplayable events), finger usage stats, fatigue map, and average metrics for UI consumption. 

3.3 Low-Level Details
Key React Components
Dashboard (src/pages/Dashboard.tsx)

Props/State: Internal songs state from SongService; file input ref.

Behavior: Seeds data, imports MIDI, adds new songs, renders sidebar filters and grid of SongCards; footer actions for add/import. 

SongCard (src/components/dashboard/SongCard.tsx)

Props: song: SongMetadata.

Behavior: Displays status (In Progress/Mastered), metrics, difficulty badge; on click navigates to Workbench.

Workbench (src/workbench/Workbench.tsx)

Props: none; uses useProject.

Behavior: Manages active mapping/layout, handles MIDI project load, triggers solver via effects, enables manual assignment/import/export, and renders designer/analysis subcomponents. 

Important Hooks / Stores / Contexts
ProjectContext (src/context/ProjectContext.tsx)

State: Layouts, instrument configs, mappings, parked sounds, ignored notes, manual assignments; engine result; undo/redo flags.

Consumers: Workbench, analysis panels, timeline. 

ThemeContext (src/context/ThemeContext.tsx)

State: theme ('dark'|'light'); toggleTheme updates root class. Consumers wrap app tree. 

Core Domain Types / Interfaces
Performance & NoteEvent (src/types/performance.ts) – Sorted event list with timing/velocity; optional tempo/name. 

InstrumentConfig (src/types/performance.ts) – Describes 8×8 grid origin note and layout mode. 

GridMapping & Voice (src/types/layout.ts) – Map pad coordinates to voices (MIDI cells) with finger constraints and cached scores. 

ProjectState (src/types/projectState.ts) – Aggregates layouts, mappings, parked sounds, ignored notes, manual finger overrides, and active IDs. 

Critical Utility Functions / Services
SongService (src/services/SongService.ts)

Handles LocalStorage persistence, MIDI import (via parseMidiFileToProject), project-state save/load hooks, and mock seeding. Inputs: song metadata or File; outputs: stored Song structures. 

BiomechanicalSolver (src/engine/core.ts)

Input: Performance, InstrumentConfig, optional GridMapping and manual assignments. Output: EngineResult with scores/metrics. Core logic evaluates reachability and cost across events, updates hand states, and aggregates usage/fatigue statistics. 

Cost Calculators (src/engine/costFunction.ts)

Provide movement, stretch, drift, bounce, fatigue, and crossover penalties using grid geometry and finger strength constants; track note-to-finger history for bounce penalties. 

Summary for New Contributors
Start at src/main.tsx to see routing and providers. 

Review domain types in src/types/performance.ts, src/types/layout.ts, and src/types/projectState.ts to understand data models. 

ProjectContext is the central state container with undo/redo and engine result sharing. 

The Dashboard uses SongService for LocalStorage-backed song metadata and MIDI import; it routes users to the Workbench. 

Workbench orchestrates MIDI project loading, grid mapping, solver execution, and renders layout/analysis UIs—key place to trace interactions. 

The biomechanical solver (src/engine/core.ts) is the core engine: learn its cost components and hand-state updates to reason about ergonomics outputs. 

Grid mappings default to algorithmic GridMapService when no custom mapping is found; pad coordinates are string keys like "row,col". 

Import/export of full project state is available in Workbench, useful for debugging data flows. 

Difficulty badges and performance metrics on SongCard are purely UI cues; actual difficulty comes from engine results in the Workbench.

Theme toggling is simple class toggling via ThemeContext; no styling state is persisted. 