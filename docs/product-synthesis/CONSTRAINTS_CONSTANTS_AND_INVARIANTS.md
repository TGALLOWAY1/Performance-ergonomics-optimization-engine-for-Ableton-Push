# Constraints, Constants, and Invariants

## Scope

This document captures product-relevant rules and tunables that materially affect behavior. It includes explicit constants from engine code, workflow constraints enforced in UI logic, and invariants that the system appears to rely on.

## Product Constraints

| Name | Description | Where defined or enforced | Enforced consistently? | Risks if violated |
|---|---|---|---|---|
| Explicit empty-grid import model | MIDI import creates an empty grid and puts all voices in staging | `src/utils/midiImport.ts`, `src/services/SongService.ts:createProjectStateFromMidi`, `docs/MilestoneNotes/2025-11-29-explicit-layout-model.md` | Yes in current import path | Users or future code may assume import should auto-map voices |
| Song-specific local persistence | Each song points to one project-state blob in localStorage | `src/services/SongService.ts`, `src/utils/projectPersistence.ts` | Yes | Confusion if users expect cloud sync or shared project states |
| Optimization requires full coverage | Auto-arrange is blocked if the current mapping does not cover all notes used in the performance | `src/workbench/Workbench.tsx`, `src/engine/mappingCoverage.ts` | Yes in current UI path | Optimization results would be misleading or invalid with unmapped notes |
| Pose-aware workflows assume Pose 0 exists | Natural assignment and pose-driven seed require a valid pose | `src/workbench/Workbench.tsx`, `src/context/ProjectContext.tsx`, `src/types/naturalHandPose.ts` | Yes | User may not understand why pose-less flows are weaker or blocked |
| Dev-only debug route | Cost Debug should only be available in development builds | `src/main.tsx`, `src/pages/CostDebugPage.tsx` | Yes | Production UX would expose internal debug concepts |

## Domain Constraints

| Name | Description | Where defined or enforced | Enforced consistently? | Risks if violated |
|---|---|---|---|---|
| 8x8 pad grid | The physical grid model is fixed to 8 rows and 8 columns | `src/types/performance.ts:InstrumentConfig`, `src/engine/gridMapService.ts`, grid rendering code | Yes | Most layout, mapping, and visualization logic assumes 64 pads |
| Only `drum_64` mode is active | Instrument config currently supports only `drum_64` | `src/types/performance.ts` | Yes | Future layout modes would break assumptions across engine and UI |
| Row indexing convention | Row 0 is bottom, row 7 is top; col 0 is left | `src/types/layout.ts`, `src/types/naturalHandPose.ts`, UI comments | Yes | Misread orientation would corrupt pose, mapping, and reach logic |
| Performance must be time-sorted | `Performance.events` must be sorted by `startTime` ascending | `src/types/performance.ts`, `src/utils/midiImport.ts` | Mostly yes | Grouping, timeline, and solver assumptions would drift |
| Note identity for mapping coverage | Coverage is keyed by `noteNumber` only, channel ignored | `src/engine/mappingCoverage.ts` | Yes | Multi-channel semantics could be collapsed unintentionally |
| Strict note-to-pad resolution can return unmapped | In strict mode, notes absent from mapping remain unmapped | `src/engine/mappingResolver.ts` | Yes | Optimization or analysis could silently fall back when it should not |
| Finger-lock values | Finger locks are encoded as `L1-L5` or `R1-R5` strings | `src/workbench/LayoutDesigner.tsx`, `src/types/layout.ts` | Yes | Invalid constraint strings would break pad-lock meaning |
| Pose uniqueness | No two fingers may occupy the same pad in a valid `NaturalHandPose` | `src/types/naturalHandPose.ts:validateNaturalHandPose` | Yes | Pose-based seeding and neutral overrides become ambiguous |

## Technical Constraints

