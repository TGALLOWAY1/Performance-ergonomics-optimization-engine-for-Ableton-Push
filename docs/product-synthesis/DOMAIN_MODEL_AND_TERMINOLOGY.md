# Domain Model and Terminology

## Why This Document Matters

The repo has clearly been trying to standardize terminology, but current product language is still mixed across older docs, active code, UI labels, and historical artifacts. This document captures a first-pass canon based on current code truth, then calls out where meaning still drifts.

## Terminology Glossary

| Term | Definition as implied by the repo | Where it is used | Consistency | Related / overlapping terms |
|---|---|---|---|---|
| Song | A portfolio-level container for metadata, linked MIDI, and a pointer to project state | `src/types/song.ts`, Dashboard, `SongService` | Mostly consistent | performance, project |
| Song metadata | Human-facing info about the song such as title, BPM, rating, tags | `src/types/song.ts`, Dashboard UI | Consistent | practice metrics, portfolio |
| Performance | The time-ordered note-event sequence to analyze | `src/types/performance.ts`, engine, Event Analysis, Timeline | Strongly consistent | song, layout snapshot |
| Note event | A single occurrence of a note number at a specific time | `src/types/performance.ts:NoteEvent` | Consistent | voice |
| `eventKey` | Deterministic stable identity for an event based on timing, note, channel, and ordinal | `src/utils/midiImport.ts`, manual-assignment flows | Consistent in newer code | event index |
| Voice | A unique MIDI pitch extracted from a performance and made assignable to a pad | `src/types/layout.ts`, `src/utils/midiImport.ts`, Workbench | Improved, but still mixed in comments/UI | sound, note, cell |
| Sound | Usually a legacy or UI-friendly name for a voice; often still used in prop/function names | many Workbench component names and handlers | Inconsistent | voice |
| Cell | An abstract slot in the drum-rack / note-number sense, not a physical pad | `docs/TERMINOLOGY.md`, some comments | Conceptually defined, but not always used consistently in active code | pad, note |
| Pad | A physical grid location on the 8x8 surface, usually addressed as `row,col` | `src/types/layout.ts`, `src/types/eventAnalysis.ts`, grid UI | Consistent | cell |
| Assignment | Mapping a voice to a pad, or assigning a finger to an event, depending on context | many files | Overloaded | mapping, finger assignment, manual assignment |
| Layout snapshot | A saved container for a `Performance` plus metadata like name and createdAt | `src/types/projectState.ts:LayoutSnapshot` | Technically consistent, product meaning is weak | layout, mapping |
| Grid mapping | The current note/voice-to-pad placement plus finger locks and notes | `src/types/layout.ts:GridMapping` | Strongly consistent in code | layout |
| Layout mode | A label explaining how a mapping came to exist or change (`manual`, `random`, `optimized`, `auto`, `none`) | `src/types/layout.ts`, Workbench | Consistent | mapping origin |
| Layout | Used ambiguously in product copy. Sometimes means `LayoutSnapshot`, sometimes `GridMapping`, sometimes the whole arrangement idea | headers, docs, comments | Inconsistent | mapping, project, section |
| Instrument config | The Push grid configuration, especially bottom-left note and supported mode | `src/types/performance.ts:InstrumentConfig` | Consistent | grid window |
| Natural hand pose / Pose 0 | User-defined finger resting positions on the pad grid | `src/types/naturalHandPose.ts`, Workbench Pose tab | Strongly consistent | neutral pose, resting pose |
| Resting pose | Engine-level left/right hand home geometry used in configuration | `src/types/performance.ts:RestingPose`, `src/types/projectState.ts` | Consistent technically, but overlaps conceptually with Pose 0 | neutral pose |
| Neutral pose / neutral pad positions | Solver-facing conversion of hand-pose assumptions into pad coordinates | `src/engine/handPose.ts` | Consistent in engine code | Pose 0, resting pose |
| Manual assignment | Explicit user override for hand/finger on an event | `ProjectState.manualAssignments`, Event Log | Consistent in newer code | finger assignment |
| Finger assignment | Which hand/finger plays an event or note | grid overlay, tables, event log, timeline labels | Consistent concept, many visual forms | manual assignment |
| Engine result | The analysis result currently being visualized | `src/context/ProjectContext.tsx`, pages/panels | Mostly consistent | solver result |
| Solver result | Stored result for a specific solver family such as beam, genetic, or annealing | `ProjectState.solverResults` | Consistent | engine result |
| Debug event | Per-event analysis record from the engine including cost, difficulty, row/col, hand, and finger | `src/engine/core.ts`, Event Log, Cost Debug | Consistent | note event |
| Analyzed event | A grouped simultaneous moment built from debug events | `src/types/eventAnalysis.ts`, Event Analysis page | Consistent in current code, but tests still show older expectations | event, debug event |
| Transition | The movement relationship between two consecutive analyzed events | `src/types/eventAnalysis.ts`, Event Analysis page | Consistent | event |
| Onion skin | A visualization model showing current/previous/next pads and finger moves | `src/types/eventAnalysis.ts`, `src/engine/onionSkinBuilder.ts` | Consistent in current code | event analysis |
| Workbench | The main routed editing environment | `src/workbench/Workbench.tsx` | Consistent | editor |
| Timeline | Chronological event visualization for a mapped performance | `src/pages/TimelinePage.tsx` | Consistent | practice, event analysis |
| Optimization | Rearranging the pad mapping to reduce ergonomic cost | `optimizeLayout`, annealing surfaces | Mostly consistent | solver run, auto-arrange |
| Analysis | Evaluating playability and visualizing it | many routes and components | Broad and overloaded | solver run, optimization |
| Constraint | A hard or soft rule affecting movement feasibility or user-imposed finger usage | engine feasibility, finger locks | Consistent | cost, lock |
| Cost | Numeric penalty from one or more ergonomic factors | engine models, cost debug, analysis panel | Consistent | score, difficulty |
| Score / ergonomic score | High-level result communicated to users from accumulated cost outcomes | Analysis panel, Event Analysis header | Mostly consistent | cost |
| Section map | A time-based mapping structure for song sections | `src/types/performance.ts`, `ProjectState.sectionMaps` | Dormant / unclear | section, song |
| Template | Predefined suggested pad assignment scheme | `src/types/layout.ts` | Hidden / unclear | standard kit |

