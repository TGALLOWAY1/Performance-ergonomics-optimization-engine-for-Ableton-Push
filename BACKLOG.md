# Project Backlog: Push 3 Performability Tool

## Phase 1: Core Data Model & Architecture
*Goal: Establish strict typing and the mathematical foundation for the 64-pad grid.*

- [x] **1.1 Define NoteEvent** (`src/types/performance.ts`)
  - Interface with `noteNumber`, `startTime`, `duration`, `velocity`.
- [x] **1.2 Define Performance** (`src/types/performance.ts`)
  - Interface containing sorted `NoteEvent[]` and metadata.
- [x] **1.3 Define InstrumentConfig** (`src/types/performance.ts`)
  - Interface for 64-pad layout (`bottomLeftNote`, 8x8 fixed dimensions).
- [x] **1.4 Define SectionMap** (`src/types/performance.ts`)
  - Interface mapping measure ranges to `InstrumentConfig`.
- [x] **1.5 Define LayoutSnapshot & ProjectState** (`src/types/projectState.ts`)
  - State container for the Workbench.
- [x] **1.6 Helper Utilities** (`src/utils/performanceUtils.ts`)
  - Sorting and ID generation helpers.
- [x] **1.7 GridMapService** (`src/engine/gridMapService.ts`)
  - **CRITICAL:** Implement strict Push 3 64-Pad Drum Mode logic (Row-Major, Bottom-Left start).
- [x] **1.8 Grid Distance Utility** (`src/engine/gridMath.ts`)
  - Euclidean distance calculation logic.

## Phase 2: Workbench UI & Test Data
*Goal: Create a visual feedback loop to debug the engine.*

- [x] **2.1 Workbench Shell** (`src/workbench/Workbench.tsx`)
  - Main layout with Sidebar, Grid Area, and Timeline Area.
- [x] **2.2 Layout & Section Management**
  - `LayoutList.tsx` and `SectionMapList.tsx` implementation.
- [x] **2.3 JSON Persistence**
  - Save/Load `ProjectState` to/from JSON files.
- [x] **2.4 GridPattern Data Structure** (`src/types/gridPattern.ts`)
  - Boolean matrix types and toggle utilities.
- [x] **2.5 Grid Editor Component** (`src/workbench/GridEditor.tsx`)
  - 8x8 Visual Grid.
  - **Visual Note:** Ensure Row 0 is rendered at the bottom.
- [x] **2.6 Pattern to Performance Conversion**
  - Logic to convert visual grid pattern steps into `NoteEvent[]`.
- [x] **2.7 Timeline Component** (`src/workbench/Timeline.tsx`)
  - Horizontal step sequencer view with Section coloring.
- [x] **2.8 MIDI Import** (`src/utils/midiImport.ts`)
  - Parse MIDI files and map them to the Grid.
  - Detect notes that fall outside the 8x8 range.

## Phase 3: Performability Engine
*Goal: The "Brain" that calculates difficulty.*

- [ ] **3.1 Ergonomic Constants** (`src/engine/ergonomics.ts`)
  - Define `MAX_REACH` and `MAX_SPEED` constraints.
- [ ] **3.2 Engine Setup & Virtual Hand** (`src/engine/runEngine.ts`)
  - scaffolding for the analysis engine.
- [ ] **3.3 The Greedy Algorithm** (`src/engine/runEngine.ts`)
  - Logic to assign notes to Left vs Right hand based on lowest cost.
- [ ] **3.4 Scoring & Difficulty**
  - Calculate `Easy` | `Medium` | `Hard` | `Unplayable` per note.
- [ ] **3.5 Engine Result Visualization** (`src/workbench/EngineResultsPanel.tsx`)
  - Display stats and choke points.
- [ ] **3.6 Heatmap Overlay** (`src/workbench/GridEditor.tsx`)
  - Colorize grid pads based on difficulty.

## Phase 4: Developer Experience
*Goal: Stability and Documentation.*

- [ ] **4.1 Synthetic Test Data** (`src/utils/testPatterns.ts`)
  - Generators for Scale Runs, Jumps, and Chords.
- [ ] **4.2 Architecture Documentation** (`architecture.md`)
  - Summary of data flow and grid logic logic.