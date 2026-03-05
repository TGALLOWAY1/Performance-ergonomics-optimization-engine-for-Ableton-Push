# Audit Verification Report

**Report date:** 2026-03-05  
**Audit reference:** docs/audit/ (01–09), surgical plan 08  
**Verification method:** Code search, git history, build/test run

---

## 1) Executive Summary

### What’s definitely done
- **Build and health gates:** TypeScript strict build passes (`npm run build`). `typecheck` and `test` / `test:run` scripts exist and run (Vitest).
- **Canonical engine results:** Single source of truth: `projectState.solverResults` + `activeSolverId`. Context exposes `engineResult` as derived from `solverResults[activeSolverId]`. No `legacyEngineResult` or reactive `setEngineResult` path; `setEngineResult` is a no-op stub.
- **Reactive loop removed:** No Workbench `useEffect` that runs the solver on mapping/performance change or writes `scoreCache` into state on a reactive loop. Solver runs only via manual “Run Analysis” and `ProjectContext.runSolver`.
- **activeMappingId in global state:** `ProjectState.activeMappingId` is defined and persisted; Workbench reads/writes it; persistence and load set it.
- **Dead legacy stack removed:** No references to `AnalysisView`, `ImportWizard`, or `EngineResultsPanel` in `src`.
- **Theme persistence:** Theme is read/written to `localStorage` (`push_perf_theme`) in `ThemeContext.tsx`.
- **Centralized hydration hook:** `useSongStateHydration(songId)` exists and is used by Workbench and TimelinePage.
- **Manual assignment by eventKey on Event Analysis:** EventAnalysisPage uses `eventKey` in `handleAssignmentChange` and stores `manualAssignments[layoutId][eventKey]`.

### What’s definitely not done (or partial)
- **Identity correctness (Workbench):** Workbench’s `handleAssignmentChange(index: number, ...)` still keys assignments by **index**; AnalysisPanel’s `onAssignmentChange` is commented out, so the in-Workbench assignment UI may be effectively disabled. Event Analysis page uses eventKey; Workbench does not.
- **activeMappingId consistency on Timeline:** TimelinePage resolves `activeMapping` with a wrong expression: `m.id === (projectState.activeLayoutId ? projectState.mappings[0]?.id : null)` (uses layout id and first mapping), so it does **not** follow `projectState.activeMappingId`.
- **Hydration fully centralized:** EventAnalysisPage still has its own load effect using `songService.loadSongState(songId)` and does **not** use `useSongStateHydration`.
- **Import/export validation:** `validateProjectState` supplies defaults and migrates shape but does not reject malformed documents (e.g. missing `instrumentConfig`); `instrumentConfig` can end up null. Load failure still uses `alert("Failed to parse project file")`.
- **UX polish:** “Last Sync: 2 minutes ago” remains in Dashboard (static). Workbench still has “Suggest Ergonomic Layout (Soon)”. No inline/toast replacement for load error alerts.

### Highest-risk gaps
1. **TimelinePage ignores activeMappingId** — Timeline always uses the first mapping when a layout exists; switching mapping in Workbench is not reflected on Timeline.
2. **Workbench manual assignment still index-based** — If assignment controls in Workbench are re-enabled, edits could target the wrong event when the event list is sorted/filtered.
3. **EventAnalysisPage hydration separate from hook** — Refresh and load heuristics can diverge from Workbench/Timeline and cause inconsistent state across routes.

---

## 2) Verification Table

