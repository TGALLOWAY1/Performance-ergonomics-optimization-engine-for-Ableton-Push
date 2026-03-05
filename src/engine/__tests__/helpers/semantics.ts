/**
 * SOLVER TEST SEMANTICS
 * 
 * This file documents the behavioral contract of the BiomechanicalSolver
 * for test validation purposes.
 * 
 * ## Time Units
 * 
 * - **Canonical unit: SECONDS**
 * - `startTime` and `duration` in NoteEvent are in seconds
 * - `tempo` is informational only (BPM) - the solver does NOT convert beats to seconds
 * - MIDI import (`parseMidiProject`) uses `@tonejs/midi` which outputs seconds
 * - Fixtures should store seconds; use `beatsToSeconds(beats, bpm)` when authoring in beats
 * 
 * ## Result Semantics
 * 
 * ### unplayableCount
 * - Notes that have no valid pad in the current grid (outside InstrumentConfig window
 *   or not in GridMapping.cells) produce `assignedHand: 'Unplayable'`
 * - These ARE counted in `unplayableCount`
 * - "Unmapped" => Unplayable => increments unplayableCount
 * 
 * ### ignoredNoteNumbers (app-layer)
 * - Applied BEFORE the solver at the app layer (src/utils/performanceSelectors.ts)
 * - The solver never sees ignored notes unless tests pass an unfiltered performance
 * - If an ignored note is passed to solver and is off-grid, it becomes Unplayable
 * - For solver tests: test "ignored" at app layer with filtered performance,
 *   or pass off-grid notes to verify they don't break scoring
 * 
 * ### hardCount
 * - "Technically playable but high cost" (difficulty: Hard)
 * - Distinct from Unplayable; does NOT mean "constraint-violating but still assigned"
 * - Difficulty levels: Easy, Medium, Hard, Unplayable
 * 
 * ### score
 * - Formula: `100 - (5 * hardCount) - (20 * unplayableCount)`
 * - **LOWER score = WORSE** (more hard/unplayable notes)
 * - Perfect score = 100 (all notes Easy/Medium, none Hard/Unplayable)
 * 
 * ## debugEvents Contract
 * 
 * Current solvers (BeamSolver, GeneticSolver) emit ONE debug event per input event
 * and set `eventIndex` and `eventKey` on each.
 * 
 * - Do NOT assume `debugEvents.length === performance.events.length` without verification
 * - Join by `eventKey` (or by index if eventKey is absent)
 * - Assert: every input eventKey appears at least once in debugEvents
 * - Assert: ordering is non-decreasing by input event index
 * 
 * ## Feasibility
 * 
 * - `toBeFeasible()` <=> `unplayableCount === 0`
 * - `toBeInfeasible()` <=> `unplayableCount > 0`
 * 
 * ## L01 "Standard" Mapping
 * 
 * - Push chromatic layout is row-major from `bottomLeftNote`
 * - When GridMapping is null, solvers use GridMapService.noteToGrid()
 * - Do NOT hand-roll L01 mapping; use null or app-exported fixture
 * - This ensures tests validate the same coordinate model as production
 */

/**
 * ## Policy Decisions (see solver.policy.test.ts)
 * 
 * ### Unmapped Notes Policy
 * - Notes outside the grid are counted as UNPLAYABLE
 * - They increment `unplayableCount`
 * - They get `assignedHand: 'Unplayable'` in debugEvents
 * - They do NOT cause errors or crashes
 * - They do NOT affect scoring of playable notes
 * 
 * ### Grid Bounds
 * - Valid grid positions are row 0-7, col 0-7 (8x8 grid)
 * - Notes below `bottomLeftNote` are unmapped
 * - Notes above `bottomLeftNote + 63` are unmapped
 * - Standard bottomLeftNote = 36, so valid range is 36-99
 * 
 * ### Chord Handling
 * 
 * **Chord Grouping Definition:**
 * - Events with EXACT same `startTime` (floating-point equality) form a chord group
 * - No tolerance window currently applied (future: may add ≤10ms tolerance)
 * - Events are NOT sorted before grouping (order in input array may affect processing order)
 * 
 * **Finger Assignment Rule for Chords:**
 * - For true-simultaneous chord groups, no finger may be assigned to two notes in the same group
 * - This is a BEST-EFFORT constraint, not a hard guarantee
 * - If a chord has more notes than available fingers (>10), some notes may share fingers
 *   or be marked as hard/unplayable
 * 
 * **Permutation Stability:**
 * - Reordering chord notes in the input should NOT change:
 *   - Feasibility (unplayableCount)
 *   - Overall score
 *   - Total cost (within epsilon)
 *   - Number of unique finger assignments
 * 
 * **Future Considerations:**
 * - Micro-arpeggiated chords (tolerance window) may be added
 * - Repeated notes in a chord are currently processed as separate events
 * 
 * ### Score Direction
 * - LOWER score = WORSE
 * - Perfect score = 100
 * - Score decreases with more hard/unplayable notes
 * 
 * ### L01 Standard Chromatic Layout
 * - The default layout maps notes to pads using row-major ordering:
 *   `row = floor((note - bottomLeftNote) / 8)`
 *   `col = (note - bottomLeftNote) % 8`
 * - This is the Push 3 standard 64-pad chromatic drum mode
 * - Changes to this formula are considered BREAKING CHANGES
 * - A frozen reference (L01_standard_frozen.json) guards against drift
 */

export const SEMANTICS_VERSION = '1.2.0';

/**
 * Chord grouping tolerance in seconds.
 * Currently 0 (exact equality). May be increased to ~0.010 (10ms) in future.
 */
export const CHORD_GROUPING_TOLERANCE_SECONDS = 0;
