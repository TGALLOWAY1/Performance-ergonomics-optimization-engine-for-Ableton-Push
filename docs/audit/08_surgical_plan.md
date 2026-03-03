# 08 - Surgical Improvement Plan

- Audit timestamp: 2026-03-02T22:03:02-0500
- Repo branch: codex/audit/deep-codebase-review
- Audit scope: Decision-complete implementation roadmap to resolve correctness/state-truth issues first, then UX and cleanup.
- Commands run:
  - `rg -n` sweeps over Workbench/ProjectContext/Timeline/EventAnalysis/persistence/legacy stack files
  - `npm run build -- --outDir /tmp/push-performance-audit-dist`
  - Runtime route diagnostics on `/`, `/workbench`, `/event-analysis`, `/timeline`

## Strategy summary

1. Fix correctness and single-source-of-truth first.
2. Stabilize mapping/event identity semantics.
3. Consolidate hydration/persistence/import-export paths.
4. Remove legacy dead stack and duplicated logic.
5. Polish UX once the state model is reliable.

## Proposed phased implementation

### Phase 0 - Build gate and safety rail

- Goals:
  - Restore passing TypeScript build.
  - Block regressions while refactors proceed.
- Modules/files to change:
  - `src/workbench/LayoutDesigner.tsx`
  - `src/workbench/VoiceLibrary.tsx`
  - `src/workbench/Workbench.tsx`
  - `src/pages/Dashboard.tsx`
  - `package.json` (add `typecheck` and `test` placeholders if chosen)
- Delete/consolidate:
  - Remove or wire unresolved symbols (`onRequestMapToQuadrants` path).
  - Remove stale unused parameters/handlers where feature is not wired.
- Acceptance gates:
  - `npm run build -- --outDir /tmp/push-performance-audit-dist` passes.
  - No unresolved symbol/unused strict failures in touched files.

### Phase 1 - Canonical analysis state and solver orchestration (highest correctness)

- Goals:
  - Eliminate engine result split between legacy and solver map.
  - Stop history pollution from derived analysis writes.
- Modules/files to change:
  - `src/context/ProjectContext.tsx`
  - `src/workbench/Workbench.tsx`
  - `src/pages/EventAnalysisPage.tsx`
  - `src/hooks/useProjectHistory.ts`
- Delete/consolidate:
  - Deprecate/remove `legacyEngineResult` and `setEngineResult` path.
  - Replace Workbench/EventAnalysis direct solver effects with context-managed API.
- Key implementation decisions:
  - `engineResult` derives only from `projectState.solverResults[activeSolverId]`.
  - Introduce explicit analysis mode: `live` vs `snapshot` in context (if needed).
  - Keep `scoreCache` derived outside undo history (`skipHistory` or computed selector).
- Acceptance gates:
  - After running solver once, mapping edits still update displayed analysis correctly.
  - Undo history reflects user actions only, not derived score churn.

### Phase 2 - Stable identity model for mapping and events

- Goals:
  - Ensure active mapping consistency across routes.
  - Prevent manual assignment drift from index-based identity.
- Modules/files to change:
  - `src/types/projectState.ts`
  - `src/workbench/Workbench.tsx`
  - `src/pages/TimelinePage.tsx`
  - `src/pages/EventAnalysisPage.tsx`
  - `src/workbench/EventLogTable.tsx`
  - `src/utils/performanceSelectors.ts`
- Delete/consolidate:
  - Replace local-only `activeMappingId` with shared source (context state or query param).
  - Replace assignment keying by display index with stable event key.
- Key implementation decisions:
  - Add `activeMappingId` to `ProjectState` (or route-level canonical param; choose one and enforce globally).
  - Add stable event identity model (e.g., persisted event UUID at import or deterministic composite key).
- Acceptance gates:
  - Mapping selected in Workbench is the same mapping used in Timeline and EventAnalysis.
  - Editing an event assignment affects only the intended event after sorting/filtering.

### Phase 3 - Hydration and persistence consolidation

- Goals:
  - Unify route-entry load logic and persistence semantics.
  - Improve project JSON schema validation and migration.
