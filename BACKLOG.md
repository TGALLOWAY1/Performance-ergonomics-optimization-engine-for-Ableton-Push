Project Backlog: Push 3 Performability Tool

Phase 1: Core Data Model & Architecture

Goal: Establish strict typing and the mathematical foundation for the 64-pad grid.

  [x] 1.1 Define NoteEvent (src/types/performance.ts)

  [x] 1.2 Define Performance (src/types/performance.ts)

  [x] 1.3 Define InstrumentConfig (src/types/performance.ts)

  [x] 1.4 Define SectionMap (src/types/performance.ts)

  [x] 1.5 Define LayoutSnapshot & ProjectState (src/types/projectState.ts)

  [x] 1.6 Helper Utilities (src/utils/performanceUtils.ts)

  [x] 1.7 GridMapService (src/engine/gridMapService.ts)

  [x] 1.8 Grid Distance Utility (src/engine/gridMath.ts)

Phase 2: Workbench UI & Test Data

Goal: Create a visual feedback loop to debug the engine.

  [x] 2.1 Workbench Shell (src/workbench/Workbench.tsx)

  [x] 2.2 Layout & Section Management

  [x] 2.3 JSON Persistence

  [x] 2.4 GridPattern Data Structure (src/types/gridPattern.ts)

  [x] 2.5 Grid Editor Component (src/workbench/GridEditor.tsx)

  [x] 2.6 Pattern to Performance Conversion

  [x] 2.7 Timeline Component (src/workbench/Timeline.tsx)

  [x] 2.8 MIDI Import (src/utils/midiImport.ts)

Phase 3: Performability Engine (Legacy)

Goal: Basic distance-based scoring.

  [x] 3.1 Ergonomic Constants (src/engine/ergonomics.ts)

  [x] 3.2 Engine Setup & Virtual Hand (src/engine/runEngine.ts)

  [x] 3.3 The Greedy Algorithm (src/engine/runEngine.ts)

  [x] 3.4 Scoring & Difficulty

  [x] 3.5 Engine Result Visualization (src/workbench/EngineResultsPanel.tsx)

  [x] 3.6 Heatmap Overlay (src/workbench/GridEditor.tsx)

Phase 4: Codebase Synchronization & Documentation

Goal: Ensure architecture aligns with code before major refactor.

  [x] 4.1 Context Review

  Scan existing types/logic to prevent regressions during the upgrade.

  [x] 4.2 Architecture Documentation (ARCHITECTURE.md)

  Create the "Constitution" file defining SoundAssets, Mappings, and the Biomechanical Model.

Phase 5: Data Foundation & Notation (The Refactor)

Goal: Switch to L1-R5 notation and support draggable Sound Assets.

  [ ] 5.1 Notation Refactor (src/types/engine.ts, src/utils/formatUtils.ts)

  Change FingerID to numbers (1-5).

  Implement formatFinger (L1, R5).

  Update GridEditor badges.

  [ ] 5.2 Layout Data Model (src/types/layout.ts)

  Define SoundAsset (Source File, Audio/MIDI type).

  Define GridMapping (Cells, Finger Constraints).

  Update ProjectState to support multiple mappings + staging area.

Phase 6: The Biomechanical Engine (Brain Transplant)

  Goal: Replace single-point hand model with 5-finger topological model.

  [ ] 6.1 Biomechanical Hand Model (src/engine/runEngine.ts)

  Update VirtualHand to track 5 separate fingers + Wrist Centroid.

  [ ] 6.2 Geometric Feasibility (src/engine/feasibility.ts)

  Implement isSpanValid (Max Reach < 5.5).

  Implement isFingerOrderingValid (Thumb left of Pinky).

  Implement isCollision.

  [ ] 6.3 Biomechanical Cost Function (src/engine/ergonomics.ts)

  Implement calculateBioCost (Distance * Strength + Fatigue + Drift).

  [ ] 6.4 The 10-Finger Search Loop (src/engine/runEngine.ts)

    Rewrite solver to iterate 10 finger candidates per note.

  Phase 7: The Layout Designer UI

  Goal: Drag & Drop interface for designing kits.

  [ ] 7.1 Designer Shell & Library (src/workbench/LayoutDesigner.tsx)

  Drag & Drop implementation (@dnd-kit).

  Left Panel: Sound Library (Staging Area).

  [ ] 7.2 Visual Reachability (src/workbench/GridEditor.tsx)

  Implement "Ghost Hand" Heatmap (Green/Yellow/Gray overlays).

  Context menu to trigger "Show Reach for L1".

  [ ] 7.3 Ghost Templates

  Optional visual overlays for standard kit layouts (Kick @ 0,0).

Phase 8: Intelligent Import Wizard

  Goal: Handle complex multi-note MIDI and Audio files.

  [ ] 8.1 Multi-Note Split Logic (src/utils/midiImport.ts)

  Logic to split one MIDI file into multiple SoundAssets based on unique pitches.

  [ ] 8.2 Background Audio Slicer (src/utils/audioSlicer.worker.ts)

  Web Worker for analyzing and slicing WAV files without freezing UI.

Phase 9: Optimization & Export

  Goal: Auto-generate layouts and export for Push 3.

  [ ] 9.1 Auto-Layout Generator (src/utils/autoLayout.ts)

  Heuristic algorithm to place high-frequency sounds in ergonomic zones.

  [ ] 9.2 MIDI Remapping Export (src/utils/midiExport.ts)

  Generate .mid files that map original notes to their new Grid positions.

Future Enhancements (Post-MVP)

[ ] Visual Diff View: Highlight pad swaps when comparing layouts.

[ ] PDF Cheat Sheet: Generate printable grid maps for learning layouts.