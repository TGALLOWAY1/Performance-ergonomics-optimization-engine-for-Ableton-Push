# 03 - Partial Implementations and Dead Paths

- Audit timestamp: 2026-03-02T22:03:02-0500
- Repo branch: codex/audit/deep-codebase-review
- Audit scope: Features that are UI-exposed but incomplete, dead/unreachable code paths, unused exports/services, and compile-breaking partial integrations.
- Commands run:
  - `rg -n --glob '!node_modules/**' --glob '!dist/**' "TODO|FIXME|deprecated|legacy|mock|seed|export|import|undo|redo|manual|ignored|solver|engineResult|mapping|layout" src docs README.md TODO.md`
  - `rg -n "\bAnalysisView\b|\bImportWizard\b|\bTimelineArea\b|\bEngineResultsPanel\b|\bGridArea\b|\bLayoutList\b|\bSectionMapList\b|\bSidebar\b|\bGridEditor\b" src`
  - `rg -n "importSongFromMidi\(|getMidiArrayBuffer\(|seedMockData\(|saveProject\(|loadProject\(|exportLayout\(|importLayout\(" src`
  - `npm run build -- --outDir /tmp/push-performance-audit-dist`

## Partially implemented feature table

| Feature / UI element | Expected behavior | Actual implementation status | Evidence of partial implementation | Proposed completion steps | Acceptance criteria |
|---|---|---|---|---|---|
| Dashboard `Practice` button on song card | Launch practice flow (likely timeline or guided loop) | No handler wired | `src/components/dashboard/SongCard.tsx` green `Practice` button lacks `onClick` | Wire action to a route/workflow (`/timeline?songId=` or dedicated mode), define analytics/state side effects | Clicking `Practice` always enters a deterministic practice flow for selected song |
| Timeline `Practice Mode` toggle | Toggle behavior that changes playback or annotations | Purely decorative control | `src/pages/TimelinePage.tsx` toggle button has no state/update callback | Add `practiceMode` local state and apply mode effects (visual + behavior) | Toggle changes state and produces observable timeline behavior change |
| Timeline `Scroll Speed` selector | Affect playback scroll progression | Selector value unused in timing loop | `src/pages/TimelinePage.tsx` select has no downstream usage in `animate` | Feed selector into playback delta multiplier | Speed setting changes scroll/play progression predictably |
| Workbench `Save Layout Version` | Persist versioning snapshot from UI | Handler exists but unreachable from UI | `src/workbench/Workbench.tsx:handleSaveLayoutVersion`, commented prop in `LayoutDesigner` call site | Reintroduce a visible control or remove dead handler until spec is finalized | User can trigger layout version save and observe version metadata update |
| Workbench unified MIDI import (`handleProjectLoad`) | Reusable import path for file/url loading | Function is not called in active route flow | `src/workbench/Workbench.tsx:handleProjectLoad` only referenced by commented default-load effect | Either wire it to explicit import UX or delete/rehome into tested utility | Import path is reachable from UI and covered by a reproducible flow |
| Settings menu `Suggest Ergonomic Layout (Soon)` | Usable ergonomic suggestion flow | Disabled placeholder | `src/workbench/Workbench.tsx` disabled button labeled `Soon` | Remove from production UI or replace with actionable flow | No dead CTA in settings menu |
| Theme behavior persistence | Preserve user preference across sessions | Theme resets to dark on reload | `src/context/ThemeContext.tsx` state-only toggle with no storage read/write | Add localStorage/system preference sync | Refresh preserves last selected theme |
| Event log reassignment controls | Edit assignment of the exact displayed event row | Index mapping is unstable due sorting | `src/workbench/EventLogTable.tsx` sorts events then calls `onAssignmentChange(index, ...)` | Use stable key (`event.eventIndex`) in callbacks and storage keys | Editing row N changes only that exact event across refresh/recompute |

