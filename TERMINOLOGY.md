# Terminology Glossary

**CRITICAL:** This glossary defines the standard terminology used throughout the codebase. Confusing these terms will break the engine.

## Core Concepts

### Sound
**Definition:** The audio character or sample name (e.g., "808 Kick", "Open Hat", "Crash 1").

**Usage:**
- Represents what the user hears
- Displayed in the UI as sound names
- Mapped to `SoundAsset.name` in the codebase

**Example:** "808 Kick" is a Sound.

---

### Voice
**Definition:** A unique MIDI pitch value found in a MIDI file (e.g., MIDI Note 36, MIDI Note 38).

**Usage:**
- Represents a distinct pitch that can be triggered
- Appears in the "Staging Area" (parked sounds)
- One Voice = One unique MIDI note number
- Mapped to `SoundAsset.originalMidiNote` in the codebase

**Example:** MIDI Note 36 is a Voice. If a MIDI file contains notes 36, 38, and 40, there are 3 Voices.

**⚠️ DO NOT CONFUSE:** Voice ≠ Note Event. A Voice is the pitch value; a Note Event is when that Voice is triggered in time.

---

### Cell
**Definition:** A slot in the abstract 128-slot Ableton Drum Rack (Index 0–127).

**Usage:**
- Represents a position in the Drum Rack's internal structure
- One Voice maps to one Cell
- Cells are indexed 0-127
- Used internally for mapping logic

**Example:** Cell 36 corresponds to MIDI Note 36 in the Drum Rack.

**⚠️ DO NOT CONFUSE:** Cell ≠ Pad. A Cell is an abstract slot; a Pad is a physical button on the hardware.

---

### Pad
**Definition:** A physical button on the 8x8 hardware grid of the Ableton Push 3.

**Usage:**
- Coordinates: Row 0-7, Col 0-7 (64 total pads)
- Row 0 = bottom row (visually)
- Row 7 = top row (visually)
- Col 0 = leftmost column
- Col 7 = rightmost column
- Represented as `{ row: number, col: number }` in the codebase

**Example:** Pad [0, 0] is the bottom-left physical button on the Push 3.

**⚠️ DO NOT CONFUSE:** Pad ≠ Cell. A Pad is a physical location; a Cell is an abstract slot.

---

### Assignment
**Definition:** The relationship mapping a Cell (and its Voice) to a Pad.

**Usage:**
- Defines which Voice plays when a Pad is pressed
- Stored in `GridMapping.cells` as `{ [cellKey]: SoundAsset }`
- cellKey format: `"${row},${col}"` (e.g., `"0,0"`)

**Example:** "Cell 36 (Voice 36) is assigned to Pad [0, 0]" means pressing the bottom-left pad triggers MIDI Note 36.

**⚠️ CRITICAL:** The engine relies on correct Assignment mappings. Incorrect mappings break ergonomic calculations.

---

### Note Event
**Definition:** A specific instance in time where a Voice is triggered.

**Usage:**
- Has a `startTime` (when it occurs)
- Has a `duration` (how long it lasts)
- Has a `noteNumber` (which Voice is triggered)
- Represented as `NoteEvent` in the codebase
- Multiple Note Events can use the same Voice

**Example:** A performance might have Note Events at 0.0s, 0.5s, and 1.0s, all triggering Voice 36.

**⚠️ DO NOT CONFUSE:** Note Event ≠ Voice. A Voice is the pitch value; a Note Event is when that Voice is played.

---

### Finger
**Definition:** The biomechanical effector used to press a Pad.

**Usage:**
- Left Hand: L-Thumb (1), L-Index (2), L-Middle (3), L-Ring (4), L-Pinky (5)
- Right Hand: R-Thumb (1), R-Index (2), R-Middle (3), R-Ring (4), R-Pinky (5)
- Represented as `FingerID` (1-5) with hand context (`'LH' | 'RH'`)
- Used in ergonomic cost calculations

**Example:** "L-Index" means Left Hand, Index Finger (FingerID: 2, Hand: 'LH').

---

## Common Confusions to Avoid

| ❌ Wrong | ✅ Correct |
|---------|-----------|
| "Note 36 is on Pad [0,0]" | "Voice 36 (Cell 36) is assigned to Pad [0,0]" |
| "The pad plays note 36" | "The pad triggers Voice 36" |
| "Note event at pad [0,0]" | "Note Event triggering Voice 36 (assigned to Pad [0,0])" |
| "Cell [0,0]" | "Pad [0,0]" or "Cell 36" (never mix coordinates) |

---

## Codebase Mapping

| Term | Type/Interface | Key Properties |
|------|---------------|----------------|
| Sound | `SoundAsset.name` | `string` |
| Voice | `SoundAsset.originalMidiNote` | `number` (MIDI 0-127) |
| Cell | `GridMapping.cells[cellKey]` | Indexed by `"${row},${col}"` |
| Pad | `{ row: number, col: number }` | `row: 0-7, col: 0-7` |
| Assignment | `GridMapping.cells` | `Record<string, SoundAsset>` |
| Note Event | `NoteEvent` | `{ noteNumber, startTime, duration, ... }` |
| Finger | `FingerID` + `'LH'\|'RH'` | `1-5` + hand context |

---

## Quick Reference

- **Sound** = What you hear ("808 Kick")
- **Voice** = MIDI pitch value (36, 38, 40...)
- **Cell** = Drum Rack slot (0-127)
- **Pad** = Physical button [row, col] on Push 3
- **Assignment** = Cell → Pad mapping
- **Note Event** = Voice triggered at a specific time
- **Finger** = Biomechanical effector (L-Index, R-Thumb, etc.)