| Name | Description | Where defined or enforced | Enforced consistently? | Risks if violated |
|---|---|---|---|---|
| LocalStorage storage model | Songs live under `push_perf_songs`; project states under `push_perf_project_<id>` | `src/services/SongService.ts`, `src/utils/projectPersistence.ts` | Yes | Data loss or orphaning if keys change |
| Theme storage | Theme stored under `push_perf_theme` | `src/context/ThemeContext.tsx` | Yes | Theme resets or inconsistent shell state |
| Workbench autosave debounce | Project state autosaves after 1 second | `src/workbench/Workbench.tsx` | Yes | Excess writes if shortened too much; lost changes if removed |
| Undo history cap | Undo history retains up to 50 states | `src/hooks/useProjectHistory.ts` | Yes | Too low loses useful history; too high may inflate memory |
| Practice-loop speed options | Fixed loop speeds: `0.75`, `0.85`, `1.0`, `1.10` | `src/workbench/PracticeLoopControls.tsx`, `src/workbench/EventAnalysisPanel.tsx` | Yes | Exported loop config and UI expectations diverge if changed casually |
| Practice-loop timer clamp | Loop interval is clamped between `50ms` and `2000ms` | `src/hooks/usePracticeLoop.ts` | Yes | Extremely fast or slow transitions would become unusable |
| Hydration current-song key | Current song tracking stored under `push_perf_current_song_id` | `src/hooks/useSongStateHydration.ts` | Yes | Route re-entry logic may misbehave if altered |

## Constants and Tunables

### Engine constants

| Constant | Value | Meaning | Source |
|---|---|---|---|
| `maxSpan` | `4` | nominal maximum span width in grid cells | `src/engine/models.ts` |
| `minSpan` | `0` | nominal minimum span | `src/engine/models.ts` |
| `idealReach` | `2` | comfortable reach target | `src/engine/models.ts` |
| `maxReach` | `4` | max reach before movement becomes impossible | `src/engine/models.ts` |
| `activationCost` | `5.0` | cost of activating an unplaced finger | `src/engine/models.ts` |
| `crossoverPenaltyWeight` | `20.0` | penalty weight for finger crossover | `src/engine/models.ts` |
| `fatigueRecoveryRate` | `0.5` | fatigue recovery per second | `src/engine/models.ts` |

### Finger-strength weights

| Finger | Weight | Source |
|---|---|---|
| index | `1.0` | `src/engine/models.ts` |
| middle | `1.0` | `src/engine/models.ts` |
| ring | `1.1` | `src/engine/models.ts` |
| pinky | `2.5` | `src/engine/models.ts` |
| thumb | `2.0` | `src/engine/models.ts` |

### Movement / cost-function constants

| Constant | Value | Meaning | Source |
|---|---|---|---|
| `MAX_HAND_SPEED` | `12.0` | assumed physiological max hand speed in grid units per second | `src/engine/costFunction.ts` |
| `SPEED_COST_WEIGHT` | `0.5` | weight for speed component in transition cost | `src/engine/costFunction.ts` |
| `FALLBACK_GRIP_PENALTY` | `1000` | huge penalty for fallback grips that ignore constraints | `src/engine/costFunction.ts` |
| `ALTERNATION_DT_THRESHOLD` | `0.25` | same-finger repetition threshold in seconds | `src/engine/costFunction.ts` |
| `ALTERNATION_PENALTY` | `1.5` | base same-finger repetition penalty | `src/engine/costFunction.ts` |
| `HAND_BALANCE_TARGET_LEFT` | `0.45` | target left-hand share | `src/engine/costFunction.ts` |
| `HAND_BALANCE_WEIGHT` | `2.0` | weight for hand-balance penalty | `src/engine/costFunction.ts` |
| `HAND_BALANCE_MIN_NOTES` | `2` | minimum notes before hand-balance penalty applies | `src/engine/costFunction.ts` |

### Feasibility constants

| Constant | Value | Meaning | Source |
|---|---|---|---|
| `MAX_FINGER_SPAN_STRICT` | `5.5` | strict max distance between active fingers | `src/engine/feasibility.ts` |
| `MAX_FINGER_SPAN_RELAXED` | `7.5` | relaxed max span for difficult chords | `src/engine/feasibility.ts` |
| `THUMB_DELTA` | `1.0` | strict thumb positional tolerance | `src/engine/feasibility.ts` |
| `THUMB_DELTA_RELAXED` | `2.0` | relaxed thumb positional tolerance | `src/engine/feasibility.ts` |
| reachability green threshold | `<= 3.0` | easy reach in ghost-hand map | `src/engine/feasibility.ts:getReachabilityMap` |

### Event-analysis constants

