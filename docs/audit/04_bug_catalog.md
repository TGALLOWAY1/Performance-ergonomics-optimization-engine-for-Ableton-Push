# 04 - Bug and Edge-Case Catalog

- Audit timestamp: 2026-03-02T22:03:02-0500
- Repo branch: codex/audit/deep-codebase-review
- Audit scope: Correctness, state-flow, import/mapping/solver interactions, undo/redo, persistence correctness, and runtime stability.
- Commands run:
  - `npm run build -- --outDir /tmp/push-performance-audit-dist`
  - `npm run dev -- --host 127.0.0.1 --port 4173`
  - Route sweep via browser console on `/`, `/workbench`, `/event-analysis`, `/timeline`
  - Targeted symbol scans with `rg -n` for solver/mapping/manual/ignored/undo/load/export paths

## Critical

| Symptom | Where to look | Likely cause | Repro hint | Suggested fix strategy | Acceptance criteria / test idea |
|---|---|---|---|---|---|
| Displayed analysis becomes stale after solver run + further edits | `src/context/ProjectContext.tsx:activeResult`; `src/workbench/Workbench.tsx:Reactive Solver Loop` | Dual source of truth: `engineResult` prefers `solverResults[activeSolverId]`, while reactive loop writes `legacyEngineResult` | Load a song, run Beam once, then move pads; compare visible analysis with expected reactive changes | Unify on one result model (`solverResults + activeSolverId`), deprecate legacy result writes | Integration test: after solver run, a mapping edit changes displayed analysis without rerunning manual solver |
| Manual assignment edits can target wrong event row | `src/workbench/EventLogTable.tsx` sorted render + index callback; `src/workbench/Workbench.tsx:handleAssignmentChange` | Table sorts by cost but callback passes sorted array index, not stable `eventIndex` | Open Event Analysis, edit assignment on top row in sorted table, verify different event changed | Use stable event ID/index from debug event payload; never use display index as identity | Test: editing row for event X updates only assignment key for event X |
| Undo/redo stack polluted by derived recompute writes | `src/workbench/Workbench.tsx` reactive `setProjectState` scoreCache update; `src/hooks/useProjectHistory.ts` | Reactive solver writes tracked as user edits | With loaded performance, drag several pads; undo requires many extra steps unrelated to user intent | Move score cache out of history, or write with `skipHistory`, or compute on read | Test: one drag action equals one undo step |

## High

| Symptom | Where to look | Likely cause | Repro hint | Suggested fix strategy | Acceptance criteria / test idea |
|---|---|---|---|---|---|
| Build cannot pass strict TS | `src/workbench/LayoutDesigner.tsx`, `src/workbench/VoiceLibrary.tsx`, `src/workbench/Workbench.tsx`, `src/pages/Dashboard.tsx` | Partially removed/legacy symbols still referenced; unused strict failures | Run `npm run build -- --outDir /tmp/push-performance-audit-dist` | Resolve broken references + remove stale symbols; enforce CI typecheck | Build succeeds in strict mode with zero TS diagnostics |
| Mapping selection inconsistent across pages | `src/workbench/Workbench.tsx:activeMappingId`; `src/pages/TimelinePage.tsx`; `src/pages/EventAnalysisPage.tsx` | Workbench uses local `activeMappingId`; other pages assume first mapping | Create multiple mappings and switch in Workbench, then open Timeline/EventAnalysis | Move active mapping into shared state or URL param | E2E: selected mapping remains consistent across route changes |
| Manual overrides can drift when ignored notes change | `src/utils/performanceSelectors.ts:getActivePerformance`; manual assignment storage keyed by event index | Event index identity is not stable under filtering | Toggle note visibility and inspect manual assignment effects | Store assignments by stable event key (timestamp+note+ordinal or explicit id) | Test: ignore/unignore does not remap existing manual overrides |
| Reactive solver recomputation frequency too high | `src/workbench/Workbench.tsx` effect deps include full `projectState` | Effect reruns from broad dependency and internal state writes | Load performance and monitor console + CPU while editing mapping | Narrow dependencies/selectors; avoid writing derived state in same loop | Perf test: editing a single pad triggers bounded recompute count |
| JSON load can accept invalid/unsafe shapes | `src/workbench/Workbench.tsx:handleLoadProject`; `src/utils/projectPersistence.ts:loadProject` | Minimal validation and weak defaults | Load malformed JSON with missing `instrumentConfig` internals | Introduce schema validation and migration layer | Test malformed files: fail with clear message, no partial corrupt state |

