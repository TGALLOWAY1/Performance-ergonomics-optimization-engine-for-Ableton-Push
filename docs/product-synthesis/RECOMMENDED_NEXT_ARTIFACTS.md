# Recommended Next Artifacts

## Guidance

These are recommended next artifacts for a human + LLM collaboration. They are ordered to close the highest-value product-definition gaps before any visual redesign or implementation planning.

## Recommended Creation Order

| Order | Artifact name | Purpose | Why it is needed now | Feeds from these synthesis docs |
|---|---|---|---|---|
| 1 | User Mission | State the product's single primary mission in one durable statement | The repo currently mixes song portfolio, mapping workstation, and analysis-tool identities | `PRODUCT_OVERVIEW_FIRST_DRAFT.md`, `USER_GOALS_AND_JOBS_TO_BE_DONE.md`, `GAPS_DUPLICATIONS_AND_PRODUCT_CONFUSION.md` |
| 2 | Core User Goals | Freeze the ranked set of primary and secondary user goals | Current goal hierarchy is implied, not declared | `USER_GOALS_AND_JOBS_TO_BE_DONE.md`, `PRODUCT_OVERVIEW_FIRST_DRAFT.md` |
| 3 | JTBD Canon | Finalize 1-3 primary jobs to be done and optional secondary jobs | Prevents future UX work from optimizing for mixed or conflicting jobs | `USER_GOALS_AND_JOBS_TO_BE_DONE.md`, `ARTIFACT_INPUTS_CHECKLIST.md` |
| 4 | Canonical Terminology Doc | Declare the user-facing vocabulary and retire overloaded terms | The current repo still suffers from `layout` / `mapping` / `voice` / `sound` drift | `DOMAIN_MODEL_AND_TERMINOLOGY.md`, `GAPS_DUPLICATIONS_AND_PRODUCT_CONFUSION.md` |
| 5 | Domain Source-of-Truth Spec | Freeze the core product objects and their relationships | Needed before detailed UX specs or acceptance criteria | `DOMAIN_MODEL_AND_TERMINOLOGY.md`, `STATE_SYSTEMS_AND_SOURCE_OF_TRUTH.md` |
| 6 | Workflow Maps | Turn current inferred workflows into approved canonical user flows | Current product exposes many valid but competing paths | `WORKFLOW_AND_TASK_INVENTORY.md`, `SCREEN_ROUTE_AND_PANEL_MAP.md` |
| 7 | Screen Architecture Spec | Define which screens are primary, secondary, drill-down, or internal | Needed to resolve Workbench vs Timeline vs Event Analysis overlap | `SCREEN_ROUTE_AND_PANEL_MAP.md`, `GAPS_DUPLICATIONS_AND_PRODUCT_CONFUSION.md` |
| 8 | Task-Based UX Spec | Specify tasks, prerequisites, user decisions, success criteria, and system responsibilities | Best bridge from product definition into future interaction design | `WORKFLOW_AND_TASK_INVENTORY.md`, `STATE_SYSTEMS_AND_SOURCE_OF_TRUTH.md`, `CONSTRAINTS_CONSTANTS_AND_INVARIANTS.md` |
| 9 | Wireframe Brief | Provide a design brief for future wireframes/mockups without prematurely redesigning | The repo is ready for a deliberate brief, not random UI changes | `SCREEN_ROUTE_AND_PANEL_MAP.md`, `VISUALIZATION_AND_FEEDBACK_MODEL.md`, `GAPS_DUPLICATIONS_AND_PRODUCT_CONFUSION.md` |
| 10 | Human QA / Acceptance Checklist | Convert product intent into verifiable, user-facing acceptance checks | Current build/test state is not a sufficient product QA definition | `ARTIFACT_INPUTS_CHECKLIST.md`, `CONSTRAINTS_CONSTANTS_AND_INVARIANTS.md`, `STATE_SYSTEMS_AND_SOURCE_OF_TRUTH.md` |

## Artifact Details

### 1. User Mission

- Purpose
  - Define the product in one sentence that will constrain all later decisions.
- Why needed
  - The current repo mixes at least three possible identities.
- Inputs
  - `PRODUCT_OVERVIEW_FIRST_DRAFT.md`
  - `USER_GOALS_AND_JOBS_TO_BE_DONE.md`
  - `GAPS_DUPLICATIONS_AND_PRODUCT_CONFUSION.md`

### 2. Core User Goals

- Purpose
  - Rank what the product must help users accomplish.
