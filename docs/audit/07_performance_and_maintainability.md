# 07 - Performance and Maintainability Audit

- Audit timestamp: 2026-03-02T22:03:02-0500
- Repo branch: codex/audit/deep-codebase-review
- Audit scope: Runtime hotspots, recompute/render pressure, maintainability and build/test health.
- Commands run:
  - `npm run build -- --outDir /tmp/push-performance-audit-dist`
  - `npm run`
  - `npm test`
  - `npm run typecheck`
  - `wc -l src/workbench/Workbench.tsx src/workbench/LayoutDesigner.tsx src/workbench/AnalysisView.tsx ...`
  - Targeted `rg -n` scans for solver effects, state writes, and logging paths

## Hotspot inventory

| Hotspot | Reference | Observed | Impact | Confidence |
|---|---|---|---|---|
| Reactive solver loop dependency breadth | `src/workbench/Workbench.tsx` reactive effect dependencies include `projectState` | Effect can rerun from broad state mutations unrelated to mapping/performance core | CPU churn, extra solves, noisy state writes | High |
| Derived score write inside reactive loop | `src/workbench/Workbench.tsx` updates `mappings[].scoreCache` after solve | Derived write triggers additional context updates/history/autosave | Cascading recompute + persistence overhead | High |
| Monolithic orchestrator component | `src/workbench/Workbench.tsx` (~1659 LOC) | Routing hydration, solver control, persistence, mapping edits, and UI all coupled | Hard to reason about regressions and optimize isolated concerns | High |
| Large dual-purpose designer component | `src/workbench/LayoutDesigner.tsx` (~1483 LOC) | DnD, context menus, mapping ops, voice visibility, destructive edits in one component | High render complexity and refactor risk | High |
| O(E*V) timeline rendering lookup | `src/workbench/Timeline.tsx` per-event `findIndex` in render loop | For each event, scans voice list to find lane | Scales poorly on larger MIDI datasets | Medium |
| Per-render heavy derived maps | `src/workbench/LayoutDesigner.tsx:fingerAssignmentMap` depends on full `projectState` | Rebuilds map and traverses events/assignments frequently | Extra GC/render pressure on frequent state changes | Medium |
| Repeated debug logging in hot paths | `src/workbench/Workbench.tsx`, `src/utils/midiImport.ts`, `src/workbench/SoundAssignmentTable.tsx` | Logs execute during regular interactions | Console overhead and reduced debuggability signal | Medium |
| Duplicate hydration effects across pages | `Workbench`, `TimelinePage`, `EventAnalysisPage` | Similar route-load effects each with their own heuristics | Additional complexity + potential extra state churn | Medium |

## Expensive render and state patterns

| Pattern | Reference | Observation | Suggested boundary |
|---|---|---|---|
| Full-object `setProjectState({...projectState,...})` in many handlers | `src/workbench/Workbench.tsx` many mutation handlers | High chance of stale closure overwrites and broad rerenders | Use functional updates + scoped reducers for mapping operations |
| `projectState` passed deeply through large child trees | Workbench -> LayoutDesigner + AnalysisPanel | Any top-level state write propagates widely | Introduce memoized selectors and smaller context slices |
| Non-canonical mapping selection | local `activeMappingId` vs pages using `mappings[0]` | Render outputs can reflect different mappings | Move active mapping identity to shared state/route param |

## Targeted performance improvements

| Improvement | Scope | Why it helps | Feasibility |
|---|---|---|---|
| Extract solver trigger selector and narrow effect deps | Workbench reactive loop | Avoids solve reruns on unrelated state updates | High |
| Remove derived score writes from undo-tracked state | Workbench + history | Prevents history and autosave amplification | High |
| Memoize timeline lane index map (`noteNumber -> laneIndex`) | Timeline component | Converts O(E*V) to O(E) per frame/render | High |
| Introduce `useSongStateHydration(songId)` | Workbench/Timeline/EventAnalysis | Reduces duplicated load effects and branching | Medium |
| Replace broad logging with debug flag utility | Engine/workbench/utils | Keeps production console clean and lowers hot-path overhead | High |
| Split Workbench into domain hooks + presentational sections | Workbench | Better isolation for profiling/testing and fewer cascading renders | Medium |

## Incremental vs full recompute notes

- Current architecture favors full recompute on many edits (`BiomechanicalSolver.solve` in reactive loop).
- Incremental recompute is feasible for local pad moves if event-to-pad dependency graph is indexed by note/pad usage.
- Recommended near-term compromise:
  - Keep full recompute for now.
  - Strictly debounce and narrow triggers.
  - Add cheap memoized prechecks (no meaningful mapping/performance delta -> skip solve).

## Build and maintainability health

| Category | Current state | Evidence |
|---|---|---|
| TypeScript strictness | Enabled (`strict`, `noUnusedLocals`, `noUnusedParameters`) | `tsconfig.json` |
| Build status | Failing due TS diagnostics | `npm run build -- --outDir /tmp/push-performance-audit-dist` output |
| Test runner integration | No `npm test` script | `npm run`, `npm test` output |
| Typecheck script | No `npm run typecheck` script | `npm run`, `npm run typecheck` output |
| Test files present | Yes, but excluded from tsconfig and not wired to scripts | `src/engine/__tests__/*`, `src/workbench/__tests__/*`, `tsconfig.json:exclude` |
| Lint script | Not present in scripts | `package.json:scripts` |
| Module structure | Parallel active + legacy stacks in `src/workbench` | Dead `AnalysisView` chain plus active Workbench route |

## Folder structure friction points

| Friction | Observation | Recommendation |
|---|---|---|
| Active and legacy workbench architectures coexist | Increases search and edit ambiguity | Move legacy stack to `src/legacy/` or remove |
| Orchestration and view logic intertwined | Difficult ownership boundaries | Introduce feature folders with hooks/services/view split |
| Utility duplication for persistence/import | Drift between inline and utility paths | Centralize persistence/import into one domain service layer |

