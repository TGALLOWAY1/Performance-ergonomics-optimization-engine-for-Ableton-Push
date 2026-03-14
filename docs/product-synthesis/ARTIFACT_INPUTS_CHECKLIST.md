# Artifact Inputs Checklist

## Purpose

This checklist answers:

"What information do we now have that is sufficient to draft missing product artifacts, and what information is still missing or ambiguous?"

It is organized by the next product-definition artifacts that a human + LLM workflow would likely create.

## Inputs for a User Mission

### Successfully extracted

- Core product purpose:
  - analyze Push playability and help author ergonomic mappings
- Primary environment:
  - Ableton Push-style 8x8 drum-pad workflow
- Core user action:
  - map imported MIDI pitches to pads
- Core value:
  - lower physical difficulty and understand why difficulty occurs

### Still unclear

- Whether the mission should frame the product as:
  - a performance workstation
  - a personalized ergonomics assistant
  - a song portfolio tool
- Whether practice and learning are part of the core mission or supporting outcomes

### Human decisions needed

- Choose the primary mission statement.
- Decide whether personalization is central or optional.

## Inputs for Core User Goals

### Successfully extracted

- Manage songs and attach MIDI
- Configure natural hand pose
- author or auto-generate mappings
- analyze playability
- optimize mappings
- inspect transitions and timing

### Still unclear

- Which goals are first-class versus advanced/power-user only
- Whether multi-mapping comparison is a core user goal or an expert feature

### Human decisions needed

- Rank user goals by importance.
- Decide which ones are headline goals in future UX specs.

## Inputs for JTBD

### Successfully extracted

- performance-to-mapping job
- explanation / diagnosis job
- personalization job
- iterative optimization job

### Still unclear

- Whether practice / rehearsal deserves its own core JTBD
- Whether portfolio organization is truly part of the user's desired outcome

### Human decisions needed

- Finalize 1-3 primary JTBD statements.
- Decide whether a "practice" JTBD belongs in the core set or later roadmap.

## Inputs for Workflow Maps

### Successfully extracted

- Dashboard -> link MIDI -> Workbench
- Pose setup workflow
- manual authoring workflow
- auto-seed / natural / random / quadrant workflows
- run analysis workflow
- optimize layout workflow
- timeline inspection workflow
- event-analysis workflow
- save/load/export workflow

### Still unclear

- The preferred or recommended default route through these workflows
- The intended stopping points and branch rules between helper actions

### Human decisions needed

- Choose the canonical first-run flow.
- Decide which workflows are primary, secondary, advanced, or debug-only.

## Inputs for Screen Architecture

### Successfully extracted

- All current routes and their active purposes
- Major panels in Workbench, Timeline, Event Analysis, and Cost Debug
- Current navigation hierarchy
- Which screens are overloaded or duplicative

### Still unclear

- Which analysis route should be canonical
- Whether Timeline is a core screen or supporting screen
- Whether Cost Debug should remain an internal-only artifact forever

### Human decisions needed

- Define final screen hierarchy.
- Decide which screens are first-class, drill-down, or internal.

## Inputs for Task-Based UX Specs

### Successfully extracted

- concrete task inventory
- prerequisites and success conditions
- current failure/confusion points
- major decisions users currently have to make

### Still unclear

- Acceptable failure states and recovery patterns for the core flows
- Desired onboarding / helper text / empty-state behavior

### Human decisions needed

- Decide the intended user guidance model.
- Define task success criteria from a user perspective, not just system behavior.

## Inputs for Wireframes / Mockups

### Successfully extracted

- current page map
- current panel map
- current control inventory
- overloaded and duplicated concepts
- missing feedback loops

### Still unclear

- What the ideal information hierarchy should be
- Which controls should be primary vs tucked away
- Whether pose setup should be integrated earlier or kept as a side panel

### Human decisions needed

- Decide the desired interaction hierarchy before any visual redesign.
- Decide whether to optimize for guided flow, expert density, or progressive disclosure.

## Inputs for a Terminology Canon

### Successfully extracted

- current canonical-ish code terms:
  - song
  - performance
  - voice
  - pad
  - mapping
  - natural hand pose
  - solver result
- known overloaded or conflicting terms:
  - layout
  - assignment
  - analysis
  - sound
  - section

### Still unclear

- Final user-facing naming for:
  - mapping vs layout
  - solver result vs analysis result
  - pose vs neutral/resting pose

### Human decisions needed

- Approve a final terminology canon.
- Decide which legacy terms should be retired from product copy.

## Inputs for a Source-of-Truth Domain Model

### Successfully extracted

- `Song` as portfolio container
- `ProjectState` as main product-state container
- `Performance` as musical input
- `GridMapping` as editable placement artifact
- `NaturalHandPose` as personalization artifact
- `EngineResult` as derived analysis artifact

### Still unclear

- Whether `LayoutSnapshot` remains a distinct user-facing concept or just an internal performance wrapper
- Whether `sectionMaps` remain part of the product domain
- Whether templates should become canonical product objects

### Human decisions needed

- Freeze the canonical user-facing domain model.
- Decide which dormant objects remain in scope.

## Inputs for Acceptance Criteria / QA

### Successfully extracted

- active routes and current intended behaviors
- key invariants:
  - empty-grid import
  - 8x8 grid
  - full coverage before optimization
  - Pose 0 uniqueness constraints
  - filtered vs raw performance distinction
- current verification baseline:
  - build failing on 2026-03-13
  - tests failing on 2026-03-13

### Still unclear

- Which current failures are acceptable transitional drift versus true behavioral regressions
- What user-level acceptance criteria should be for:
  - mapping creation
  - optimization success
  - analysis consistency across routes

### Human decisions needed

- Define acceptance criteria from product intent, not just current implementation.
- Decide which current regressions block future design work and which can be deferred.

## Overall Sufficiency Assessment

### What we now have enough information to draft

- Product overview
- feature inventory
- user goals and JTBD
- workflow maps
- screen architecture
- terminology canon draft
- domain source-of-truth draft
- task-based UX-spec draft
- QA checklist draft

### What remains materially ambiguous

- primary mission framing
- primary workflow order
- role of Pose 0 in onboarding
- role of Timeline and Event Analysis relative to Workbench
- role of sections, templates, and practice-mode concepts

### Bottom line

The repo now yields enough evidence to author the next-generation product-definition artifacts, but not enough to finalize them without human judgment on hierarchy, scope, and terminology.

