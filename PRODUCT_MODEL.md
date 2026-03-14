# Product Model

## Product Purpose

The repository implements a local-first desktop-style web app for turning a MIDI performance into a playable Ableton Push drum-pad layout. The product combines three responsibilities:

1. Import and persist song-specific performance material.
2. Author or generate an 8x8 pad mapping for the required notes.
3. Evaluate that mapping with a biomechanical solver and expose the result through summary, timeline, and event-level analysis views.

This is not a generic DAW companion or a generic MIDI viewer. The product is specifically built around Push-style grid performance ergonomics.

## Primary User

Primary user:

- A Push performer, finger drummer, or electronic musician who wants a MIDI-driven pad layout that is physically playable for their hands.

Secondary users:

- A power user comparing solver outputs and layout strategies.
- A developer or researcher inspecting cost breakdowns and transition behavior through debug tooling.

## Core Job To Be Done

When I have a MIDI performance I want to play on an 8x8 Push grid, I want to place or optimize the required notes onto pads in a way that fits my hands and movement limits so I can perform the piece with less strain and fewer awkward transitions.

Supporting jobs:

- Understand why a mapping is difficult.
- Personalize the solver with my natural resting hand pose.
- Save work per song and return later.
- Export project state or analysis artifacts when needed.

## Product Boundary

The current product covers:

- Song portfolio management in local storage.
- MIDI linking/import into a song-specific project state.
- Layout authoring on a fixed 8x8 `drum_64` grid.
- Pose-aware deterministic seeding and solver-aware optimization.
- Solver result inspection across multiple analysis surfaces.

The current product does not fully cover:

- Audio or MIDI playback.
- Cloud sync or multi-user collaboration.
- A live section-based workflow, despite dormant `sectionMaps`.
- Multiple instrument modes beyond `drum_64`.

## Major Workflows

| Workflow | User intent | Main outcome |
|---|---|---|
| Create/select song | Choose a container for work | Active song in dashboard |
| Link MIDI to song | Bring in playable source material | `Song` metadata plus persisted `ProjectState` |
| Open workbench | Hydrate song state into editing context | Active layout, mapping, voices, pose, solver state |
| Configure Pose 0 | Personalize neutral hand positions | Updated `naturalHandPoses[0]` |
| Build mapping | Place notes on pads manually or with helpers | Updated `GridMapping` |
| Run analysis | Score current mapping without changing layout | Stored `EngineResult` in `solverResults` |
| Optimize layout | Improve mapping ergonomically | Overwritten or updated mapping plus annealing result |
| Inspect chronology | Review event order and finger labels | Timeline understanding |
| Inspect transitions | Review event-to-event difficulty | Analyzed events, transitions, onion-skin model |
| Persist/export | Save or move data out of app | Song-local autosave, project JSON, event-analysis JSON |

## Core Domain Objects

| Object | Role in product |
|---|---|
| `Song` | Portfolio entry and entry point into a project |
| `ProjectState` | Canonical project-level source of truth |
| `LayoutSnapshot` | Imported performance context stored inside project state |
| `Performance` | Sorted list of musical note events to be analyzed |
| `NoteEvent` | Individual timed note trigger from MIDI |
| `InstrumentConfig` | Defines the 8x8 window and bottom-left note |
| `Voice` | Unique note identity exposed to the user as a draggable sound |
| `GridMapping` | Pad-to-voice assignment model being authored and optimized |
| `NaturalHandPose` | User-specific neutral finger placement model |
| `EngineConfiguration` | Solver tuning and resting-pose settings |
| `EngineResult` | Stored solver output for a mapping/performance pair |
| `EngineDebugEvent` | Per-event assignment and cost detail |
| `AnalyzedEvent` | Grouped polyphonic moment derived from debug events |
| `Transition` | Derived movement analysis between consecutive analyzed events |

## Product Rules, Constraints, and Invariants

### Structural constraints

- The pad surface is always 8 columns by 8 rows.
- The active performance must be sorted by `startTime`.
- Row indexing is fixed: row `0` is bottom, row `7` is top.
- Pad identifiers are encoded as `"row,col"`.
- Only `drum_64` instrument mode is currently active in product behavior.

### Workflow constraints

- MIDI import creates an explicit empty grid; voices start in staging, not pre-placed.
- Optimization requires full note coverage in the current mapping.
- Pose-driven flows assume `naturalHandPoses[0]` exists and is valid.
- Cross-route analysis should follow `activeMappingId` and `activeLayoutId`.
- Manual finger overrides should be keyed by stable `eventKey` when present.

### Persistence constraints

- Songs are stored in `push_perf_songs`.
- Project states are stored in `push_perf_project_<projectStateId>`.
- Theme is stored in `push_perf_theme`.
- Workbench auto-saves a hydrated song state after a debounce.

## State Model

Primary source of truth:

- `ProjectContext.projectState`

Durable supporting state:

- `SongService` song catalog
- per-song persisted `ProjectState`

Derived state:

- `engineResult` from `solverResults[activeSolverId]`
- filtered active performance from `ignoredNoteNumbers`
- analyzed event/transition/onion-skin models

Transient view state:

- selected tabs, zoom, selected event index, edit mode, menus, drag state, solver progress

## Terminology Glossary

| Term | Canonical meaning in this product |
|---|---|
| Song | The portfolio-level container the user selects on the dashboard |
| Project | The persisted working state attached to a song |
| Performance | Time-sorted musical data derived from MIDI |
| Note Event | One timed note occurrence in a performance |
| Voice | A unique note identity that can be assigned to a pad |
| Cell | The MIDI note slot identity behind a voice; often expressed as the note number |
| Pad | A physical grid position on the 8x8 layout |
| Mapping | The current pad-to-voice assignment model |
| Layout | User-facing synonym for the current mapping configuration; in code this also appears in `LayoutSnapshot`, so the term is overloaded |
| Pose 0 | The default personalized natural hand pose at `naturalHandPoses[0]` |
| Manual Assignment | A user override of solver-selected hand/finger for a specific event |
| Solver Result | Stored ergonomic analysis output for a solver run |
| Event Analysis | Derived view that groups notes into moments and transitions |
| Timeline | Chronological lane view of the mapped performance |

## Canonical Product Statement

The true product model is: a song-scoped Push layout workstation that imports MIDI into a project, lets the user author or generate a pad mapping, personalizes that mapping with a natural hand pose, and evaluates the mapping through a biomechanical analysis pipeline.
