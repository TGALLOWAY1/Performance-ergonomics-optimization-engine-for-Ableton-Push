Ableton Push 3 Performability Engine - Architecture Reference

1. Project Overview

Goal: A CAD-like tool for designing, analyzing, and optimizing custom Drum Rack layouts for the Ableton Push 3.
Core Philosophy: Move beyond simple "MIDI analysis" to a "Biomechanical Simulation" that models human hand physiology to score playability.

2. Core Domain Concepts

2.1 The Grid (Push 3 Hardware Constraint)

The physical interface is strictly modeled on the Ableton Push 3 64-Pad Drum Mode.

Dimensions: 8 Rows × 8 Columns.

Coordinate System: Row-Major, 0-indexed.

[0,0] = Bottom-Left Pad.

[7,7] = Top-Right Pad.

Note: Visually, Row 7 is at the top of the screen, Row 0 is at the bottom.

2.2 Finger Notation (Standard)

We use standard piano fingering notation combined with Hand labels.

Hands: 'L' (Left), 'R' (Right).

Fingers: 1 (Thumb) through 5 (Pinky).

Format: L1, R3, L5.

3. Data Architecture

3.1 Sound Assets (The Atomic Unit)

Decouples the physical sound from the MIDI note.

interface SoundAsset {
  id: string;              // UUID
  name: string;            // Display name (e.g., "Kick", "Bass 1")
  color: string;           // Visual hex code
  sourceType: 'midi_track' | 'audio_slice';
  sourceFile: string;      // Origin filename
  originalMidiNote: number | null; // If MIDI, the note in the source file
  audioSlice: {            // If Audio, the slice metadata
    bufferId: string;
    startTime: number;
    duration: number;
  } | null;
}


3.2 Grid Mapping (The Layout)

Represents a specific arrangement of sounds on the 8x8 grid.

interface GridMapping {
  id: string;
  name: string;            // e.g., "Ergonomic V1"
  cells: Record<string, SoundAsset>; // Key: "row,col" (e.g., "0,0")
  fingerConstraints: Record<string, string>; // Key: "row,col", Value: "L1"
  scoreCache: number | null; // Last calculated performability score
  notes: string;           // User annotations
}


3.3 Project State (Global Store)

interface ProjectState {
  parkedSounds: SoundAsset[];      // Staging area for unassigned sounds
  mappings: GridMapping[];         // All saved layout variations
  activeMappingId: string | null;  // Currently visible layout
  performance: Performance;        // The musical pattern (MIDI data)
  audioBuffers: Record<string, AudioBuffer>; // Memory cache for audio
}


4. The Performability Engine (Biomechanical Simulation)

The engine determines Difficulty (0-100) by simulating how a human would play a pattern.

4.1 Biomechanical Hand Model

Instead of a single point, the hand is modeled as a topological cluster.

State: Tracks 5 individual finger positions + Wrist Centroid.

Fatigue: Tracks accumulated stress per finger (Decays over time).

4.2 Layer 1: Feasibility (Hard Constraints)

Before scoring, a move is vetted for physical possibility.

Max Span: Distance from Wrist to Finger Target must be < 5.5 grid units.

Finger Ordering: Relative to the hand's orientation, fingers must not cross impossibly (e.g., RH Thumb cannot be right of RH Pinky).

Collision: Two fingers cannot occupy the same pad.

Manual Constraints: If a cell has a "Lock" (e.g., L1), only that finger is valid.

4.3 Layer 2: Cost Model (Soft Heuristics)

Valid moves are scored on "Cost" (Lower is better).
$$ \text{Cost} = (\text{Distance} \times \text{StrengthWeight}) + \text{Fatigue} + \text{DriftPenalty} $$

Strength Weights: Thumb/Index (1.0) are cheaper than Pinky (1.5).

Fatigue: Rapid repetition increases cost.

Drift: Penalty for moving far from the section's "Home Position."

4.4 Layer 3: Solver (The Algorithm)

Strategy: Greedy Search with Lookahead (1-step).

Loop:

Generate 10 Candidates (L1-L5, R1-R5).

Filter candidates via Feasibility Layer.

Score candidates via Cost Model.

Winner takes the note; update Hand State & Fatigue.

5. System Modules & Services

5.1 Workbench (UI Layer)

LayoutDesigner: The primary workspace.

Left Panel: Library (Draggable SoundAssets).

Center: GridEditor (Droppable 8x8 Zones).

Right: Layout Properties & Scoreboard.

GridEditor: Renders the 8x8 view. Handles "Ghost Hand" reachability overlays and Heatmaps.

ImportWizard: Modal for ingesting MIDI/Audio, splitting multi-note files, and naming assets.

5.2 GridMapService (Logic Layer)

Responsibility: Translates (Row, Col) $\leftrightarrow$ MIDI Note.

Update: Must now look up the activeMapping to find the MIDI note, rather than using strict linear math (unless using a default template).

5.3 Audio/MIDI Services (Utility Layer)

MidiImport: Parses files, identifies unique pitch classes for asset creation.

MidiExport: Generates new MIDI files by re-mapping original notes to their new grid positions.

AudioSlicer (Web Worker): Background thread for analyzing/slicing WAV files to prevent UI freezing.

6. Key Workflows

6.1 The Import Flow

User drags MIDI/Audio files to Library.

Wizard detects content:

Single-Note MIDI: Creates 1 Asset.

Multi-Note MIDI: Splits into multiple Assets (e.g., "Bass 1", "Bass 2").

Audio: Slices into chunks via Web Worker.

Assets appear in Staging Area.

6.2 The Design Flow

User drags Asset from Staging to Grid [0,0].

Live Scoring: Engine re-runs simulation in background; Score updates.

Constraint Check: User right-clicks [0,0], selects "Show Reach for L1". Grid dims unreachable cells.

User moves Asset to [0,1] based on visual feedback.

6.3 The Export Flow

User selects "Export to Push".

System iterates original MIDI.

Lookup: Note 36 $\rightarrow$ Asset "Kick" $\rightarrow$ Grid [0,1] $\rightarrow$ New Note 37.

Browser downloads Song_Remapped.mid.