## Medium

| Symptom | Where to look | Likely cause | Repro hint | Suggested fix strategy | Acceptance criteria / test idea |
|---|---|---|---|---|---|
| Timeline finger labels may misalign after filtering | `src/pages/TimelinePage.tsx:fingerAssignments` | Assumes debug event index aligns with raw performance event index | Hide notes (`ignoredNoteNumbers`) and compare labels against expected notes | Derive labels from stable event mapping rather than direct index | Test with ignored notes: label assignment remains correct |
| Duplicate hydration logic may produce route-specific behavior drift | `Workbench`, `TimelinePage`, `EventAnalysisPage` load effects | Similar but non-identical load heuristics | Refresh each route with/without existing context state | Centralize hydration service/hook | Same song state loaded consistently regardless of entry route |
| Keyboard undo/redo may trigger during text editing | `src/workbench/Workbench.tsx` global key listener | No guard for focused input/textarea/contenteditable | Edit text field and press Cmd/Ctrl+Z | Add focus target guard before intercept | Test: text input undo works locally, app undo not triggered |
| MIDI key detection is heuristic and inaccurate for many files | `src/services/SongService.ts:importSongFromMidi` and `linkMidiToSong` | Key inferred from `minNoteNumber % 12` only | Import a non-major or modal file; observed key metadata often wrong | Replace with optional/more robust key detection or mark unknown | Key metadata either accurate or explicitly marked heuristic/unknown |
| Imported note range handling is opaque to user | `src/utils/midiImport.ts:parseMidiProject` | Bottom-left note auto-set to min note; unmapped-note count computed but no surfaced UX | Import files with note span >64 pads | Surface note-range warning in UI, include unmapped count in import summary | User sees explicit import summary with note-range info |

## Low

| Symptom | Where to look | Likely cause | Repro hint | Suggested fix strategy | Acceptance criteria / test idea |
|---|---|---|---|---|---|
| Missing favicon 404 in browser console | App root static assets | No favicon provided | Open `/` in browser; see 404 `favicon.ico` | Add favicon asset or remove request path | No favicon 404 in console |
| Console log noise in normal workflows | `src/workbench/Workbench.tsx`, `src/utils/midiImport.ts`, `src/workbench/SoundAssignmentTable.tsx`, `src/utils/performanceSelectors.ts` | Development diagnostics left in app paths | Open Workbench with/without song and inspect console | Gate debug logs by environment/debug flag | Console remains actionable (warnings/errors only) |
| Static “Last Sync: 2 minutes ago” misleading text | `src/pages/Dashboard.tsx` footer | Placeholder text not state-driven | Open dashboard over time; value never changes | Make dynamic or remove | Footer reflects real sync state or is removed |

## Focus-area coverage checklist

- MIDI import parsing inconsistencies: covered (key inference, note-range surfacing).
- Mapping creation/edit flows: covered (cross-page mapping selection, reactive recompute side effects).
- Engine recompute loop and performance: covered (dependency breadth, derived writes).
- Ignored notes/manual overrides interactions: covered (index drift).
- Undo/redo correctness: covered (history pollution, keyboard interception).
- Project save/load correctness: covered (weak schema validation).
- Runtime null/undefined risks: covered via build breakpoints and unresolved symbol references.