## Compile-breaking partial integrations (current build blockers)

| Severity | Reference | Observed | Why this is partial |
|---|---|---|---|
| High | `src/workbench/LayoutDesigner.tsx:onRequestMapToQuadrants` | Symbol referenced but not declared in props destructure/types path used by build | Feature scaffold commented out but runtime path still references it |
| Medium | `src/workbench/LayoutDesigner.tsx:handleClearGrid` | Declared but never read (`TS6133`) | Legacy action retained while action bar moved to Workbench header |
| Medium | `src/workbench/VoiceLibrary.tsx:instrumentConfig` and `handleAutoAssignRandom` props | Declared but unused (`TS6133`) | Component API includes stale props after refactor |
| Low | `src/workbench/Workbench.tsx:handleSaveLayoutVersion` | Declared but unused (`TS6133`) | Versioning feature present in code but not in active UI |
| Low | `src/pages/Dashboard.tsx:handleDeleteSong(title)` | Unused parameter (`TS6133`) | UX confirmation path removed but argument retained |

## Dead paths and zombie code

| Artifact | Reachability status | Evidence |
|---|---|---|
| `AnalysisView` stack (AnalysisView, Sidebar, GridArea, GridEditor, EngineResultsPanel, LayoutList, SectionMapList, TimelineArea) | Not reachable from router | `src/main.tsx` routes only include Dashboard/Workbench/Timeline/EventAnalysis/CostDebug; `rg` shows these components imported primarily inside `AnalysisView` chain |
| `ImportWizard` | Not reachable from routed UI | `src/workbench/ImportWizard.tsx` exists, no import from active pages/workbench |
| `projectPersistence` layout import/export helpers | Effectively dead in current app flow | `src/utils/projectPersistence.ts:exportLayout/importLayout` only used by `src/workbench/AnalysisView.tsx` dead path |
| Legacy MIDI parser wrappers (`parseMidiFile`, `fetchAndParseMidiFile`) | Tied to dead flow | `src/utils/midiImport.ts` wrappers referenced by `AnalysisView` only |
| `SongService.importSongFromMidi` | Unused by Dashboard flow | Dashboard uses `createSong + linkMidiToSong`; no call sites for `importSongFromMidi` |
| `SongService.getMidiArrayBuffer` | Unused | No call sites in `src` except declaration |
| `SongService.seedMockData` | No-op and not invoked | Method intentionally empty, call commented in Dashboard |

## Unused/legacy exports and helpers (observed)

| Reference | Observed | Impact |
|---|---|---|
| `src/utils/projectPersistence.ts:saveProject/loadProject` | Active Workbench uses separate inline save/load logic | Duplicate persistence code path increases drift risk |
| `src/utils/formatUtils.ts` | Utility consumed by `EngineResultsPanel`, but that panel is on dead `AnalysisView` path | Utility appears active but is indirectly dead with unreachable UI |
| `src/workbench/Workbench.tsx:handleProjectLoad` | Large import orchestration function not wired | High maintenance cost with no runtime value |

## Placeholder and product-direction contradictions

| Reference | Observation | Why it conflicts |
|---|---|---|
| `src/pages/Dashboard.tsx` footer text `Last Sync: 2 minutes ago` | Static, not data-driven | Suggests real sync state that does not exist |
| `src/workbench/Workbench.tsx` + broad debug logging | Heavy debug/diagnostic logs in user flow | Production UX and console signal quality degrade |
| `src/workbench/Workbench.tsx` + `src/workbench/LayoutDesigner.tsx` | Duplicated auto-layout/randomize/clear logic split across components | Contradicts single orchestrator intent and increases inconsistency risk |

## Completion gates for this category

- Remove or wire every dead CTA shown to users.
- Resolve current TypeScript compile blockers.
- Delete or quarantine unreachable feature stacks into archived/internal modules.
- Eliminate duplicated persistence/import paths where one path is non-routed.

