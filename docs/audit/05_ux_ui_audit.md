# 05 - UX/UI Audit of Core Journeys

- Audit timestamp: 2026-03-02T22:03:02-0500
- Repo branch: codex/audit/deep-codebase-review
- Audit scope: Evidence-based UX/UI audit across key user journeys and panel-level clutter/noise mapping.
- Commands run:
  - `npm run dev -- --host 127.0.0.1 --port 4173`
  - Route sweep `/`, `/workbench`, `/event-analysis`, `/timeline`
  - Component/symbol inspection via `rg -n` and file review of Dashboard, SongCard, Workbench, LayoutDesigner, AnalysisPanel, TimelinePage, EventAnalysisPage

## Journey 1: Import/Link MIDI -> Song card -> Open Workbench

| Step | Component path | Friction / clunkiness | Evidence | Impact |
|---|---|---|---|---|
| Create a song | `Dashboard` -> `Add New Song` | User can create empty songs without guided next step, then hit no-data states later | `src/pages/Dashboard.tsx:handleAddSongClick` creates metadata-only song; no post-create onboarding | Extra clicks and confusion before first successful workflow |
| Link MIDI | `SongCard` label+hidden input | Link/Re-link works, but debug-heavy and low trust error UX (`alert`) | `src/components/dashboard/SongCard.tsx:handleLinkMidiFileChange`, `src/pages/Dashboard.tsx:handleMidiLinked` | Errors feel technical; no structured import summary |
| Read song status | Song card badges + footer | Signals are inconsistent; static footer “Last Sync: 2 minutes ago” implies backend sync that does not exist | `src/pages/Dashboard.tsx` static footer text | Misleading confidence and unclear persistence model |
| Open workbench | `SongCard` -> `/workbench?songId=` | Clear route transition, but no transitional confirmation of loaded mapping/layout identity | `src/components/dashboard/SongCard.tsx:handleWorkbenchClick`, `src/workbench/Workbench.tsx` | Users may not know which mapping/version got loaded |

### UX recommendations (journey 1)

- Add first-run path: after `Add New Song`, immediately prompt to link MIDI.
- Replace alert-based import failures with inline toast/panel and actionable errors.
- Remove or make real-time the sync footer indicator.
- Add “Loaded song + layout + mapping name/version” banner on Workbench entry.

## Journey 2: Assign voices to pads -> rerun analysis -> interpret results

| Step | Component path | Friction / clunkiness | Evidence | Impact |
|---|---|---|---|---|
| Understand where to start | Workbench empty state + VoiceLibrary tabs + grid | Many controls visible before prerequisites are satisfied; no explicit checklist (“1. Link MIDI, 2. Assign voices, 3. Run analysis”) | `src/workbench/Workbench.tsx`, `src/workbench/LayoutDesigner.tsx`, `src/workbench/VoiceLibrary.tsx` | Cognitive overhead for new users |
| Assign/edit mapping | DnD grid + context menus + library panes | Dense interaction surface; right-click finger lock, drag behavior, and hidden affordances are not discoverable | `src/workbench/LayoutDesigner.tsx` DnD + context menu + lock controls | Users can miss critical features (constraints, unassign behavior) |
| Trigger analysis | Workbench reactive solver + manual Run Analysis | Competing models (automatic and manual solver runs) are not explained in UI | `src/workbench/Workbench.tsx` reactive loop + `handleRunSolver` | Hard to know whether displayed score is “live” or solver snapshot |
| Interpret results | Analysis panel tabs and metrics | Three-tab analysis panel plus separate Event Analysis route duplicates mental model | `src/workbench/AnalysisPanel.tsx`, `src/pages/EventAnalysisPage.tsx` | Users must infer where canonical analysis lives |

### UX recommendations (journey 2)

- Add progressive “workflow rail” with current step and completion state.
- Add explicit “analysis source” indicator: `Live (reactive)` vs `Solver snapshot (beam/genetic/annealing)`.
- Consolidate analysis entry points by linking panel summaries directly to Event Analysis details.
- Add contextual helper text for right-click/finger-lock interactions.

## Journey 3: Iterate layouts and compare difficulty

