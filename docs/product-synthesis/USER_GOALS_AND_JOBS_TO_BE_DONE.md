# User Goals and Jobs To Be Done

## Method

This document separates:

- Explicit user goals:
  - Supported by visible labels, route names, docs, comments, or button text.
- Implied user goals:
  - Inferred from workflows, solver behavior, and data-model structure.
- Ambiguity:
  - Where the repo appears to support multiple competing user intents.

## Explicit User Goals

| Goal | Why it appears explicit | Evidence | Confidence |
|---|---|---|---|
| Manage a portfolio of songs | Dashboard is labeled "Song Portfolio" and stores multiple songs | `src/pages/Dashboard.tsx`, `src/types/song.ts` | High |
| Link MIDI data to a song | Song card offers `Link MIDI` / `Re-link` | `src/components/dashboard/SongCard.tsx` | High |
| Open a song in an editor | Song card action is labeled `Editor` and routes to `/workbench` | `src/components/dashboard/SongCard.tsx` | High |
| Analyze event difficulty | Song card action is labeled `Analyze`; event route is titled `Event Analysis` | `src/components/dashboard/SongCard.tsx`, `src/pages/EventAnalysisPage.tsx` | High |
| Configure a natural hand pose | Workbench pose panel is explicitly named `Natural Hand Pose` | `src/workbench/NaturalHandPosePanel.tsx` | High |
| Assign sounds/voices to pads | Workbench has grid DnD and library tabs `Unassigned` / `Placed` | `src/workbench/LayoutDesigner.tsx`, `src/workbench/VoiceLibrary.tsx` | High |
| Optimize the layout ergonomically | Toolbar button `Auto-Arrange`; summary shows `Ergonomic Score` | `src/workbench/Workbench.tsx`, `src/workbench/AnalysisPanel.tsx` | High |
| Run analysis on the current layout | Toolbar button `Run Analysis` | `src/workbench/Workbench.tsx` | High |
| Inspect transitions between events | Event-analysis screen exposes event timeline, onion skin, and transition metrics | `src/workbench/EventAnalysisPanel.tsx` | High |
| Save and reload portable project files | Workbench exposes `Save Project` and `Load` | `src/workbench/Workbench.tsx` | High |

## Implied User Goals

| Goal | Why it is implied | Evidence | Confidence |
|---|---|---|---|
| Personalize the mapping process to the user's body | Pose 0 feeds deterministic assignment and solver neutral positions | `src/engine/handPose.ts`, `src/engine/seedMappingFromPose0.ts`, `src/context/ProjectContext.tsx` | High |
| Achieve full note coverage before optimization | Optimization blocks when notes are unmapped | `src/workbench/Workbench.tsx`, `src/engine/mappingCoverage.ts` | High |
| Compare solver strategies, not only final scores | Advanced mode stores and compares beam, genetic, and annealing outputs | `src/workbench/Workbench.tsx`, `src/workbench/AnalysisPanel.tsx` | Medium |
| Inspect why a layout is difficult, not just that it is difficult | Cost breakdowns, transition metrics, and onion-skin visuals all explain causes | `src/pages/CostDebugPage.tsx`, `src/workbench/TransitionMetricsPanel.tsx`, `src/components/vis/OnionSkinGrid.tsx` | High |
| Filter or simplify the performance before analyzing it | Ignored note numbers hide notes from filtered performance | `src/utils/performanceSelectors.ts`, `src/workbench/VoiceLibrary.tsx` | Medium |
| Preserve work locally per song over time | Autosave is central and persistent | `src/workbench/Workbench.tsx`, `src/services/SongService.ts` | High |
| Iterate on multiple layout variants | Duplicate mapping exists; version metadata exists; optimization rewrites mappings | `src/workbench/Workbench.tsx`, `src/types/layout.ts` | Medium |
| Use the tool as a debugging / research instrument | Cost debug, fixture tests, debug events, annealing trace | `src/pages/CostDebugPage.tsx`, `src/engine/__tests__/*` | Medium |

## Candidate Jobs To Be Done

