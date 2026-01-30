# MIDI Import & Project Export/Import Documentation

## MIDI Import Pipeline

### Overview

The MIDI import pipeline transforms a MIDI file on disk into a complete `ProjectState` with `Performance` data, `Voice` definitions, and an empty grid layout. The process follows an **Explicit Layout Model** where all voices start in a staging area (`parkedSounds`) and users must explicitly assign them to pads.

### Step-by-Step Process

• **1. File Input (`parseMidiFileToProject` or `fetchMidiProject`):**
  - **From File:** Uses `FileReader.readAsArrayBuffer()` to read MIDI file
  - **From URL:** Uses `fetch()` to download MIDI file, then converts to `ArrayBuffer`
  - Both paths converge at `parseMidiProject(arrayBuffer, fileName, existingConfig)`

• **2. MIDI Parsing (`parseMidiProject`, lines 51-220):**
  - Uses `@tonejs/midi` library: `const midiData = new Midi(arrayBuffer)`
  - Extracts all note events from all tracks:
    ```typescript
    midiData.tracks.forEach(track => {
      track.notes.forEach(note => {
        events.push({
          noteNumber: note.midi,        // MIDI note number (0-127)
          startTime: note.time,         // Absolute time in seconds
          duration: note.duration,       // Duration in seconds
          velocity: Math.round(note.velocity * 127),  // 0-127
          channel: track.channel + 1     // MIDI channel (1-16)
        });
      });
    });
    ```

• **3. Event Sorting (CRITICAL ASSUMPTION):**
  - **Requirement:** Events MUST be sorted by `startTime` ascending
  - Implementation: `events.sort((a, b) => a.startTime - b.startTime)`
  - **Why:** The biomechanical solver processes events sequentially and relies on temporal ordering

• **4. Tempo Extraction:**
  - Reads tempo from MIDI header: `midiData.header.tempos[0].bpm`
  - Defaults to 120 BPM if no tempo found
  - Rounds to integer: `Math.round(tempo)`

• **5. Intelligent Root Note Adjustment:**
  - Finds minimum note number: `Math.min(...events.map(e => e.noteNumber))`
  - Sets `instrumentConfig.bottomLeftNote = minNote` (or 36 if no events)
  - **Purpose:** Ensures the lowest note in the MIDI file maps to pad [0,0] (bottom-left)
  - **Benefit:** Maximizes the number of notes that fit within the 8x8 grid window