## Domain Objects

### Core durable product objects

| Object | What it represents | Key fields | Canonical / derived / transient |
|---|---|---|---|
| `Song` | Portfolio container for a user's saved work | `metadata`, `projectStateId`, `midiData`, `midiFileName`, `sections` | canonical durable object |
| `SongMetadata` | Dashboard-facing descriptive fields | `title`, `bpm`, `key`, `performanceRating`, `tags` | canonical durable sub-object |
| `ProjectState` | Main persisted workbench state for a song | `layouts`, `mappings`, `parkedSounds`, `manualAssignments`, `solverResults`, `naturalHandPoses`, `activeMappingId` | canonical durable object |
| `LayoutSnapshot` | Named performance snapshot inside project state | `id`, `name`, `performance`, `createdAt` | canonical durable object |
| `GridMapping` | Voice-to-pad placement and mapping metadata | `cells`, `fingerConstraints`, `layoutMode`, `scoreCache`, `version`, `savedAt` | canonical durable object |
| `Voice` | One assignable unique MIDI pitch | `id`, `name`, `originalMidiNote`, `color`, `sourceType` | canonical durable object |
| `InstrumentConfig` | The active grid-note mapping basis | `bottomLeftNote`, `rows`, `cols`, `layoutMode` | canonical durable object |
| `NaturalHandPose` | User-specific finger resting positions | `fingerToPad`, `positionIndex`, `maxUpShiftRows` | canonical durable object |

### Core computed analysis objects

| Object | What it represents | Key fields | Canonical / derived / transient |
|---|---|---|---|
| `EngineResult` | Solver output for a particular mapping/performance combination | `score`, `debugEvents`, `averageMetrics`, `fatigueMap`, `hardCount`, `unplayableCount` | derived but persisted in `ProjectState.solverResults` |
| `EngineDebugEvent` | Per-note or per-trigger analysis output | `noteNumber`, `startTime`, `assignedHand`, `finger`, `row`, `col`, `cost`, `costBreakdown` | derived |
| `AnalyzedEvent` | Grouped simultaneous moment derived from debug events | `eventIndex`, `timestamp`, `notes`, `pads`, `eventMetrics` | derived transient UI model |
| `Transition` | Relationship between two consecutive analyzed events | `fromIndex`, `toIndex`, `metrics` | derived transient UI model |
| `OnionSkinModel` | Focused event-analysis visualization model | `currentEvent`, `previousEvent`, `nextEvent`, `sharedPads`, `fingerMoves` | derived transient UI model |
| `MappingCoverageResult` | Whether a mapping covers the notes in a performance | `unmappedNotes`, `mappedNotes`, `mappedEventCount` | derived transient validation model |

