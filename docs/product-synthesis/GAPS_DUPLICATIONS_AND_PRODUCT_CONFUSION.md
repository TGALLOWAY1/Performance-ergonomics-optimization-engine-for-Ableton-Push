# Gaps, Duplications, and Product Confusion

## Tone and Scope

This document is intentionally direct. The goal is to surface where the current product definition is unclear, contradictory, duplicated, or drifting so that future product artifacts can resolve those issues instead of inheriting them.

## Duplicated Concepts

### Analysis exists in too many overlapping forms

| Concept | Where it appears | Why it is a problem |
|---|---|---|
| top-level playability summary | Workbench `AnalysisPanel`, Event Analysis header, Cost Debug aggregate metrics | No single canonical "summary analysis" surface |
| finger assignment visualization | Workbench grid, finger assignment table, Timeline labels, Event Log, OnionSkinGrid | Strong concept, but scattered into many representations |
| difficult-transition inspection | Timeline implies sequence review, Event Analysis explicitly measures transitions, Cost Debug exposes per-event costs | Overlap without clear screen roles |

### Mapping generation has too many "first step" actions

Current choices after import:

- drag manually
- `Seed`
- `Natural`
- `Random`
- `Organize by 4x4 Banks`
- `Auto-Arrange`

Problem:

- The product does not make it clear which of these is the recommended first move for a normal user.

## Duplicated Pages / Workflows

### Workbench vs Event Analysis

- Workbench already contains a rich analysis panel.
- Event Analysis is also a rich analysis workbench.
- Result:
  - "Analyze here or there?" is not clearly answered.

### Timeline vs Event Analysis

- Both are time-oriented inspection surfaces.
- Timeline is broader and simpler.
- Event Analysis is deeper and more diagnostic.
- Result:
  - The relationship is implicit rather than designed as a clear drill-down hierarchy.

### Workbench vs Cost Debug

- Both can explain solver output.
- Cost Debug is explicitly developer-facing.
- Result:
  - The product boundary between user-facing explanation and internal diagnostics is not documented clearly.

## Inconsistent Terminology

### `layout` is overloaded

It currently refers to at least four things:

1. `LayoutSnapshot` as a container for a `Performance`
2. `GridMapping` as a voice-to-pad placement
3. layout mode or layout generation history
4. the overall idea of an ergonomic arrangement

Evidence:

- `src/types/projectState.ts`
- `src/types/layout.ts`
- `src/workbench/Workbench.tsx`
- header subtitle `Section Layout Optimizer`

### `voice`, `sound`, and `note` are still mixed

- `Voice` is now the clearest canonical code term.
- Many handlers and components still use `sound`.
- User-facing descriptions sometimes still imply "note" where the system really means the reusable pitch/voice object.

Evidence:

- `src/types/layout.ts`
- `src/workbench/Workbench.tsx`
- `src/workbench/VoiceLibrary.tsx`
- `docs/TERMINOLOGY.md`

### Hand/finger notation is inconsistent

- internal forms include:
  - `left/right`
  - `L/R`
  - `LH/RH`
  - `L1-R5`
- This is manageable technically, but weak for a clean product-language canon.

## Inconsistent Data Models

### `sectionMaps` are present but not product-active

- `ProjectState` includes `sectionMaps`.
- `SectionMap` is defined.
- The Workbench header still says `Section Layout Optimizer`.
- Current live routes do not present a real section workflow.

Implication:

- Either sections remain part of the planned product and need re-expression, or the current product definition should stop implying them.

### Templates exist in types, not in user workflow

- `STANDARD_KIT_TEMPLATE` and `LAYOUT_TEMPLATES` exist in `src/types/layout.ts`.
- `LayoutDesigner` currently passes `templateSlot={null}`.

Implication:

- A template-driven mapping concept exists in the model but not in the product.

### Song metadata is richer than current portfolio behavior

- `SongMetadata` includes:
  - favorite state
  - tags
  - difficulty
  - practice time
  - performance rating
- Current Dashboard uses only a narrow subset.

Implication:

- The product may be torn between:
  - "song portfolio / practice library"
  - "mapping workstation"

## Feature Drift

### Docs and code have drifted

Examples:

- `docs/PROJECT_OVERVIEW.md` still describes a central reactive solver loop and a different build-state picture than current code.
- `docs/DASHBOARD_USER_FLOW_DOCUMENTATION.md` still describes a direct import button path and a `Practice` button that no longer exists in current `SongCard`.
- `docs/audit/01_feature_map.md` claims missing `test` and `typecheck` scripts, but current `package.json` includes them.

