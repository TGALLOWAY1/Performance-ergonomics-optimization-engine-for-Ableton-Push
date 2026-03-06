# Route consistency + validation hardening

## Summary

Surgical fixes to enforce state consistency across routes, stabilize event identity, unify hydration, and harden project file validation and error UX.

---

## Decisions (locked in)

| Decision | Rule |
|----------|------|
| **A — Mapping selection** | Every page that needs a mapping resolves it via `projectState.activeMappingId`. Fallback to first mapping only if `activeMappingId` is missing or invalid. |
| **B — Event identity** | Manual assignments are keyed by `eventKey` (or stable event id), never by index. |
| **C — Hydration** | All song routes use `useSongStateHydration(songId)`. No page-specific custom load effects. |
| **D — Validation** | Invalid core shape fails fast with a structured message. No silent patching of bad state. |

---

## Commits (5)

1. **fix(timeline): resolve active mapping via activeMappingId**  
   Timeline now resolves the active mapping from `projectState.activeMappingId` (with fallback to first mapping) instead of using layout id or first mapping only.

2. **refactor(event-analysis): use shared song hydration hook**  
   Event Analysis page uses `useSongStateHydration(songId)` only; removed the local `useEffect` that called `songService.loadSongState(songId)` and added a loading state until hydration completes.

3. **fix(workbench): key manual assignments by eventKey**  
   - Workbench: `handleAssignmentChange(eventKey: string, ...)` and store `manualAssignments[layoutId][eventKey]`.  
   - LayoutDesigner: look up by `event.eventKey ?? String(eventIndex)`.  
   - ProjectContext: pass string-keyed `manualAssignments` to the engine (no numeric conversion).  
   - AnalysisPanel: prop type `(eventKey: string, ...)`.  
   - In-app project load error: replaced `alert("Failed to parse project file")` with a dismissible inline banner (message + “Use a valid project file…”).  
   - Removed the disabled “Suggest Ergonomic Layout (Soon)” button from the settings menu.

4. **feat(persistence): strict project load validation with structured errors**  
   - `ValidationResult = { ok: true, state } | { ok: false, error: { code, message, path? } }`.  
   - `validateProjectStrict(parsed)` rejects missing/invalid `instrumentConfig`, invalid `layouts`/`mappings`, and bad `manualAssignments` shape.  
   - `loadProject(file)` returns `Promise<ValidationResult>`; parse errors return structured error, no throw for validation failure.  
   - New tests: `src/utils/__tests__/projectPersistence.test.ts` (6 tests).

5. **ux: remove misleading static status text**  
   Removed the Dashboard footer text “Last Sync: 2 minutes ago”.

---

## Acceptance tests

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Create 2 mappings, switch in Workbench, open Timeline (same songId) | Timeline shows the selected mapping, not the first. |
| 2 | Refresh Event Analysis with songId in URL | State matches Workbench/Timeline. |
| 3 | Change assignment on a row (when assignment editing exists) after sorting | Only that event changes; identity is stable. |
| 4 | Load intentionally malformed JSON (project file) | State unchanged; clear inline error; no alert. |
| 5 | Load JSON missing `instrumentConfig` | Rejected with structured error; no silent null. |
| 6 | Open Dashboard / Workbench settings | No “Last Sync: 2 minutes ago”; no “Suggest Ergonomic Layout (Soon)”. |

---

## Files touched

- `src/pages/TimelinePage.tsx`
- `src/pages/EventAnalysisPage.tsx`
- `src/pages/Dashboard.tsx`
- `src/workbench/Workbench.tsx`
- `src/workbench/LayoutDesigner.tsx`
- `src/workbench/AnalysisPanel.tsx`
- `src/context/ProjectContext.tsx`
- `src/types/projectState.ts`
- `src/utils/projectPersistence.ts`
- `src/utils/__tests__/projectPersistence.test.ts` (new)

---

## Guardrails respected

- Changes are surgical; no broad refactors.
- No reintroduction of legacy “engine result” state paths.
- Single hydration path; no second mechanism.
- Persistence load/save kept in sync with state shape.
- Targeted tests added for strict validation.
