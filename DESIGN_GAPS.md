# Design Gaps

## Goal

These are the product-design artifacts still missing between idea, UI, and code. They are the documents or models that should exist before a serious UI redesign, because the current repository contains implementation and screens but still lacks a stable product contract.

## Gap 1: Canonical User Journey

Why it is missing:

- The app supports several valid first moves after MIDI import: manual drag/drop, Seed, Natural, Random, Run Analysis, or Auto-Arrange.
- The code implements these options, but the product does not define which path is primary.

Evidence:

- Workbench toolbar exposes multiple "first step" actions side by side.
- Import intentionally leaves the grid empty.

Artifact needed:

- A single canonical journey map from Dashboard -> MIDI link -> pose setup -> mapping -> analysis -> optimization -> validation.

## Gap 2: Screen Responsibility Contract

Why it is missing:

- Analysis is split across Workbench, Timeline, Event Analysis, and Cost Debug.
- The repo has screens, but not a single contract explaining what each screen is for and what it is not for.

Evidence:

- Workbench already contains summary analysis.
- Timeline and Event Analysis both inspect solver output from different angles.
- Cost Debug overlaps with both at a lower level.

Artifact needed:

- A screen responsibility matrix defining primary task, depth, and allowed actions per route.

## Gap 3: Canonical Product Object Model

Why it is missing:

- The codebase mixes `song`, `project`, `layout`, `mapping`, `performance`, and `section` language.
- Durable and derived objects are implemented, but not canonically described in one place.

Evidence:

- `Song` is dashboard-facing.
- `ProjectState` is the real editing truth.
- `LayoutSnapshot` stores the performance.
- `GridMapping` is the editable layout.
- `sectionMaps` still exist despite weak UI presence.

Artifact needed:

- A product-facing domain source-of-truth document with durable vs derived objects and ownership.

## Gap 4: Interaction Model for Layout Authoring

Why it is missing:

- The grid editor supports drag/drop, swap, unassign, finger locks, reachability view, hide note, destructive delete, and pose edit mode.
- Those interactions exist in code but do not have an explicit interaction model or precedence chart.

Evidence:

- `LayoutDesigner` owns many overlapping gestures and states.
- Context menu behavior and pose edit mode compete for grid clicks.

Artifact needed:

- An interaction specification for the grid canvas, library, context menu, and pose-edit states.

## Gap 5: Mapping Generation Decision Model

Why it is missing:

- `Seed`, `Natural`, `Random`, and `Auto-Arrange` are materially different operations.
- The system does not define them as a staged model.

Evidence:

- Some actions create coverage.
- Some only place unassigned voices.
- Some analyze.
- Some overwrite the mapping.

Artifact needed:

- A decision model that defines:
  - when to use each action
  - whether it is additive or destructive
  - whether full note coverage is required

## Gap 6: Visualization Semantics Spec

Why it is missing:

- Heatmaps, finger colors, difficulty bands, ghost pads, shared pads, and cost colors are implemented but not formally specified.

Evidence:

- Workbench colors grid pads from finger or difficulty data.
- Event Analysis uses transition bars and onion-skin states.
- Cost Debug uses separate cost-oriented visual language.

Artifact needed:

- A visualization semantics guide that defines what each color, opacity, badge, and score means across screens.

## Gap 7: State Ownership and Sync Diagram

Why it is missing:

- The app behaves as a multi-route single-project workspace, but ownership rules are only implicit in code.

Evidence:

- `ProjectState` is canonical.
- `engineResult` is derived.
- `activeMappingId` is expected to stay consistent across routes.
- hydration logic and autosave are route-sensitive.

Artifact needed:

- A source-of-truth and sync diagram showing:
  - what is canonical
  - what is derived
  - what is persisted
  - what is transient view state

## Gap 8: Persistence Mental Model

Why it is missing:

- The app has song-local autosave, project JSON import/export, and analysis JSON export, but no single user-facing persistence model.

Evidence:

- Dashboard implies a song library.
- Workbench implies a project file workflow.
- Event Analysis exposes its own exports.

Artifact needed:

- A persistence model that explains what is saved automatically, what is exported manually, and what belongs to a song versus a portable file.

## Gap 9: Error and Empty-State Catalog

Why it is missing:

- The app has many important blockers and preconditions, but mostly exposes them through inline messages or alerts.

Evidence:

- No song selected.
- No MIDI linked.
- No active mapping.
- No coverage for optimization.
- No Pose 0 for pose-based helpers.
- No solver result for analysis pages.

Artifact needed:

- A screen-by-screen empty/error/precondition catalog with copy, cause, next step, and recovery path.

## Gap 10: Measurement Dictionary

Why it is missing:

- The product exposes many scores, but their meanings are scattered across solver code and panels.

Evidence:

- Ergonomic score
- hard/unplayable counts
- average movement/stretch/drift/bounce/fatigue/crossover
- transition composite difficulty
- speed pressure
- hand balance

Artifact needed:

- A metric dictionary that defines every displayed score, formula source, range, and intended user interpretation.

## Gap 11: Component Contracts for Redesign

Why it is missing:

- Major UI regions exist, but their responsibilities are still encoded in implementation rather than in reusable contracts.

Evidence:

- `LayoutDesigner`, `AnalysisPanel`, `EventAnalysisPanel`, and `Timeline` are all doing conceptually stable work, but without redesign-ready interface specs.

Artifact needed:

- Component contracts describing each major surface's inputs, outputs, states, and edge cases.

## Gap 12: Product Vocabulary Canon

Why it is missing:

- The codebase has improved terminology, but user-facing language is still split.

Evidence:

- "Song Portfolio" on the dashboard.
- "Section Layout Optimizer" in the workbench header.
- `layout`, `mapping`, and `performance` are not consistently distinguished in UI language.

Artifact needed:

- A short vocabulary canon for UI copy, docs, and future design work.

## Highest-Priority Missing Artifacts Before UI Redesign

1. Canonical user journey
2. Screen responsibility contract
3. Product object model
4. Layout-authoring interaction model
5. Visualization semantics spec
6. State ownership and persistence model

Without these, a redesign would likely re-skin the current implementation without resolving the product ambiguity already present in the repository.
