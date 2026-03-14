# Product Overview First Draft

## Scope and Method

This document is a first-draft product synthesis derived from current repository evidence on 2026-03-13. It prioritizes current code behavior over older documentation when they conflict.

- Primary evidence reviewed from code:
  - `src/main.tsx`
  - `src/pages/Dashboard.tsx`
  - `src/workbench/Workbench.tsx`
  - `src/workbench/LayoutDesigner.tsx`
  - `src/workbench/AnalysisPanel.tsx`
  - `src/workbench/EventAnalysisPanel.tsx`
  - `src/pages/TimelinePage.tsx`
  - `src/pages/EventAnalysisPage.tsx`
  - `src/context/ProjectContext.tsx`
  - `src/services/SongService.ts`
  - `src/utils/midiImport.ts`
  - `src/types/*`
  - `src/engine/*`
- Supporting repo-document evidence:
  - `README.md`
  - `docs/PROJECT_OVERVIEW.md`
  - `docs/WORKBENCH_DOCUMENTATION.md`
  - `docs/DASHBOARD_USER_FLOW_DOCUMENTATION.md`
  - `docs/TERMINOLOGY.md`
  - `docs/MilestoneNotes/2025-11-29-explicit-layout-model.md`
  - `docs/ROADMAP_AND_FUTURE_WORK.md`
- Reliability signal:
  - `npm run test:run` failed on 2026-03-13 with 24 failing tests.
  - `npm run build` failed on 2026-03-13 due to current TypeScript errors.

## One-Paragraph Product Summary

The product currently appears to be a local-first browser tool for analyzing the physical playability of MIDI performances on an Ableton Push-style 8x8 pad grid, then helping a user author, seed, inspect, and optimize note-to-pad mappings for that performance. The practical center of the product is the Workbench (`src/workbench/Workbench.tsx`), where a song's MIDI-derived voices can be placed on the grid manually or by algorithm, evaluated by a biomechanical solver, and inspected through summary metrics, timeline views, and event-level transition analysis.

## Likely Primary User(s)

### Most likely primary user

- A technically inclined musician, producer, or finger-drumming performer working with Ableton Push or Push-like pad layouts.
- Evidence:
  - `README.md` describes analyzing MIDI for Ableton Push and generating musician-adaptive pad layouts.
  - `src/types/performance.ts` and `src/engine/gridMapService.ts` assume an 8x8 `drum_64` Push mapping model.
  - `src/workbench/NaturalHandPosePanel.tsx` assumes a user can define a personal resting hand pose.

### Likely secondary users

- A developer or power user validating solver behavior and cost breakdowns.
- Evidence:
  - Dev-only `src/pages/CostDebugPage.tsx`.
  - Extensive `debugEvents`, `annealingTrace`, and cost-breakdown models in engine code.

## Likely Core Job To Be Done

When a performer has a MIDI-derived performance they want to play on Push, they want to map the required notes onto pads in a way that fits their body, hand posture, and movement limits so they can produce a playable, lower-friction performance layout.

Evidence:

- `src/utils/midiImport.ts` converts MIDI into `Performance`, `Voice[]`, `InstrumentConfig`, and an initially empty `GridMapping`.
- `src/workbench/Workbench.tsx` exposes layout controls named `Seed`, `Natural`, `Auto-Arrange`, `Random`, and `Run Analysis`.
- `src/context/ProjectContext.tsx` runs solvers and layout optimization against the active performance and mapping.

## Major Workflows the App Appears To Support

1. Manage a local song portfolio and attach MIDI to songs.
   - `src/pages/Dashboard.tsx`
   - `src/components/dashboard/SongCard.tsx`
   - `src/services/SongService.ts`

2. Hydrate a song-specific project state and open the Workbench.
   - `src/hooks/useSongStateHydration.ts`
   - `src/workbench/Workbench.tsx`

3. Define a personal natural hand pose ("Pose 0").
   - `src/workbench/NaturalHandPosePanel.tsx`
   - `src/types/naturalHandPose.ts`

