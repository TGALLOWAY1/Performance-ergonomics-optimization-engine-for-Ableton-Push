## 1. Core Data Model & MIDI Handling

### 1.1 Performance Data Model
- [ ] Define `Performance` type (flat timeline of notes)
  - [ ] `noteNumber`
  - [ ] `startTime`
  - [ ] `duration`
  - [ ] `velocity`
  - [ ] `channel`
  - [ ] `sourceClipId` (optional for future)
- [ ] Define `NoteEvent` structure
- [ ] Define `ClipMetadata`
- [ ] Create helper utilities for sorting & merging events
- [ ] Document model in `architecture-notes.md`

---

### 1.2 MIDI Import (Single File MVP)
- [ ] Implement MIDI parsing module
- [ ] Load a single `.mid` file
- [ ] Choose track logic (use first non-drum or configurable)
- [ ] Convert MIDI → `Performance`
- [ ] Basic error handling (unsupported file, no notes, etc.)
- [ ] Log MIDI import summary (note count, clip length)
- [ ] Document import logic in architecture notes

---

### 1.3 Direct Drum-Rack Mapping (Bottom-Left = C1)
- [ ] Implement mapping: `noteNumber` → `(row, col)`
- [ ] Default `bottomLeftNote = 36` (C1)
- [ ] Create configurable constant for bottom-left pad (code-only)
- [ ] Pad indexing rule: fill rows or columns (choose and document)
- [ ] Add mapping utilities to engine layer
- [ ] Document mapping logic in `architecture-notes.md`

---

### 1.4 Architecture Notes Markdown
- [ ] Create `architecture-notes.md`
- [ ] Describe data model (Performance, NoteEvent, mapping)
- [ ] Describe engine flow (MIDI → Performance → Engine → UI)
- [ ] Track design decisions (hand heuristics, reach values, etc.)
- [ ] Update regularly during build

---

## 2. Performability Engine (Personal Ergonomics)

### 2.1 Ergonomic Rules
- [ ] Define constants:
  - [ ] Max same-hand chord size
  - [ ] Max horizontal/vertical reach
  - [ ] Max movement distance per time unit
- [ ] Implement left/right hand zone split (simple heuristic)
- [ ] Document rules and rationale

---

### 2.2 Hand Assignment & Movement Modeling
- [ ] Implement hand assignment (based on row/col)
- [ ] Create virtual hand positions
- [ ] For each note:
  - [ ] Check reach distance
  - [ ] Check timing allowance vs movement
  - [ ] Update hand position
- [ ] Optionally add simple finger indexing
- [ ] Log per-note hand decisions in debug mode

---

### 2.3 Performability Scoring
- [ ] For each `NoteEvent`:
  - [ ] Evaluate reach constraint
  - [ ] Evaluate timing constraint
  - [ ] Evaluate chord spread
  - [ ] Assign difficulty: easy / medium / hard / unplayable
- [ ] Aggregate:
  - [ ] Overall 0–100 score
  - [ ] % hard events
  - [ ] % unplayable events
  - [ ] Identify “choke points”
- [ ] Return `EngineResult` object

---

### 2.4 Debug & Explainability Output
- [ ] For each note:
  - [ ] Store hand assignment
  - [ ] Store grid position
  - [ ] Store movement distance & timing
  - [ ] Store violated rule(s)
  - [ ] Store difficulty result
- [ ] Create `EngineDebugEvent` format
- [ ] Expose debug structures to UI
- [ ] Add debug toggle

---

## 3. Performance Workbench UI (MVP)

### 3.1 Minimal UI Structure
- [ ] Implement left panel with:
  - [ ] File upload
  - [ ] Re-run analysis button
- [ ] Implement main center area:
  - [ ] 8×8 Push grid visualization
- [ ] Implement right/bottom panel:
  - [ ] Summary scores
  - [ ] Timeline difficulty strip

---

### 3.2 MIDI Input UX
- [ ] Add “Upload MIDI” button
- [ ] Display file name once loaded
- [ ] Auto-run engine after parsing
- [ ] Add “Re-run analysis” button
- [ ] Handle small/large MIDI files gracefully

---

### 3.3 Push Grid Visualization
- [ ] Render 8×8 pad grid
- [ ] Color pads based on usage/difficulty
- [ ] Hover to show:
  - [ ] Notes hit on this pad
  - [ ] Time(s) played
  - [ ] Difficulty distribution

---

### 3.4 Timeline Difficulty Strip
- [ ] Show clip duration as a bar
- [ ] Divide into beat/measure segments
- [ ] Color based on difficulty
- [ ] Click/hover shows details (optional MVP)

---

### 3.5 Per-Event Debug Table
- [ ] Create table view of all events
- [ ] Columns:
  - [ ] Time  
  - [ ] Note number  
  - [ ] (row, col)  
  - [ ] Hand  
  - [ ] Difficulty  
  - [ ] Violated rules  
- [ ] Allow sorting by time or difficulty

---

## 4. Developer Experience

### 4.1 Engine API Boundary
- [ ] Create `runPerformabilityEngine(performance)` entrypoint
- [ ] Return:
  - [ ] Overall score
  - [ ] Per-event results
  - [ ] Debug info
  - [ ] Aggregate stats
- [ ] Document engine API in architecture notes

---

### 4.2 Logging & Dev Tools
- [ ] Add console logs (dev mode)
- [ ] Add config flag for verbose debug
- [ ] Print:
  - [ ] MIDI load summary
  - [ ] Engine run summary
  - [ ] Constraint values

---

### 4.3 Synthetic Test Cases
- [ ] Create `synthetic_tests/` folder
- [ ] Add:
  - [ ] Easy pattern
  - [ ] Impossible chord
  - [ ] Impossible speed run
- [ ] Write unit tests for:
  - [ ] Rule correctness
  - [ ] Expected difficulty results

---

# 🚀 POST-MVP FEATURES (Future Consideration)

## 1. Multi-Clip / Multi-File Merge
- [ ] Allow loading multiple MIDI clips
- [ ] Merge into one timeline
- [ ] Detect conflicts between layers
- [ ] UI list of clips

---

## 2. Basic Layout Variants (Still Simple)
- [ ] Configurable bottom-left note
- [ ] Option: fill rows vs fill columns
- [ ] Simple dropdown in UI

---

## 3. Adjustable Ergonomics
- [ ] Hand reach settings
- [ ] Movement aggressiveness
- [ ] Difficulty sensitivity presets

---

## 4. Animated Playback View
- [ ] Playhead animation
- [ ] Moving pad highlights
- [ ] Hand movement arrows

---

## 5. Export Tools
- [ ] Export JSON report
- [ ] Export text summary of hardest sections

---

## 6. Full Push Scale Layouts (Far Future)
- [ ] Major/minor/chromatic
- [ ] Melodic playability engine
- [ ] Multi-note-per-pad harmonies