| Item | Status | Evidence | Notes | Relevance |
|------|--------|----------|--------|-----------|
| **A1** TypeScript build passes strict | **Done** | `npm run build` (tsc && vite build) succeeds. `src/` has no remaining legacyEngineResult/setEngineResult usage. | Unused-arg/symbol fixes in ea7bcf6, 07336d8. | Still relevant. |
| **A2** Health scripts (typecheck, test) | **Done** | `package.json`: `"typecheck": "tsc -p tsconfig.json --noEmit"`, `"test": "vitest"`, `"test:run"`, `"test:coverage"`. Vitest runs engine tests. | Added in same period as build fix. | Still relevant. |
| **B1** Single source of truth for solver results | **Done** | `ProjectContext.tsx`: `activeResult` derived from `projectState.solverResults` and `projectState.activeSolverId`; `runSolver` writes only to `solverResults` + `activeSolverId`. No `legacyEngineResult`; `setEngineResult` is no-op. | Commits 9110f59, 32f2a3b. | Still relevant. |
| **B2** No stale UI after solver; analysis reflects current mapping | **Done** | Workbench and EventAnalysisPage consume `engineResult` from context (derived from solverResults). No reactive solver loop; user must click “Run Analysis” to refresh. | Reactive loop removed in 9110f59. | Still relevant. |
| **B3** Derived caches do not churn undo/history | **Partial** | runSolver does not write scoreCache. optimizeLayout writes `scoreCache` inside `setProjectState` without `skipHistory`, so one layout optimization = one undo step (acceptable). No continuous reactive scoreCache writes. | History pollution from reactive loop fixed; optimizeLayout is a single user action. | Still relevant. |
| **C1** Manual assignments / event edits target correct event (no index-based identity bugs) | **Partial** | EventAnalysisPage: `handleAssignmentChange(eventKey, ...)` and `manualAssignments[layoutId][eventKey]` (EventAnalysisPage.tsx:80–93). EventLogTable passes eventKey (or eventIndex/index fallback). Workbench: `handleAssignmentChange(index: number, ...)` and stores by index; AnalysisPanel’s onAssignmentChange is commented out (AnalysisPanel.tsx:22). | Event Analysis path fixed; Workbench path still index-based and panel callback unused. | Still relevant. |
| **C2** activeMappingId consistent across Workbench / Timeline / Event Analysis | **Partial** | Workbench: reads `projectState.activeMappingId`, derives `activeMapping` from it (Workbench.tsx:54–71). TimelinePage: `activeMapping = projectState.mappings.find(m => m.id === (projectState.activeLayoutId ? projectState.mappings[0]?.id : null))` — uses activeLayoutId and first mapping id, **not** activeMappingId (TimelinePage.tsx:28–30). EventAnalysisPage: does not explicitly resolve mapping; uses context performance/engineResult. | Timeline bug: should use `projectState.activeMappingId`. | Still relevant. |
| **D1** Route hydration centralized and consistent | **Partial** | `useSongStateHydration.ts` used by Workbench (Workbench.tsx:47) and TimelinePage (TimelinePage.tsx:20). EventAnalysisPage has its own useEffect that calls `songService.loadSongState(songId)` (EventAnalysisPage.tsx:40–75), different heuristics. | Two hydration paths; Event Analysis not using shared hook. | Still relevant. |
| **D2** Import/export validation strict; malformed shape rejected | **Partial** | `validateProjectState(parsed)` (projectPersistence.ts:28–58): checks `parsed` is object; supplies defaults for arrays and primitives; `instrumentConfig` can be null if parsed has no config. No schema that rejects invalid structure. Load project uses `alert("Failed to parse project file")` on error (Workbench.tsx:456). | Validation is defensive-defaults, not strict reject. | Still relevant. |
| **E1** Dead/legacy analysis stacks removed or isolated | **Done** | `git grep` for AnalysisView, ImportWizard, EngineResultsPanel: no matches in src. Commits 32f2a3b “refactor: isolate and remove unused legacy workbench stack”. | Legacy UI removed. | Still relevant. |
| **E2** Duplicate solver orchestration consolidated | **Done** | Solver runs only via ProjectContext.runSolver (manual trigger from Workbench). Workbench handleProjectLoad runs solver once for verification after load; no page-level reactive solver. EventAnalysisPage only reads engineResult from context. | Single orchestration path. | Still relevant. |
| **F1** Dead/misleading CTAs removed or implemented | **Partial** | “Suggest Ergonomic Layout (Soon)” still in Workbench (Workbench.tsx:1061). “Last Sync: 2 minutes ago” still in Dashboard (Dashboard.tsx:149). Practice-related code exists (PracticeLoopControls, usePracticeLoop) and is used on Event Analysis. | Audit asked to remove or implement; static “Soon” and “Last Sync” remain. | Still relevant. |
| **F2** Error handling away from disruptive alerts | **Not done** | Load project failure still uses `alert("Failed to parse project file")` (Workbench.tsx:456). No inline/toast pattern for load errors. | As in audit. | Still relevant. |

---

## 3) “Still relevant?” analysis

- **B3 (scoreCache / undo):** Still relevant. optimizeLayout writing one undo step is acceptable; no change needed unless you want that action to be undo-skipped.
- **C1 (identity):** Still relevant. Extend eventKey-based assignment to Workbench (AnalysisPanel or equivalent) and store manualAssignments by eventKey in Workbench path as well.
- **C2 (activeMappingId):** Still relevant. Fix TimelinePage to use `projectState.activeMappingId` for resolving activeMapping.
- **D1 (hydration):** Still relevant. Migrate EventAnalysisPage to use `useSongStateHydration(songId)` and remove its local load effect (or call the same helper from the hook).
- **D2 (validation):** Still relevant. Add strict validation (required fields / schema or guards) and reject with clear errors; optionally replace alert with inline/toast.
- **F1 / F2:** Still relevant. Remove or replace static “Soon” and “Last Sync”; replace load alert with non-disruptive error UX.