4. Assign voices to pads manually or through deterministic/random layout helpers.
   - `src/workbench/LayoutDesigner.tsx`
   - `src/workbench/VoiceLibrary.tsx`
   - `src/workbench/Workbench.tsx:handleSeedFromPose0`
   - `src/workbench/Workbench.tsx:handleAutoAssignNaturalPose`
   - `src/workbench/Workbench.tsx:handleAutoAssignRandom`

5. Run performance analysis and inspect summary metrics.
   - `src/context/ProjectContext.tsx:runSolver`
   - `src/workbench/AnalysisPanel.tsx`

6. Optimize the layout using simulated annealing.
   - `src/context/ProjectContext.tsx:optimizeLayout`
   - `src/workbench/Workbench.tsx:handleOptimizeLayout`

7. Inspect the result through alternate analysis surfaces.
   - Timeline view: `src/pages/TimelinePage.tsx`
   - Event analysis: `src/pages/EventAnalysisPage.tsx`, `src/workbench/EventAnalysisPanel.tsx`
   - Cost debug: `src/pages/CostDebugPage.tsx`

8. Persist, export, and reload state.
   - Autosave via `src/workbench/Workbench.tsx` + `src/services/SongService.ts`
   - Project JSON via `src/utils/projectPersistence.ts`
   - Event-analysis JSON exports via `src/utils/eventExport.ts`

## Major Subsystems / Modules

| Subsystem | What it does now | Primary evidence |
|---|---|---|
| Song portfolio | Local song CRUD, MIDI linking, launch points into editing/analysis | `src/pages/Dashboard.tsx`, `src/components/dashboard/SongCard.tsx`, `src/services/SongService.ts` |
| Workbench shell | Main editing and orchestration surface | `src/workbench/Workbench.tsx` |
| Grid layout editor | Drag/drop placement, finger locks, reachability, visibility controls | `src/workbench/LayoutDesigner.tsx`, `src/workbench/VoiceLibrary.tsx` |
| Natural hand pose system | User-defined finger resting pads used by seeding and solver neutral state | `src/workbench/NaturalHandPosePanel.tsx`, `src/types/naturalHandPose.ts`, `src/engine/handPose.ts` |
| Solver / engine | Biomechanical assignment, scoring, optimization, debug output | `src/engine/core.ts`, `src/engine/costFunction.ts`, `src/engine/feasibility.ts`, `src/engine/solvers/*` |
| Event-analysis pipeline | Groups events into moments, computes transitions, builds onion-skin models, exports analysis data | `src/engine/eventMetrics.ts`, `src/engine/transitionAnalyzer.ts`, `src/engine/onionSkinBuilder.ts`, `src/workbench/EventAnalysisPanel.tsx` |
| Timeline visualization | Chronological lane view of mapped voices and finger labels | `src/workbench/Timeline.tsx`, `src/pages/TimelinePage.tsx` |
| Persistence | LocalStorage songs and project state, JSON import/export | `src/services/SongService.ts`, `src/utils/projectPersistence.ts` |
| Theme / shell | Theme persistence and app-level shell | `src/context/ThemeContext.tsx`, `src/styles/theme.css` |
| Diagnostics | Per-event cost debug and annealing trace review | `src/pages/CostDebugPage.tsx` |

## Current State of the Product

Best first-pass characterization:

- Directionally coherent
  - The repo consistently centers on "Push playability" and "layout ergonomics."
- Operational but fragmented
  - The same product concept is expressed across multiple pages and panels with overlapping analysis models.
- Partially duplicated
  - Analysis exists in the Workbench summary, Event Analysis page, Timeline page, and Cost Debug page.
- Partially experimental
  - Tests and docs show active model churn, especially around event-analysis shapes and solver behavior.
- Partially under-converged
  - The product model has improved around `Voice`, `GridMapping`, and `NaturalHandPose`, but terminology and workflow framing are still not fully unified.

## Key Product Tensions or Contradictions

1. Is the core product a layout editor with analysis, or an analysis tool with editing?
   - The Workbench is the practical hub, but route names and docs also position deep analysis as a primary surface.