| Step | Component path | Friction / clunkiness | Evidence | Impact |
|---|---|---|---|---|
| Create variants | Workbench settings + duplicate mapping (in dead/hidden areas) | Variant creation is fragmented; some controls in settings, some legacy handlers not wired | `src/workbench/Workbench.tsx` settings actions, unused `handleSaveLayoutVersion` | Variant lifecycle feels unreliable |
| Compare outputs | Solver dropdown + Analysis panel comparison tab | Comparison only meaningful if multiple solver results are current and tied to same mapping, but mapping identity is not explicit | `src/workbench/Workbench.tsx` result selector, `src/workbench/AnalysisPanel.tsx` comparison tab | Risk of false comparison across stale or mismatched mapping states |
| Track what changed | Layout mode badge only | Minimal diff affordance: no explicit “what changed since last version” | `src/workbench/LayoutDesigner.tsx` layout mode indicator | Iteration confidence is low, especially on larger maps |

### UX recommendations (journey 3)

- Introduce “current mapping identity” chip (mapping id/name/version) in header.
- Add lightweight diff summary after each layout mutation (moved pads count, changed constraints count).
- Disable comparison controls when result/mapping context is inconsistent.

## Journey 4: Save / load / export

| Step | Component path | Friction / clunkiness | Evidence | Impact |
|---|---|---|---|---|
| Understand persistence mode | Autosave + Save Project JSON + song-local storage | Multiple persistence modes are active simultaneously with little explanation | `src/workbench/Workbench.tsx` autosave effect + `handleSaveProject/handleLoadProject`; `src/services/SongService.ts` | Users may not know what is local auto-state vs exported artifact |
| Load project JSON | Header `Load` | Validation is shallow; user gets generic alert on parse/shape issues | `src/workbench/Workbench.tsx:handleLoadProject` | Recovery from bad file is poor |
| Export analysis/event data | Event Analysis export buttons | Exports are present but disconnected from main workbench save model | `src/workbench/EventAnalysisPanel.tsx` export handlers | Export taxonomy is unclear (project vs analysis artifacts) |

### UX recommendations (journey 4)

- Add persistence explainer in header tooltip: “Autosave to browser by songId; Save Project exports portable JSON.”
- Add structured load errors (schema errors by field).
- Group exports into one menu with categories: `Project`, `Layout`, `Event Metrics`.

## Clutter map (noise vs value)

| UI surface | Value today | Noise / clutter signal | Simplification recommendation |
|---|---|---|---|
| Workbench header controls (many links/buttons/selects) | High | High visual density and mixed action criticality | Prioritize primary actions; collapse secondary links under overflow/menu |
| Settings dropdown in Workbench | Medium | Includes disabled placeholder (`Soon`) and mixed-level actions | Remove dead CTA, split view toggles vs layout actions |
| Analysis panel tabs in Workbench | Medium | Overlaps with separate Event Analysis page | Keep summary in Workbench, move deep comparison/process to dedicated page link |
| VoiceLibrary tabbed panel | High | Useful but crowded with destructive actions in same list | Move destructive delete to explicit edit mode; keep visibility toggles inline |
| Dashboard card action row | Medium | Three equal buttons but only two are functional | Hide/disable `Practice` until wired, or implement handler |
| Console/diagnostic logging in user flows | Low | Significant noise in normal interactions | Gate logs by dev flag and suppress non-actionable warnings |

## Terminology clarity issues

| Term | Where seen | Clarity issue | Recommendation |
|---|---|---|---|
| Voice / Sound / Note / Cell / Pad | Dashboard, Workbench, types, comments | Mixed terms appear in UI and code comments; users may not map concepts cleanly | Standardize on UI glossary and surface a compact legend near grid |
| "Run Analysis" vs reactive loop | Workbench header and implicit effects | Button implies analysis is off until clicked, but loop may already run | Rename button to `Run Solver Snapshot` and label live analysis status |
| "Auto-Arrange" vs "Randomize" vs "Organize by 4x4 Banks" | Workbench controls | Overlapping intent not clearly differentiated | Add one-line sublabels for each action outcome |