• **6. Unmapped Note Detection:**
  - Checks each event: `GridMapService.noteToGrid(noteNumber, instrumentConfig)`
  - Notes that return `null` are outside the 8x8 grid window
  - Counts `unmappedNoteCount` for reporting (but doesn't filter them out)

• **7. Performance Object Creation:**
  ```typescript
  const performance: Performance = {
    events,                    // Sorted array of NoteEvent
    tempo,                      // BPM (integer)
    name: fileName.replace(/\.[^/.]+$/, "")  // Filename without extension
  };
  ```

• **8. Voice Extraction (Unique MIDI Pitches):**
  - Collects unique note numbers: `new Set(events.map(e => e.noteNumber))`
  - Sorts unique notes ascending: `Array.from(uniqueNotes).sort((a, b) => a - b)`
  - Creates `Voice` objects for each unique note:
    ```typescript
    {
      id: generateId('sound'),              // UUID
      name: `${noteName} (${noteNumber})`,   // e.g., "C2 (36)"
      sourceType: 'midi_track',
      sourceFile: fileName,
      originalMidiNote: noteNumber,           // MIDI note number (0-127)
      color: colors[index % colors.length]   // Rotating color palette
    }
    ```
  - **Note Name Generation:** Uses formula: `note = noteNames[midiNote % 12]`, `octave = Math.floor(midiNote / 12) - 2`
  - **Color Assignment:** 16-color palette, rotates through colors based on index

• **9. Empty Grid Mapping (Explicit Layout Model):**
  - **Critical Design Decision:** Grid starts EMPTY (`cells: {}`)
  - Sets `layoutMode: 'none'` to indicate no layout assigned
  - All voices go to `parkedSounds` (staging area)
  - Users must explicitly assign via drag & drop, "Assign Manually", or "Optimize Layout"

• **10. ProjectState Creation (`createProjectStateFromMidi` in SongService):**
  - Creates new `LayoutSnapshot` with imported performance
  - Sets `activeLayoutId` to new layout
  - Places all voices in `parkedSounds` array
  - Creates empty mapping with `layoutMode: 'none'`
  - Resets `ignoredNoteNumbers` to empty array
  - Sets `projectTempo` from performance tempo

### Data Flow Diagram

```
MIDI File (disk)
    ↓
FileReader / fetch() → ArrayBuffer
    ↓
@tonejs/midi.Midi(arrayBuffer)
    ↓
Extract: tracks → notes → NoteEvent[]
    ↓
Sort by startTime (REQUIRED)
    ↓
Extract: tempo, minNoteNumber
    ↓
Create: Performance { events, tempo, name }
    ↓
Extract: unique noteNumbers → Voice[]
    ↓
Create: GridMapping { cells: {}, layoutMode: 'none' }
    ↓
Create: InstrumentConfig { bottomLeftNote: minNote }
    ↓
Return: MidiProjectData {
  performance,
  voices,
  instrumentConfig,
  gridMapping,
  minNoteNumber,
  unmappedNoteCount
}
    ↓
Workbench.handleProjectLoad() → setProjectState()
    ↓
ProjectState {
  layouts: [LayoutSnapshot { performance }],
  parkedSounds: voices[],  // ALL voices in staging
  mappings: [GridMapping { cells: {} }],  // EMPTY grid
  instrumentConfig,
  ...
}
```

### Key Functions

• **`parseMidiFileToProject(file, existingConfig?)`**
  - Entry point for File objects
  - Uses FileReader to convert File → ArrayBuffer
  - Calls `parseMidiProject(arrayBuffer, fileName, existingConfig)`

• **`fetchMidiProject(url, existingConfig?)`**
  - Entry point for URL-based imports
  - Tries multiple path variations (handles relative paths)
  - Fetches file, converts to ArrayBuffer
  - Calls `parseMidiProject(arrayBuffer, url, existingConfig)`

• **`parseMidiProject(arrayBuffer, fileName?, existingConfig?)`**
  - Core parsing logic (all paths converge here)
  - Returns `MidiProjectData` with all extracted data

• **`processMidiFiles(files[])`**
  - Batch processing for multiple MIDI files
  - Merges voices, avoiding duplicates by `originalMidiNote`
  - Returns flat array of `Voice[]` (used for multi-file imports)

---

## Project Export/Import Format

### Export Process (`handleSaveProject`)

• **Location:** `src/workbench/Workbench.tsx` (lines 608-616)

• **Method:**
  ```typescript
  const dataStr = "data:text/json;charset=utf-8," + 
                  encodeURIComponent(JSON.stringify(projectState, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "push3_project.json");
  downloadAnchorNode.click();
  ```

• **Output:** Downloads `push3_project.json` file containing complete `ProjectState` as JSON

### Import Process (`handleLoadProject`)

• **Location:** `src/workbench/Workbench.tsx` (lines 618-658)

• **Method:**
  1. User selects JSON file via file input
  2. `FileReader.readAsText(file)` reads file content
  3. `JSON.parse(content)` parses JSON
  4. **Validation:** Checks for `layouts` array and `projectTempo` number
  5. **Backward Compatibility:** Initializes missing fields with defaults:
     - `parkedSounds: []` if missing
     - `mappings: []` if missing
     - `ignoredNoteNumbers: []` if missing
  6. Calls `setProjectState(loadedState, true)` with `skipHistory=true`

### Complete JSON Structure

The exported JSON is a direct serialization of the `ProjectState` interface:

```json
{
  "layouts": [
    {
      "id": "layout-123",
      "name": "My Layout",
      "createdAt": "2025-01-15T10:30:00.000Z",
      "performance": {
        "events": [
          {
            "noteNumber": 36,
            "startTime": 0.0,
            "duration": 0.25,
            "velocity": 100,
            "channel": 1
          },
          // ... more events (MUST be sorted by startTime)
        ],
        "tempo": 120,
        "name": "Imported Performance"
      }
    }
  ],
  "instrumentConfigs": [
    {
      "id": "inst-1",
      "name": "Standard Drum Kit",
      "rows": 8,
      "cols": 8,
      "bottomLeftNote": 36,
      "layoutMode": "drum_64"
    }
  ],
  "sectionMaps": [],
  "instrumentConfig": { /* same as instrumentConfigs[0] */ },
  "activeLayoutId": "layout-123",
  "projectTempo": 120,
  "parkedSounds": [
    {
      "id": "sound-abc",
      "name": "C2 (36)",
      "sourceType": "midi_track",
      "sourceFile": "drum_loop.mid",
      "originalMidiNote": 36,
      "color": "#ef4444"
    },
    // ... more voices
  ],
  "mappings": [
    {
      "id": "mapping-456",
      "name": "My First Layout",
      "cells": {
        "0,0": { /* Voice object */ },
        "0,1": { /* Voice object */ },
        // ... pad assignments (cellKey → Voice)
      },
      "fingerConstraints": {
        "0,0": "L1",  // Pad locked to Left Thumb
        "1,2": "R2"   // Pad locked to Right Index
      },
      "scoreCache": 85.5,
      "notes": "User notes about this layout",
      "layoutMode": "manual",
      "version": 2,
      "savedAt": "2025-01-15T11:00:00.000Z"
    }
  ],
  "ignoredNoteNumbers": [42, 44],  // Notes to hide in analysis
  "manualAssignments": {
    "layout-123": {
      "0": { "hand": "left", "finger": "thumb" },   // Event 0 → L-Thumb
      "5": { "hand": "right", "finger": "index" }   // Event 5 → R-Index
    }
  },
  "engineConfiguration": {
    "beamWidth": 50,
    "stiffness": 1.0,
    "restingPose": {
      "left": {
        "centroid": { "x": 2, "y": 2 },
        "fingers": {
          "thumb": { "x": 0, "y": 1 },
          "index": { "x": 1, "y": 3 },
          // ... all 5 fingers
        }
      },
      "right": { /* same structure */ }
    }
  },
  "solverResults": {
    "beam": {
      "score": 85,
      "unplayableCount": 0,
      "hardCount": 3,
      "debugEvents": [ /* EngineDebugEvent[] */ ],
      "fingerUsageStats": {
        "L-Thumb": 5,
        "L-Index": 12,
        // ... all fingers
      },
      "fatigueMap": {
        "L-Thumb": 0.5,
        "L-Index": 1.2,
        // ... all fingers
      },
      "averageDrift": 2.3,
      "averageMetrics": {
        "movement": 1.5,
        "stretch": 0.8,
        "drift": 0.3,
        "bounce": 0.2,
        "fatigue": 0.4,
        "crossover": 0.1,
        "total": 3.3
      }
    },
    "genetic": { /* same structure */ },
    "annealing": { /* same structure */ }
  },
  "activeSolverId": "beam"
}
```

### Field Descriptions

• **`layouts`:** Array of layout snapshots (each contains a `Performance` with events)

• **`performance.events`:** Array of `NoteEvent` objects, **MUST be sorted by `startTime` ascending**

• **`parkedSounds`:** Staging area for voices before assignment to grid

• **`mappings[].cells`:** Object mapping pad keys (`"row,col"`) to `Voice` objects

• **`mappings[].fingerConstraints`:** Object mapping pad keys to finger locks (`"L1"`, `"R2"`, etc.)

• **`mappings[].layoutMode`:** `'none'` | `'manual'` | `'random'` | `'optimized'` - tracks how layout was created

• **`manualAssignments`:** Two-level nested object: `layoutId → eventIndex → {hand, finger}`

• **`solverResults`:** Map of solver IDs to `EngineResult` objects (allows comparing multiple solvers)

• **`engineConfiguration`:** Biomechanical solver parameters (beam width, stiffness, resting pose)

### Validation on Import

• **Required Fields:**
  - `layouts` must be an array
  - `projectTempo` must be a number

• **Optional Fields (with defaults):**
  - `parkedSounds`: Defaults to `[]` if missing
  - `mappings`: Defaults to `[]` if missing
  - `ignoredNoteNumbers`: Defaults to `[]` if missing
  - `manualAssignments`: Defaults to `{}` if missing

• **Backward Compatibility:**
  - Old project files missing new fields are automatically initialized
  - `instrumentConfig` falls back to `instrumentConfigs[0]` if missing

---

## Assumptions and Limitations

### MIDI File Assumptions

• **Event Sorting:**
  - **Assumption:** Events are sorted by `startTime` ascending after import
  - **Requirement:** The biomechanical solver processes events sequentially
  - **Enforcement:** `events.sort((a, b) => a.startTime - b.startTime)` in `parseMidiProject`
  - **Impact:** If events are out of order, solver may produce incorrect results

• **Time Units:**
  - **Assumption:** MIDI file uses seconds for time values
  - **Source:** `@tonejs/midi` library converts MIDI ticks to seconds
  - **NoteEvent Fields:**
    - `startTime`: Absolute time in seconds (not beats)
    - `duration`: Duration in seconds (optional)

• **Tempo Handling:**
  - **Assumption:** First tempo event in MIDI header represents the project tempo
  - **Default:** 120 BPM if no tempo found
  - **Limitation:** MIDI files with tempo changes are simplified to single tempo
  - **Impact:** Complex tempo maps are not preserved

• **Note Range:**
  - **Assumption:** MIDI notes are in range 0-127 (standard MIDI specification)
  - **Validation:** No explicit bounds checking (relies on MIDI file validity)

• **Channel Mapping:**
  - **Assumption:** MIDI channels are preserved but not used for filtering
  - **Storage:** `channel` field stored in `NoteEvent` but not used in analysis
  - **Limitation:** Multi-channel MIDI files are flattened (all channels processed together)

### Grid Mapping Assumptions

• **64-Pad Drum Mode Only:**
  - **Assumption:** Only supports 8x8 grid (64 pads)
  - **Enforcement:** `instrumentConfig.rows = 8`, `instrumentConfig.cols = 8`
  - **Layout Mode:** Only `'drum_64'` is supported (melodic modes planned but not implemented)

• **Row-Major Mapping:**
  - **Assumption:** Notes map to pads using row-major order
  - **Formula:** `offset = noteNumber - bottomLeftNote`, `row = floor(offset / 8)`, `col = offset % 8`
  - **Visual:** Row 0 = bottom, Row 7 = top (inverted from logical indexing)

• **Intelligent Root Note:**
  - **Assumption:** Lowest note in MIDI file should map to pad [0,0]
  - **Implementation:** `bottomLeftNote = minNoteNumber` (or 36 if no events)
  - **Benefit:** Maximizes notes that fit in 8x8 window
  - **Limitation:** If MIDI spans >64 notes, some will be unmapped

• **Unmapped Notes:**
  - **Behavior:** Notes outside 8x8 window are counted but NOT filtered
  - **Storage:** All events stored in `Performance`, even if unmapped
  - **Analysis:** Unmapped notes appear as "Unplayable" in solver results
  - **User Control:** Can hide unmapped notes via `ignoredNoteNumbers`

### Explicit Layout Model

• **Grid Starts Empty:**
  - **Assumption:** No automatic pad assignments on MIDI import
  - **Implementation:** `gridMapping.cells = {}`, `layoutMode = 'none'`
  - **Rationale:** Users must explicitly choose layout strategy
  - **User Actions Required:**
    1. Drag & drop voices to pads (sets `layoutMode: 'manual'`)
    2. Click "Assign Manually" for random placement (sets `layoutMode: 'random'`)
    3. Click "Optimize Layout" for biomechanical optimization (sets `layoutMode: 'optimized'`)

• **All Voices in Staging:**
  - **Assumption:** All unique voices go to `parkedSounds` array
  - **No Auto-Mapping:** Voices are NOT automatically placed on grid
  - **Benefit:** User has full control over layout design

### Project Export/Import Limitations

• **No MIDI File Embedding:**
  - **Limitation:** Exported JSON does NOT contain the original MIDI file
  - **Storage:** MIDI files stored separately in `SongService` (base64 in LocalStorage)
  - **Impact:** Loading a project JSON does NOT restore the MIDI file
  - **Workaround:** MIDI must be re-imported or linked separately

• **Solver Results Included:**
  - **Behavior:** `solverResults` map is included in export
  - **Size Impact:** Can make JSON files large (contains all `EngineDebugEvent` arrays)
  - **Benefit:** Preserves analysis results for comparison

• **No Versioning:**
  - **Limitation:** No schema version in exported JSON
  - **Risk:** Future schema changes may break backward compatibility
  - **Mitigation:** Import code has backward compatibility defaults

• **LocalStorage vs File Export:**
  - **LocalStorage:** Uses `saveProjectStateToStorage(id, state)` - stores per-song
  - **File Export:** Uses `handleSaveProject()` - exports complete `ProjectState`
  - **Difference:** File export is manual, LocalStorage is auto-saved

### Performance Constraints

• **Event Count:**
  - **No Hard Limit:** No maximum event count enforced
  - **Practical Limit:** Large MIDI files (>10,000 events) may cause performance issues
  - **Solver Impact:** Beam search scales with event count (O(n) with beam width multiplier)

• **Voice Count:**
  - **Theoretical Max:** 128 unique MIDI notes (0-127)
  - **Practical Max:** 64 voices (one per pad in 8x8 grid)
  - **Unmapped Voices:** Voices outside grid window still stored but marked as unmapped

### Data Integrity Assumptions

• **Unique Voice IDs:**
  - **Assumption:** Each `Voice` has unique `id` (UUID generated)
  - **Enforcement:** `generateId('sound')` creates unique IDs
  - **Risk:** If IDs collide, voice references in mappings may break

• **Mapping Cell Keys:**
  - **Assumption:** Cell keys are valid `"row,col"` format
  - **Validation:** `parseCellKey()` validates format on use
  - **Risk:** Invalid keys in imported JSON may cause errors

• **Manual Assignment Indices:**
  - **Assumption:** Event indices in `manualAssignments` correspond to `performance.events` array
  - **Risk:** If events are filtered/reordered, indices may become invalid
  - **Mitigation:** Manual assignments are layout-specific (keyed by `layoutId`)

---

## Summary

The MIDI import pipeline transforms MIDI files into a structured `ProjectState` with all voices in a staging area, requiring explicit user assignment to pads. The export format is a complete JSON serialization of `ProjectState`, preserving all layouts, mappings, solver results, and user customizations. Key assumptions include event sorting, 64-pad drum mode, and the explicit layout model where grids start empty.