### Important transient UI state

| State | What it represents | Where it lives |
|---|---|---|
| `activeMappingId` | Which mapping is being viewed/edited across routes | `ProjectState.activeMappingId` |
| `selectedEventIndex` | Which analyzed event / transition is focused in Event Analysis | `src/workbench/EventAnalysisPanel.tsx` |
| `ignoredNoteNumbers` | Which voices are hidden from filtered performance | `ProjectState.ignoredNoteNumbers` |
| `showNoteLabels`, `showPositionLabels`, `showHeatmap` | Workbench view toggles | local state in `Workbench` |
| `theme` | current theme mode | `ThemeContext` |

## Relationship Map

```text
Song
  -> projectStateId
  -> SongMetadata
  -> optional MIDI payload

ProjectState
  -> LayoutSnapshot[] (contains Performance)
  -> GridMapping[] (contains pad assignments)
  -> Voice[] parkedSounds
  -> manualAssignments[layoutId][eventKey]
  -> solverResults[solverId]
  -> NaturalHandPose[] (Pose 0 at index 0)
  -> activeLayoutId / activeMappingId

Performance
  -> NoteEvent[]
  -> tempo / name

GridMapping
  -> cells["row,col"] = Voice
  -> fingerConstraints["row,col"] = "L2" / "R4"

EngineResult
  -> debugEvents[]
  -> score / counts / average metrics

Event Analysis
  EngineResult.debugEvents
    -> AnalyzedEvent[]
    -> Transition[]
    -> OnionSkinModel
```

## Canonical vs Derived vs Dormant

### Likely canonical concepts

- `Song`
- `ProjectState`
- `Performance`
- `GridMapping`
- `Voice`
- `NaturalHandPose`
- `EngineResult` per solver

### Derived concepts

- ergonomic score
- cost breakdown
- grouped analyzed events
- transitions
- onion-skin model
- coverage metrics

### Dormant or weakly canonical concepts

- `sectionMaps`
- layout templates
- song `sections`
- some historical "AnalysisView" architecture mentioned in older docs/audit notes

## Terminology Problems

### Overloaded terms

| Term | Problem | Examples |
|---|---|---|
| layout | Can mean performance snapshot, pad mapping, generated arrangement, or workflow stage | `LayoutSnapshot`, `GridMapping`, header copy, layout mode |
| assignment | Can mean voice-to-pad assignment, finger-to-event assignment, or finger-lock constraint | `GridMapping.cells`, `manualAssignments`, context-menu finger locks |
| analysis | Can mean solver execution, summary visualization, event drill-down, or debug inspection | Workbench, Event Analysis, Cost Debug |

### Synonyms for the same or near-same concept

| Concept | Competing names |
|---|---|
| unique pitch object | `Voice`, `Sound`, sometimes `note` |
| finger-hand notation | `left/right`, `L/R`, `LH/RH`, `L1/R2` |
| preferred hand baseline | `Natural Hand Pose`, `Pose 0`, `neutral pose`, `resting pose` |

### Concepts split across multiple names

| Concept | Split names | Why it matters |
|---|---|---|
| the editable pad-placement artifact | `mapping`, `layout`, `Quadrant Layout`, `Optimized Layout`, `New Mapping` | Makes it hard to speak clearly about what exactly is being changed |
| the time-based musical input | `song`, `performance`, `layout`, `section` | Top-level product framing gets blurry |

### Terms whose meaning changes by page or subsystem

| Term | Where meaning shifts |
|---|---|
| event | raw note event in engine/performance; grouped simultaneous moment in Event Analysis |
| layout | mapping in Workbench UI; performance container in type names; section layout in header copy |
| practice | route-level aspiration in historical docs; current visual stepper in Event Analysis; not a dedicated routed product flow |

## First-Pass Terminology Canon Recommendation

If the product were normalized around current code truth, the clearest working canon would likely be:

- Song:
  - the portfolio-level container
- Performance:
  - the imported time-ordered MIDI event data
- Voice:
  - one unique MIDI pitch extracted from that performance
- Pad:
  - one physical 8x8 coordinate
- Mapping:
  - the current voice-to-pad placement
- Natural Hand Pose:
  - the user's preferred finger resting arrangement on the grid
- Analysis result:
  - a solver output explaining the playability of a performance under a mapping
- Optimization:
  - a mapping rewrite intended to improve that analysis result

That canon is not fully enforced in the current repo yet, but it best matches the current operational center of the application.

