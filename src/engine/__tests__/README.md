# Solver Test Suite

This directory contains the comprehensive test suite for the BiomechanicalSolver.

## Quick Reference

| Path | Purpose |
|------|---------|
| `fixtures/performances/` | Performance JSON fixtures (F01-F12, I01-I05) |
| `fixtures/mappings/` | Grid mapping fixtures (L01-L05) |
| `fixtures/projects/` | ProjectState JSON fixtures (exported from UI) |
| `fixtures/bands.json` | Threshold bands for regression detection |
| `helpers/` | Test utilities, matchers, fixture loaders |
| `helpers/semantics.ts` | **Behavioral contract documentation** |

## Creating New Fixtures

### Method 1: Generate via Script (Recommended for Reproducibility)

Edit `scripts/gen_performance_fixtures.ts` and add a new generator function:

```typescript
function generateMyFixture(): Performance {
  const bpm = 120;
  return {
    name: 'MyFixture',
    tempo: bpm,
    events: [
      { noteNumber: 36, startTime: 0, duration: beatsToSeconds(0.25, bpm), velocity: 100, eventKey: '0:0:36:1' },
      // ... more events
    ],
  };
}
```

Then run:
```bash
npx tsx scripts/gen_performance_fixtures.ts
```

### Method 2: Export from Timeline Editor (UI Integration Testing)

1. Open the app and create your pattern in the Timeline view
2. Use "Export Project" to save as JSON
3. Copy the file to `fixtures/projects/my_pattern.project.json`
4. Add a test in `solver.projectstate.test.ts`

This method is valuable for end-to-end UI → solver validation.

## Rebaselining Threshold Bands

When solver behavior **intentionally** changes (e.g., cost weight adjustments):

```bash
npx tsx scripts/rebaseline_bands.ts
```

This updates `fixtures/bands.json` with current solver outputs. **Always review the diff carefully before committing.**

Example commit message:
```
chore: rebaseline solver bands after crossover weight increase
```

## Policy Decisions (semantics.ts)

All behavioral contracts are documented in `helpers/semantics.ts`. Key decisions:

| Policy | Rule |
|--------|------|
| **Time Units** | Always seconds (tempo is informational only) |
| **Unmapped Notes** | Counted as Unplayable, increment `unplayableCount` |
| **Score Direction** | Lower = worse (100 = perfect) |
| **Chord Grouping** | Exact `startTime` equality (no tolerance window) |
| **Chord Fingers** | No finger reused within same-startTime group |
| **L01 Mapping** | Row-major from `bottomLeftNote` (frozen reference guards changes) |

If you change any of these policies, **update semantics.ts first**, then update tests.

## Test File Overview

| File | Coverage |
|------|----------|
| `solver.smoke.test.ts` | Hard invariants (no NaN, valid grid, determinism) |
| `solver.fixtures.test.ts` | F01-F12, I01-I05 fixtures with bands |
| `mapping.fixtures.test.ts` | L01-L05 layout variations |
| `solver.monotonicity.test.ts` | Cost function monotonicity |
| `solver.policy.test.ts` | Explicit policy tests + debug trace sanity |
| `solver.projectstate.test.ts` | End-to-end ProjectState → solver |
| `solver.l01freeze.test.ts` | Frozen L01 mapping regression guard |
| `solver.edgecases.test.ts` | Degenerate inputs (empty, zero, boundary) |
| `solver.performance.test.ts` | Runtime budget, O(n²) detection |
| `solver.timeunits.test.ts` | Time unit consistency |

## Running Tests

```bash
# All solver tests
npm run test:run -- --testNamePattern="Solver"

# Specific file
npm run test:run -- solver.policy.test.ts

# With coverage
npm run test:coverage

# CI mode (generous thresholds)
CI=true npm run test:run
```

## Adding a New Fixture

1. **Choose the right method:**
   - Script: for programmatic, reproducible patterns
   - UI Export: for realistic user-created patterns

2. **Add the fixture file**

3. **Add bands (if using regression testing):**
   - Run `npx tsx scripts/rebaseline_bands.ts`
   - Or manually add entry to `bands.json`

4. **Write the test:**
   ```typescript
   describe('MyNewFixture', () => {
     let result: EngineResult;
     beforeAll(() => {
       result = runSolver(loadPerformanceFixture('MyFixture'));
     });
     
     it('should be feasible', () => expect(result).toBeFeasible());
     it('should meet bands', () => expectResultInBands(result, bands['MyFixture']));
   });
   ```

5. **Verify:** `npm run test:run -- MyFixture`

## Troubleshooting

### "No valid expansions for group" warnings
This is normal for complex chord patterns. The solver falls back gracefully.

### Tests fail after solver changes
1. Determine if the change is intentional
2. If yes: run rebaseline script, review diff, commit
3. If no: revert the solver change

### Flaky performance tests
- Set `CI=true` for generous thresholds
- The O(n²) ratio test is the primary signal, not absolute times
