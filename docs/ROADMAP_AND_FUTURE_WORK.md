# Roadmap & Future Work

## Engine & Solver Improvements

• **`src/services/SongService.ts` (line 139)**
  - Improve key detection logic (currently uses basic heuristic: root note % 12)

• **`src/engine/solvers/types.ts` (line 230)**
  - Solver strategy pattern is extensible for future algorithms

• **`src/engine/solvers/AnnealingSolver.ts` (line 202)**
  - Future optimization: Can downsample iteration logs if needed (currently logs every iteration)

• **`src/engine/eventMetrics.ts` (line 251)**
  - Anatomical stretch table currently unused in v1, reserved for future use

• **`src/engine/transitionAnalyzer.ts` (line 28)**
  - Tempo parameter reserved for future tempo-aware calculations

---

## UI & Visualization

• **`src/workbench/Workbench.tsx` (line 1255)**
  - "Suggest Ergonomic Layout" button is disabled with label "Soon"
  - Future feature: AI-powered layout suggestions

• **`src/components/vis/OnionSkinGrid.tsx` (line 195)**
  - Vector hover interaction not yet supported (VectorLayer has `pointerEvents: 'none'`)

• **`PRD/FLEXIBLE GRID COMPONENT PRD.md`**
  - **Major Refactor Planned:** Grid Visualization Component v3
  - Replace monolithic grid rendering with layered, declarative system
  - Support: Event Snapshot, Onion Skinning, Timeline/Playback, Performance View, Layout Editor, Heatmaps
  - Architecture: BaseGridLayer, PadLayer, VectorLayer, OverlayLayer
  - Goals: High performance (60 FPS), zero O(pads × events) loops, Storybook-testable
  - Migration: Add grid-v3 directory, implement in isolation, add adapters, integrate into Event Analysis first

---

## Grid Layout & Flexibility

• **`src/types/performance.ts` (line 135)**
  - Currently only supports `'drum_64'` layout mode
  - **Future support planned for `'melodic_4th'`** (melodic playing mode)

• **`src/types/projectState.ts` (line 23)**
  - `sectionMaps: any[]` - Using `any[]` temporarily to fix build
  - **Should be `SectionMap[]`** - Time-based grid configurations (not yet fully implemented)

• **`TODO.md` - Section 2: Basic Layout Variants (Post-MVP)**
  - Configurable bottom-left note (currently auto-adjusted to min note)
  - Option: fill rows vs fill columns (currently row-major only)
  - Simple dropdown in UI for layout variants

• **`TODO.md` - Section 6: Full Push Scale Layouts (Far Future)**
  - Major/minor/chromatic scale layouts
  - Melodic playability engine (different from drum mode)
  - Multi-note-per-pad harmonies

---

## MIDI & Import Features

• **`TODO.md` - Section 1.2: MIDI Import Enhancements**
  - Choose track logic (currently processes all tracks)
  - Better error handling for unsupported files
  - MIDI import summary logging improvements

• **`TODO.md` - Section 1: Multi-Clip / Multi-File Merge (Post-MVP)**
  - Allow loading multiple MIDI clips
  - Merge into one timeline
  - Detect conflicts between layers
  - UI list of clips

---

## Persistence & Data Model

• **`src/types/projectState.ts` (line 23)**
  - `sectionMaps` type needs proper `SectionMap[]` definition (currently `any[]`)

• **`src/types/performance.ts` (line 10)**
  - `sourceClipId` field marked as optional for future use in `NoteEvent`

• **`TODO.md` - Section 5: Export Tools (Post-MVP)**
  - Export JSON report (currently exports full ProjectState)
  - Export text summary of hardest sections

---

## Ergonomics & Personalization

• **`TODO.md` - Section 3: Adjustable Ergonomics (Post-MVP)**
  - Hand reach settings (currently uses fixed constants)
  - Movement aggressiveness controls
  - Difficulty sensitivity presets

• **`src/hooks/usePracticeLoop.ts` (line 7)**
  - Future: Can be extended to trigger actual MIDI/audio playback (currently visual only)

---

## Analysis & Visualization

• **`TODO.md` - Section 3.4: Timeline Difficulty Strip**
  - Show clip duration as a bar
  - Divide into beat/measure segments
  - Color based on difficulty
  - Click/hover shows details (optional MVP)

• **`TODO.md` - Section 4: Animated Playback View (Post-MVP)**
  - Playhead animation
  - Moving pad highlights
  - Hand movement arrows

---

## Developer Experience

• **`TODO.md` - Section 4.1: Engine API Boundary**
  - Create `runPerformabilityEngine(performance)` entrypoint (currently uses BiomechanicalSolver directly)
  - Document engine API in architecture notes

• **`TODO.md` - Section 4.2: Logging & Dev Tools**
  - Add console logs (dev mode)
  - Add config flag for verbose debug
  - Print: MIDI load summary, engine run summary, constraint values

• **`TODO.md` - Section 4.3: Synthetic Test Cases**
  - Create `synthetic_tests/` folder
  - Add: Easy pattern, Impossible chord, Impossible speed run
  - Write unit tests for: Rule correctness, Expected difficulty results

---

## Architecture & Documentation

• **`TODO.md` - Section 1.4: Architecture Notes Markdown**
  - Create `architecture-notes.md`
  - Describe data model (Performance, NoteEvent, mapping)
  - Describe engine flow (MIDI → Performance → Engine → UI)
  - Track design decisions (hand heuristics, reach values, etc.)
  - Update regularly during build

---

## Push 3 Integration Notes