2. What is the intended first successful path after MIDI import?
   - Current code makes the grid intentionally empty after import (`src/utils/midiImport.ts`, `docs/MilestoneNotes/2025-11-29-explicit-layout-model.md`).
   - The user can then drag manually, use `Natural`, use `Seed`, use `Random`, or use `Auto-Arrange`.
   - This is powerful, but it leaves the canonical "start here" flow unclear.

3. Is `NaturalHandPose` a supporting preference or the conceptual core?
   - In code it is central to seeding, deterministic assignment, and solver neutral bias.
   - In top-level product framing it is still underemphasized.

4. Is the product centered on songs, performances, layouts, mappings, or sections?
   - The dashboard is song-centric.
   - The engine is performance-centric.
   - The Workbench edits mappings.
   - Header copy still says "Section Layout Optimizer" even though `sectionMaps` are mostly dormant.

5. Is analysis live, snapshot-based, or both?
   - Current code mostly exposes solver snapshots through `solverResults` and `activeSolverId`.
   - Older docs and audits still describe a live reactive solver loop as central.
   - The product language has not caught up to that shift.

## Where the Product Vision Appears Clear

- The app is about Push-style pad performance ergonomics, not generic music production.
- MIDI import produces a performance to be mapped, not a finished layout to accept as-is.
- Layout quality is judged by biomechanical cost and finger assignment, not only musical convention.
- The user should be able to personalize the system with a hand-pose model.
- The system wants to support both authoring and analysis, not only one or the other.

## Where the Product Vision Appears Blurry

- The canonical primary workflow and recommended sequence after import.
- Whether songs are simply containers or meaningful portfolio objects with practice-progress semantics.
- Whether section-based workflow still matters. `sectionMaps` remain in the data model but not in live product behavior.
- The intended relationship between "analysis", "solver run", and "optimization."
- The intended scope of timeline/practice functionality. Current practice loop is visual stepping only (`src/hooks/usePracticeLoop.ts`), while some older docs imply richer playback behavior.
- The intended importance of layout templates. Template models exist in `src/types/layout.ts` but are not surfaced in the main flow.

## Repository Reliability Notes

These do not define the product by themselves, but they materially affect confidence in the extracted behavior.

- `npm run build` currently fails.
  - Notable current issues include `src/utils/projectPersistence.ts` typing mismatches and a few unused variables.
- `npm run test:run` currently fails.
  - Failing clusters show drift between event-analysis tests and current event-analysis data structures:
    - `src/engine/__tests__/eventMetrics.test.ts`
    - `src/engine/__tests__/onionSkinBuilder.test.ts`
  - There are also solver behavior regressions or changed expectations:
    - `src/engine/__tests__/core.test.ts`
    - `src/engine/__tests__/solver.fixtures.test.ts`
- Some repo docs and audit files are stale relative to current code.
  - Example: current `src/context/ProjectContext.tsx` derives `engineResult` from `solverResults`, while older docs describe a still-active legacy engine-result path as central.

## Highest-Value Human Decisions Needed

1. Define the primary workflow after MIDI import.
   - Should the product explicitly guide the user toward `Pose -> Seed -> Auto-Arrange -> Analyze`, or something else?

2. Decide what the product's main object is.
   - Song portfolio?
   - Performance-to-layout editor?
   - Personalized ergonomics optimizer?

3. Decide whether `NaturalHandPose` is optional personalization or required setup.
   - The code increasingly treats it as foundational.

4. Clarify the role of multiple analysis surfaces.
   - Which view is the canonical analysis summary?
   - Which views are detail drill-downs?
   - Which should remain developer-only?

5. Decide whether section-based modeling is still part of the product.
   - If yes, it needs workflow/UI expression.
   - If no, product language and dormant model fields should stop implying it.

6. Define whether the product is a local portfolio tool, an exportable workstation, or both.
   - The current app mixes per-song autosave, project JSON export, and analysis-export JSON without a single user-facing persistence story.

7. Canonicalize terminology for the user-facing product.
   - Especially `song`, `performance`, `layout`, `mapping`, `voice`, `pad`, `note`, and `analysis`.