Implication:

- Repo docs cannot be treated as a single coherent product source.
- Current source code should remain the primary truth for synthesis.

### Tests and current models have drifted

Examples from 2026-03-13 verification:

- `src/engine/__tests__/eventMetrics.test.ts` expects a different analyzed-event shape than current implementation exposes.
- `src/engine/__tests__/onionSkinBuilder.test.ts` uses an older event model that does not match the current grouped `AnalyzedEvent` structure.
- `src/engine/__tests__/core.test.ts` and `src/engine/__tests__/solver.fixtures.test.ts` show solver-behavior expectation drift or regression.

Implication:

- The product's analysis model is still moving.
- Future UX artifacts should separate "intended user concept" from "current unstable implementation details."

## Unclear Primary Workflow

### The app does not yet strongly teach a recommended path

A likely intended path from current code is:

1. Link MIDI
2. Open Workbench
3. Configure Pose 0
4. Seed or use Natural assignment
5. Run Analysis
6. Auto-Arrange if needed
7. Inspect Timeline / Event Analysis

Problem:

- The UI does not clearly present this sequence.
- Instead, it exposes many equally weighted controls at once.

### Empty import model is correct but underexplained

- The explicit empty-grid model is consistent in current code.
- It fixes earlier confusion from auto-layout on import.
- But the app still lacks a clear first-run teaching layer that explains:
  - why the grid is empty
  - what the staging area means
  - why `Seed` or `Natural` is useful

## Hidden Assumptions

| Hidden assumption | Where it shows up | Why it matters |
|---|---|---|
| Pose 0 meaningfully improves the product | seed, natural assignment, solver neutral override | Could be product-defining, but the top-level framing does not say so |
| Users will understand note coverage before optimization | optimization blocking alert only | This is a critical workflow rule |
| Users can distinguish a voice from a note event from a pad | current mixed terminology and advanced tooling | Many core interactions depend on this mental model |
| Local browser storage is an acceptable persistence model | current architecture is fully local-first | Product messaging does not explicitly set this expectation |

## Suspected UX Confusion Points

1. Empty song creation before MIDI linkage.
2. Multiple authoring helpers with unclear recommended order.
3. `Run Analysis` vs `Auto-Arrange` vs `Natural` vs `Seed`.
4. Hidden right-click affordances for important behaviors like finger locks and reachability.
5. Multiple analysis routes without a clear "use this one when..." explanation.
6. Practice language that suggests more capability than currently exists.

## Code / Docs Mismatch

| Topic | Current code truth | Conflicting or stale artifact |
|---|---|---|
| route set | Dashboard, Workbench, Timeline, Event Analysis, dev-only Cost Debug | some older docs imply different page emphasis |
| analysis state model | `engineResult` derived from `solverResults[activeSolverId]` | older docs/audits still describe a legacy dual-result model as central |
| theme persistence | theme now persists in localStorage | older audit notes say theme resets |
| dashboard practice action | current `SongCard` shows `Editor` and `Analyze` only | older docs mention a `Practice` button |
| timeline scope | current route is mostly a viewer with zoom and click-to-seek | older docs/audits describe richer practice/playback controls |

## Legacy vs Current Uncertainty

### Likely current

- explicit empty-grid import
- centralized route hydration via `useSongStateHydration`
- solver results stored in `ProjectState.solverResults`
- Pose 0 as a core input to several flows

### Likely legacy or drifting

- reactive analysis as the primary visible result path
- richer section-based workflow
- template-driven or ghost-template workflow
- stronger practice-mode workflow

## Build / Test Health as Product Signal

This is not only an engineering issue; it affects synthesis confidence.

- `npm run build` failing means the current working product definition is not fully stabilized in code.
- `npm run test:run` failing means some previously intended behaviors are no longer aligned with the current implementation.

This suggests the product is still in a design-convergence stage rather than a mature stabilization stage.

## Questions That Need Human Product Judgment

1. Is the product primarily for:
   - personalized performance layout design
   - solver/ergonomics analysis
   - song/practice management
   - some combination, with a declared primary
2. Is Pose 0 mandatory setup, guided setup, or optional advanced setup?
3. Which of `Seed`, `Natural`, `Random`, and `Auto-Arrange` should be first-class in the UI?
4. Should Event Analysis remain a separate full page, or become the canonical analysis surface with Workbench reduced to summary?
5. Do sections still matter to the product, or should section language and models be deprecated?
6. Is the product local-first by design, or only temporarily local-first?
7. What artifact should define the core user mission before any UX redesign proceeds?

