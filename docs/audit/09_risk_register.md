# 09 - Risk Register

- Audit timestamp: 2026-03-02T22:03:02-0500
- Repo branch: codex/audit/deep-codebase-review
- Audit scope: Consolidated risks across correctness, UX, performance, and maintainability with mitigation direction.
- Commands run:
  - `npm run build -- --outDir /tmp/push-performance-audit-dist`
  - Runtime diagnostics via local route sweep
  - Targeted state/solver/mapping symbol audits using `rg -n`

## Risk scoring scale

- Severity: Critical / High / Medium / Low
- Likelihood: High / Medium / Low

## Correctness risks

| Risk | Severity | Likelihood | Impact | Mitigation plan | Owner / follow-up |
|---|---|---|---|---|---|
| Dual engine-result model causes stale analysis | Critical | High | Users make decisions on outdated metrics | Canonicalize result source in context; remove legacy result path | Core state/engine owner |
| Event assignment identity tied to unstable row index | Critical | High | Manual overrides mutate wrong events | Introduce stable event ID and update callbacks/storage keys | Analysis workflow owner |
| Mapping selection not shared across routes | High | High | Timeline/EventAnalysis can evaluate wrong mapping | Persist active mapping identity globally or in route | Navigation/state owner |
| JSON load accepts invalid shapes | High | Medium | Runtime failures and corrupted state | Schema validation + migration defaults | Persistence owner |
| Manual overrides drift with ignored-note filtering | High | Medium | Hidden correctness defects in solver constraints | Stable event identity independent of filtered index | Engine + UI integration owner |

## UX risks

| Risk | Severity | Likelihood | Impact | Mitigation plan | Owner / follow-up |
|---|---|---|---|---|---|
| Non-functional visible controls reduce trust | Medium | High | Users click dead actions and lose confidence | Remove/disable/hide until fully wired; add explicit roadmap labels outside CTA surfaces | UX/workbench owner |
| Persistence model unclear (autosave vs export) | Medium | Medium | User confusion and accidental data loss assumptions | Add persistent explanatory affordance near save/load controls | UX + persistence owner |
| Terminology inconsistency (voice/sound/layout/mapping) | Medium | Medium | Slower onboarding and interpretation errors | Standardize labels and glossary hints in UI | Product/UX owner |
| Static fake status text (“Last Sync”) | Low | High | Misleading system state perception | Replace with real status or remove | Dashboard owner |

## Performance risks

| Risk | Severity | Likelihood | Impact | Mitigation plan | Owner / follow-up |
|---|---|---|---|---|---|
| Over-broad reactive solve triggers | High | High | CPU spikes and degraded editing responsiveness | Narrow effect dependencies, add cheap change guards | Workbench performance owner |
| Derived score writes trigger history/autosave churn | High | High | Write amplification, slow undo, noisy persistence | Treat score as derived/non-history state | State management owner |
| Timeline per-event lane lookup scales poorly | Medium | Medium | Degraded timeline rendering on larger files | Precompute note->lane index map | Timeline owner |
| Debug logging in hot paths | Low | High | Runtime overhead + noisy diagnostics | Gate logs behind debug flag | Platform owner |

## Maintainability risks

| Risk | Severity | Likelihood | Impact | Mitigation plan | Owner / follow-up |
|---|---|---|---|---|---|
| Large monolithic components hinder safe changes | High | High | High regression risk and slow iteration | Split Workbench/LayoutDesigner into domain hooks + presentational sections | Frontend architecture owner |
| Dead legacy stack remains in active tree | Medium | High | Cognitive overhead and accidental coupling | Remove or isolate in `legacy/` with explicit boundaries | Codebase stewardship owner |
| Duplicate orchestration and utility paths drift over time | Medium | High | Behavior divergence and bug reintroduction | Consolidate hydration/import/export/solver entry points | Architecture owner |
| Missing test/script integration despite test files | Medium | Medium | Low confidence in refactors | Add runnable test scripts and core regression suites | Dev tooling owner |

## Monitoring and rollback guidance

| Area | Early warning signal | Rollback strategy |
|---|---|---|
| Solver/result consistency | Analysis UI no longer updates after mapping edits | Re-enable previous solver path behind feature flag while fixing canonicalization |
| Assignment correctness | User reports wrong event edited from Event Log | Temporarily disable assignment editing in sorted view until stable IDs deployed |
| Hydration/persistence | Route refresh loads different states per page | Fallback to current Workbench hydration logic while shared hook stabilizes |
| Performance | High CPU while dragging/assigning | Increase debounce + disable reactive solve temporarily |