- Modules/files to change:
  - `src/services/SongService.ts`
  - `src/utils/projectPersistence.ts`
  - `src/workbench/Workbench.tsx`
  - `src/pages/TimelinePage.tsx`
  - `src/pages/EventAnalysisPage.tsx`
  - New hook/service: `src/hooks/useSongStateHydration.ts` (or equivalent)
- Delete/consolidate:
  - Remove duplicated load heuristics in each page.
  - Use one canonical import/export utility path.
- Key implementation decisions:
  - Add schema validator for JSON load (minimal required fields + migration defaults).
  - Keep explicit distinction between autosave state and exported artifact in UI copy.
- Acceptance gates:
  - Refreshing any route with `songId` yields consistent loaded state.
  - Malformed load file shows actionable validation errors and does not corrupt state.

### Phase 4 - Dead-path removal and architecture simplification

- Goals:
  - Reduce maintenance overhead from unrouted legacy stack.
  - Remove duplicated utilities only referenced by dead stack.
- Modules/files to change:
  - `src/workbench/AnalysisView.tsx`
  - `src/workbench/Sidebar.tsx`
  - `src/workbench/GridArea.tsx`
  - `src/workbench/GridEditor.tsx`
  - `src/workbench/EngineResultsPanel.tsx`
  - `src/workbench/LayoutList.tsx`
  - `src/workbench/SectionMapList.tsx`
  - `src/workbench/TimelineArea.tsx`
  - `src/workbench/ImportWizard.tsx`
  - `src/utils/projectPersistence.ts` (trim dead exports if no longer used)
  - `src/utils/midiImport.ts` (trim legacy wrappers if no longer used)
- Delete/consolidate:
  - Remove unrouted stack or move to clearly isolated legacy folder.
- Acceptance gates:
  - Active route architecture has no unreachable component tree dependencies.
  - `rg` confirms removed dead references.

### Phase 5 - UX polish after correctness lock

- Goals:
  - Remove misleading/dead affordances.
  - Improve workflow guidance and terminology clarity.
- Modules/files to change:
  - `src/pages/Dashboard.tsx`
  - `src/components/dashboard/SongCard.tsx`
  - `src/workbench/Workbench.tsx`
  - `src/pages/TimelinePage.tsx`
  - `src/context/ThemeContext.tsx`
- Delete/consolidate:
  - Remove static fake status text and dead controls (`Soon`, non-functional buttons).
  - Add clear workflow cues and persistence messaging.
- Acceptance gates:
  - Every visible primary action is functional or intentionally hidden.
  - Theme preference persists across refresh.

## Suggested commit boundaries for implementation phase (future work)

1. `fix: resolve strict TS blockers and restore build`  
2. `refactor: unify engine result source in ProjectContext`  
3. `fix: move reactive analysis writes out of undo-tracked state`  
4. `feat: add canonical activeMappingId to shared state`  
5. `fix: switch manual assignments to stable event identity`  
6. `refactor: centralize song-state hydration for routed pages`  
7. `refactor: centralize project import/export validation`  
8. `chore: remove dead AnalysisView legacy stack`  
9. `chore: remove dead midi/persistence wrappers tied to legacy stack`  
10. `ux: remove non-functional controls and improve workflow affordances`  
11. `chore: gate debug logging behind development flags`  
12. `test: add regression tests for mapping identity, assignment stability, and hydration`

## Cross-phase acceptance checklist

- Correctness:
  - Single canonical analysis result path.
  - Stable event identity for overrides.
  - Shared mapping identity across routes.
- Reliability:
  - Build passes in strict mode.
  - JSON load validates and migrates safely.
- UX:
  - No dead CTAs in user path.
  - Clear persistence messaging.
- Maintainability:
  - Dead legacy stack removed or isolated.
  - Reduced duplicate orchestration logic.

## Assumptions/defaults for implementation planning

- Prioritize minimal-risk refactors before adding new features.
- Keep behavior parity where feasible while changing state ownership.
- Add tests only for high-risk correctness paths first (state identity, assignment, hydration).