• **Current Constraint:** Project ONLY supports 64-Pad Drum Mode (Ableton Push 3 Manual §6.3)
  - Grid Size: 8 Rows × 8 Columns (64 Pads total)
  - Indexing: Row-Major, starting from Bottom-Left
  - Visual: Row 7 is top, Row 0 is bottom

• **Future Grid Modes:**
  - **Melodic 4th Mode:** Planned but not implemented (mentioned in `InstrumentConfig.layoutMode`)
  - **Scale Layouts:** Major/minor/chromatic (far future, from TODO.md)

• **No Direct Hardware Integration:**
  - No MIDI output to Push 3 hardware
  - No real-time performance capture
  - Analysis-only tool (no live feedback loop)

---

## Layout Optimization Future Work

• **Current State:**
  - Simulated Annealing solver implemented for layout optimization
  - Beam Search and Genetic Algorithm for finger assignment
  - Manual layout controls (random, optimize, clear)

• **Future Enhancements:**
  - "Suggest Ergonomic Layout" AI-powered suggestions (button exists but disabled)
  - Multi-objective optimization (balance ergonomics with musical preferences)
  - Layout templates with pre-optimized configurations
  - A/B comparison tool for layout variants

---

## Backlog Items (From BACKLOG.md)

### Phase 5: Data Foundation & Notation

• **`BACKLOG.md` - Phase 5.1: Notation Refactor**
  - Change FingerID to numbers (1-5) - currently uses string format
  - Implement formatFinger (L1, R5) - standardize display format
  - Update GridEditor badges to use new notation

• **`BACKLOG.md` - Phase 5.2: Layout Data Model**
  - Define SoundAsset (Source File, Audio/MIDI type) - decouple sound from MIDI note
  - Define GridMapping (Cells, Finger Constraints) - already exists but may need refinement
  - Update ProjectState to support multiple mappings + staging area - partially implemented

### Phase 6: The Biomechanical Engine

• **`BACKLOG.md` - Phase 6.1: Biomechanical Hand Model**
  - Update VirtualHand to track 5 separate fingers + Wrist Centroid
  - Currently uses HandPose model but may need refinement

• **`BACKLOG.md` - Phase 6.2: Geometric Feasibility**
  - Implement isSpanValid (Max Reach < 5.5) - partially implemented in `feasibility.ts`
  - Implement isFingerOrderingValid (Thumb left of Pinky) - partially implemented
  - Implement isCollision - partially implemented

• **`BACKLOG.md` - Phase 6.3: Biomechanical Cost Function**
  - Implement calculateBioCost (Distance * Strength + Fatigue + Drift) - implemented but may need refinement

• **`BACKLOG.md` - Phase 6.4: The 10-Finger Search Loop**
  - Rewrite solver to iterate 10 finger candidates per note - currently uses greedy/beam/genetic/annealing approaches

### Phase 7: The Layout Designer UI

• **`BACKLOG.md` - Phase 7.1: Designer Shell & Library**
  - Drag & Drop implementation (@dnd-kit) - **Already implemented** in LayoutDesigner.tsx
  - Left Panel: Sound Library (Staging Area) - **Already implemented** as VoiceLibrary

• **`BACKLOG.md` - Phase 7.2: Visual Reachability**
  - Implement "Ghost Hand" Heatmap (Green/Yellow/Gray overlays)
  - Context menu to trigger "Show Reach for L1" - partially implemented

• **`BACKLOG.md` - Phase 7.3: Ghost Templates**
  - Optional visual overlays for standard kit layouts (Kick @ 0,0)
  - Template system exists but ghost overlays not yet implemented

### Phase 8: Intelligent Import Wizard

• **`BACKLOG.md` - Phase 8.1: Multi-Note Split Logic**
  - Logic to split one MIDI file into multiple SoundAssets based on unique pitches
  - Currently creates one Voice per unique MIDI note, but may need refinement

• **`BACKLOG.md` - Phase 8.2: Background Audio Slicer**
  - Web Worker for analyzing and slicing WAV files without freezing UI
  - Currently only supports MIDI import, not audio files

### Phase 9: Optimization & Export

• **`BACKLOG.md` - Phase 9.1: Auto-Layout Generator**
  - Heuristic algorithm to place high-frequency sounds in ergonomic zones
  - "Assign Manually" button exists but uses random placement, not frequency-based

• **`BACKLOG.md` - Phase 9.2: MIDI Remapping Export**
  - Generate .mid files that map original notes to their new Grid positions
  - Currently only exports ProjectState JSON, not MIDI remapping

### Future Enhancements (Post-MVP)

• **`BACKLOG.md` - Visual Diff View**
  - Highlight pad swaps when comparing layouts
  - A/B comparison tool for layout variants

• **`BACKLOG.md` - PDF Cheat Sheet**
  - Generate printable grid maps for learning layouts
  - Export tool for physical reference

---

## Summary

**Active Development Areas:**
- Grid Visualization Component v3 (major refactor planned)
- Melodic layout mode support (`'melodic_4th'`)
- Section maps implementation (time-based grid configurations)
- Enhanced MIDI import (multi-file, track selection)
- Notation refactor (FingerID standardization)
- Biomechanical engine refinements (10-finger search, feasibility checks)

**Post-MVP Features:**
- Multi-clip merge
- Adjustable ergonomics
- Animated playback
- Export tools (MIDI remapping, PDF cheat sheets)
- Full scale layouts (far future)
- Audio file import and slicing
- Visual diff view for layout comparison

**Technical Debt:**
- `sectionMaps` type definition (`any[]` → `SectionMap[]`)
- Key detection logic improvement
- Engine API documentation
- Test coverage expansion
- Audio import support (currently MIDI-only)