| Constant | Value | Meaning | Source |
|---|---|---|---|
| `EVENT_TIME_EPSILON` | `1e-4` seconds | simultaneity grouping tolerance | `src/engine/eventMetrics.ts` |
| left-hand event home | `{row:0,col:1}` | event-stretch fallback home | `src/engine/eventMetrics.ts` |
| right-hand event home | `{row:0,col:5}` | event-stretch fallback home | `src/engine/eventMetrics.ts` |
| `MAX_REACH_DISTANCE` | `4.0` | max allowed finger-move distance in onion-skin movement model | `src/engine/onionSkinBuilder.ts` |

### Transition-difficulty weighting

| Factor | Weight / impact | Source |
|---|---|---|
| speed pressure | `60%` of base score | `src/engine/transitionAnalyzer.ts` |
| anatomical stretch | `30%` of base score | `src/engine/transitionAnalyzer.ts` |
| normalized distance | `10%` of base score | `src/engine/transitionAnalyzer.ts` |
| hand switch | `+0.15` | `src/engine/transitionAnalyzer.ts` |
| finger change | `+0.1` | `src/engine/transitionAnalyzer.ts` |

### UI and workflow enumerations

| Enumeration / range | Values | Source |
|---|---|---|
| layout modes | `manual`, `optimized`, `random`, `auto`, `none` | `src/types/layout.ts` |
| library tabs | `Detected`, `Unassigned`, `Placed` | `src/workbench/VoiceLibrary.tsx` |
| Workbench left tabs | `Library`, `Pose` | `src/workbench/LayoutDesigner.tsx` |
| analysis tabs | `summary`, `comparison`, `optimization` | `src/workbench/AnalysisPanel.tsx` |
| event-analysis left tabs | `timeline`, `log` | `src/workbench/EventAnalysisPanel.tsx` |
| timeline zoom slider | `10` to `500` pixels per second | `src/pages/TimelinePage.tsx` |
| pose preview offset | `-4` to `+4` rows | `src/workbench/NaturalHandPosePanel.tsx`, `src/types/naturalHandPose.ts` |
| undo history size | `50` states | `src/hooks/useProjectHistory.ts` |

## Invariants

| Invariant | Description | Where implied or enforced | Enforced consistently? | Risks if violated |
|---|---|---|---|---|
| `ProjectState.activeMappingId` should identify the mapping used across routes | Workbench, Timeline, and Event Analysis should resolve the same active mapping | `src/workbench/Workbench.tsx`, `src/pages/TimelinePage.tsx`, `src/context/ProjectContext.tsx` | Mostly yes in current code | Cross-route disagreement about what is being analyzed |
| `manualAssignments` should key by stable event identity | Newer flows use `eventKey`, with fallback to index string when missing | `src/types/projectState.ts`, `src/workbench/EventLogTable.tsx` | Mostly yes, but fallback remains | Wrong assignment may attach to wrong event under drift conditions |
| `naturalHandPoses[0]` is Pose 0 | Index `0` is treated as the default personalized pose | `src/types/projectState.ts`, `src/context/ProjectContext.tsx` | Yes | Pose-dependent workflows break if index ordering changes |
| Imported project state should always contain at least one default pose if poses are missing | Validation and import paths backfill default pose | `src/services/SongService.ts`, `src/utils/projectPersistence.ts` | Yes | Pose-driven features encounter null paths |
| Filtered active performance excludes ignored notes only | Ignoring a note should not mutate raw stored performance | `src/utils/performanceSelectors.ts` | Yes | Destructive deletion and temporary hiding would be conflated |
| `GridMapping.cells` keys are always `"row,col"` | Used everywhere for pads | `src/types/layout.ts`, Workbench, event analysis | Yes | Parsing and visualization fail if key shape changes |
| Project JSON load should reject malformed core shape | Strict file load should fail fast | `src/utils/projectPersistence.ts:validateProjectStrict` | Intended yes | Bad imports can poison global state |

## Constraint and Invariant Risks Worth Carrying Forward

1. Product behavior depends heavily on exact indexing and identity conventions.
   - `eventKey`, `row,col`, and `activeMappingId` are important coordination glue.

2. Full-coverage optimization is a major product rule.
   - Any future UX redesign should surface it before users hit a blocking alert.

3. The product is physically opinionated.
   - Constants such as reach limits, hand-balance targets, stretch weights, and fallback penalties are not minor implementation details; they are part of the product definition.