- Why needed
  - The current system exposes more goals than it explicitly prioritizes.
- Inputs
  - `USER_GOALS_AND_JOBS_TO_BE_DONE.md`
  - `PRODUCT_OVERVIEW_FIRST_DRAFT.md`

### 3. JTBD Canon

- Purpose
  - Turn observed needs into a small set of durable job statements.
- Why needed
  - Prevents feature sprawl and keeps future UX focused on real outcomes.
- Inputs
  - `USER_GOALS_AND_JOBS_TO_BE_DONE.md`

### 4. Canonical Terminology Doc

- Purpose
  - Approve final vocabulary for user-facing product and internal specs.
- Why needed
  - Current terminology drift is one of the biggest causes of product ambiguity.
- Inputs
  - `DOMAIN_MODEL_AND_TERMINOLOGY.md`
  - `GAPS_DUPLICATIONS_AND_PRODUCT_CONFUSION.md`

### 5. Domain Source-of-Truth Spec

- Purpose
  - Freeze the key objects, ownership, and relationships the UX should respect.
- Why needed
  - Future flows and specs depend on clarity about what is actually being edited or analyzed.
- Inputs
  - `DOMAIN_MODEL_AND_TERMINOLOGY.md`
  - `STATE_SYSTEMS_AND_SOURCE_OF_TRUTH.md`
  - `CONSTRAINTS_CONSTANTS_AND_INVARIANTS.md`

### 6. Workflow Maps

- Purpose
  - Produce explicit canonical flows with entry conditions, branch rules, and success conditions.
- Why needed
  - The current product exposes multiple competing "next actions."
- Inputs
  - `WORKFLOW_AND_TASK_INVENTORY.md`
  - `USER_GOALS_AND_JOBS_TO_BE_DONE.md`

### 7. Screen Architecture Spec

- Purpose
  - Define the role of each route and major panel in the final product architecture.
- Why needed
  - There is strong overlap between Workbench, Timeline, and Event Analysis.
- Inputs
  - `SCREEN_ROUTE_AND_PANEL_MAP.md`
  - `WORKFLOW_AND_TASK_INVENTORY.md`
  - `GAPS_DUPLICATIONS_AND_PRODUCT_CONFUSION.md`

### 8. Task-Based UX Spec

- Purpose
  - Translate approved workflows into concrete tasks, state transitions, and UI responsibilities.
- Why needed
  - This is the most useful pre-wireframe artifact.
- Inputs
  - `WORKFLOW_AND_TASK_INVENTORY.md`
  - `STATE_SYSTEMS_AND_SOURCE_OF_TRUTH.md`
  - `VISUALIZATION_AND_FEEDBACK_MODEL.md`
  - `CONSTRAINTS_CONSTANTS_AND_INVARIANTS.md`

### 9. Wireframe Brief

- Purpose
  - Give future wireframe or mockup work a sharp brief that reflects approved product intent.
- Why needed
  - The repo is not ready for design improvisation; it needs structured direction first.
- Inputs
  - `SCREEN_ROUTE_AND_PANEL_MAP.md`
  - `VISUALIZATION_AND_FEEDBACK_MODEL.md`
  - `GAPS_DUPLICATIONS_AND_PRODUCT_CONFUSION.md`

### 10. Human QA / Acceptance Checklist

- Purpose
  - Define how humans will validate whether the product matches the intended mission, workflows, and terminology.
- Why needed
  - Current automated verification is valuable but not sufficient as product acceptance.
- Inputs
  - `ARTIFACT_INPUTS_CHECKLIST.md`
  - `CONSTRAINTS_CONSTANTS_AND_INVARIANTS.md`
  - `STATE_SYSTEMS_AND_SOURCE_OF_TRUTH.md`

## Suggested Working Sequence

1. Approve a User Mission.
2. Lock Core User Goals and JTBD.
3. Lock Terminology and Domain Source of Truth.
4. Approve canonical Workflow Maps.
5. Approve Screen Architecture.
6. Produce Task-Based UX Spec.
7. Write Wireframe Brief.
8. Write Human QA / Acceptance Checklist.

## What Not To Do Yet

- Do not jump directly to mockups.
- Do not start refactoring routes or state models based only on implementation convenience.
- Do not treat current screen structure as final just because it exists.

The repo now contains enough evidence to author these artifacts well, but it still needs human judgment to resolve mission, hierarchy, and naming before UX architecture should be finalized.