Nothing in the checklist is obsolete; the architecture matches the plan (single solver result, activeMappingId in state, no legacy stack). Remaining work is completion of identity, hydration, validation, and UX polish.

---

## 4) Recommended next sprint (max 8 tasks)

| # | Goal | Files likely to change | Acceptance test / reproduction | Suggested commit message | Constraints |
|---|------|------------------------|-------------------------------|---------------------------|-------------|
| 1 | Fix TimelinePage to use activeMappingId for active mapping | `src/pages/TimelinePage.tsx` | Create two mappings in Workbench, switch to second; open Timeline with same songId; confirm timeline shows voices from second mapping. | fix(timeline): use activeMappingId for active mapping resolution |
| 2 | Migrate EventAnalysisPage to useSongStateHydration | `src/pages/EventAnalysisPage.tsx`, optionally `src/hooks/useSongStateHydration.ts` | Refresh Event Analysis with songId in URL; confirm state matches Workbench. Open Workbench, then Event Analysis; confirm same state. | refactor(event-analysis): use useSongStateHydration for load |
| 3 | Use eventKey for manual assignments in Workbench path | `src/workbench/Workbench.tsx`, `src/workbench/AnalysisPanel.tsx` (or panel that exposes assignment UI) | If AnalysisPanel (or Workbench panel) has assignment controls: show event list sorted by cost, change assignment on one row, confirm only that event’s assignment changes. | fix(workbench): key manual assignments by eventKey in Workbench |
| 4 | Harden validateProjectState and load error UX | `src/utils/projectPersistence.ts`, `src/workbench/Workbench.tsx` | Load JSON missing `instrumentConfig` or with invalid layout structure; expect clear validation error and no corrupt in-memory state. Replace alert with inline message or toast. | feat(persistence): strict project load validation and clear error UX |
| 5 | Remove or replace static “Last Sync” and “Soon” | `src/pages/Dashboard.tsx`, `src/workbench/Workbench.tsx` | Dashboard: no “Last Sync: 2 minutes ago” or it reflects real data. Workbench: no “Suggest Ergonomic Layout (Soon)” or button is functional. | ux: remove misleading static status and Soon CTA |
| 6 | Replace load-project alert with inline/toast error | `src/workbench/Workbench.tsx` | Trigger load failure (bad file); see error in UI (inline or toast), not modal alert. | ux: replace project load alert with inline/toast error |
| 7 | (Optional) Skip history for optimizeLayout state update | `src/context/ProjectContext.tsx` | Run “Auto-Arrange”; undo once; expect layout to revert to pre-optimization (if you want optimize to be one undo step, skip this). | refactor(context): skipHistory for optimizeLayout state update |
| 8 | Add regression test for activeMappingId across routes | `src/engine/__tests__/` or E2E | Test or doc: after setState with activeMappingId X, any consumer that resolves “active mapping” uses X. | test: assert activeMappingId used for active mapping resolution |

**Suggested order:** 1 → 2 → 3 → 4; then 5 and 6 (UX); 7–8 as capacity allows.

---

## Evidence summary (key symbols and commits)

- **No legacy engine result:** `git grep` for `legacyEngineResult` and `setEngineResult` in src: only `setEngineResult: () => { }` stub in ProjectContext.tsx:405.
- **Solver single path:** `runSolver` in ProjectContext.tsx writes only to `solverResults` and `activeSolverId`. Workbench and EventAnalysisPage do not run solver in effects; Workbench runs solver only in handleRunSolver and once in handleProjectLoad.
- **activeMappingId:** In projectState.ts, projectPersistence.ts, Workbench.tsx (read/write), useSongStateHydration (default when missing). Not used in TimelinePage’s activeMapping useMemo.
- **Hydration:** useSongStateHydration.ts used by Workbench and TimelinePage; EventAnalysisPage has own useEffect with loadSongState.
- **Manual assignments:** EventAnalysisPage uses eventKey (string); Workbench uses index (number). EventLogTable passes eventKey; AnalysisPanel’s onAssignmentChange is commented out.
- **Relevant commits (from git log):** ea7bcf6 (build), 9110f59 (single source of truth, history), 32f2a3b (remove legacy stack), 07336d8 (UX, theme persist), 0011a92 (restingPose hydration).