### Primary JTBD candidates

1. When I have a MIDI performance I want to play on Push, I want to map its required notes onto pads so I can perform it with less physical strain.
2. When a performance feels awkward on the grid, I want the system to show me why it is awkward so I can improve the layout instead of guessing.
3. When my natural hand position differs from a default assumption, I want to define my own resting pose so the layout and finger suggestions fit my body.
4. When there are too many ways to place sounds, I want the system to seed or optimize a plausible mapping so I can start from something workable.

### Secondary JTBD candidates

5. When I am comparing layout ideas, I want to duplicate, tweak, and evaluate mappings so I can decide which one is most playable.
6. When I am practicing a difficult passage, I want to inspect difficult transitions and rehearse them at slower speeds so I can reduce failure points.
7. When I want to keep my work organized by song, I want each song to preserve its own project state so I can return later without rebuilding context.
8. When the solver makes a surprising choice, I want developer-grade debug information so I can understand the cost model and edge cases.

## Primary vs Secondary Goals

### Likely primary goals

| Goal | Why it appears primary | Evidence |
|---|---|---|
| Build or improve a playable pad mapping for a performance | This is the center of the Workbench, data model, and engine | `src/workbench/Workbench.tsx`, `src/context/ProjectContext.tsx`, `README.md` |
| Evaluate playability ergonomically | Scores, finger assignments, cost breakdowns, hand balance, difficulty views all support this | `src/workbench/AnalysisPanel.tsx`, `src/engine/core.ts`, `src/engine/costFunction.ts` |
| Personalize mapping to user hand posture | Pose 0 influences seed, natural assignment, and solver | `src/workbench/NaturalHandPosePanel.tsx`, `src/engine/handPose.ts` |

### Likely secondary or supporting goals

| Goal | Why it appears secondary | Evidence |
|---|---|---|
| Track song practice progress | `SongMetadata` has practice/rating fields, but current UI uses only a thin slice of them | `src/types/song.ts`, `src/components/dashboard/SongCard.tsx` |
| Rehearse transitions interactively | Practice loop exists, but it is visual stepping only | `src/hooks/usePracticeLoop.ts` |
| Compare multiple solver families as a user-facing workflow | Advanced compare mode exists, but it is niche and hidden | `src/workbench/Workbench.tsx`, `src/workbench/AnalysisPanel.tsx` |
| Operate on musical sections | `sectionMaps` exist but are not a live UX flow | `src/types/performance.ts`, `src/types/projectState.ts` |

## Conflicts / Ambiguity

### Persona ambiguity

| Possible persona | Evidence | Conflict |
|---|---|---|
| Performing musician / finger drummer | Push grid model, ergonomic scoring, pose editing | Likely core persona |
| Practice-tracking learner | Song metadata fields, status badges, "last practiced" | Current UX does not deeply support this persona |
| Engine developer / ergonomics researcher | Cost Debug page, debug events, many tests | Real in codebase, but not clearly a product persona |

### Goal ambiguity

| Competing goal | Evidence | Why it matters |
|---|---|---|
| "Get me a layout fast" vs "Let me author deliberately" | Buttons for Seed, Natural, Random, Auto-Arrange coexist with detailed manual DnD | Product needs a clearer canonical path |
| "Analyze current mapping" vs "Generate a new better one" | `Run Analysis` and `Auto-Arrange` sit together and both use solver logic | Users may conflate diagnosis with automated change |
| "Song portfolio" vs "performance workbench" | Dashboard metadata model is rich; Workbench mostly cares about performance + mapping | Top-level product identity is split |
| "Section layout optimizer" vs "song mapping tool" | Workbench header copy still says "Section Layout Optimizer" while live UX is song/mapping centric | Terminology shapes product expectations |

## Evidence-Based Takeaway

The clearest consistent user goal in the repo is not "music management" or "practice tracking." It is: take a MIDI-derived performance, place or optimize its voices on an 8x8 Push grid, and understand whether that mapping is physically workable for a particular player. Everything else appears secondary, partial, or historically layered on top of that core.

