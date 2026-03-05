/**
 * Strict project file validation (validateProjectStrict + loadProject).
 * Dev repro: Load malformed JSON → inline error; load JSON missing instrumentConfig → rejected.
 */
import { describe, it, expect } from 'vitest';
import { validateProjectStrict } from '../projectPersistence';

describe('validateProjectStrict', () => {
  const minimalValid = {
    instrumentConfig: { id: 'c1', name: 'Test', rows: 8, cols: 8, bottomLeftNote: 36, layoutMode: 'drum_64' as const },
    layouts: [],
    mappings: [],
  };

  it('accepts valid minimal shape and returns state', () => {
    const result = validateProjectStrict(minimalValid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.instrumentConfig).toBeDefined();
      expect(result.state.layouts).toEqual([]);
      expect(result.state.mappings).toEqual([]);
    }
  });

  it('rejects when instrumentConfig is missing', () => {
    const result = validateProjectStrict({ layouts: [], mappings: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('MISSING_INSTRUMENT_CONFIG');
      expect(result.error.message).toContain('instrumentConfig');
    }
  });

  it('rejects when instrumentConfig is null', () => {
    const result = validateProjectStrict({ ...minimalValid, instrumentConfig: null });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('MISSING_INSTRUMENT_CONFIG');
  });

  it('rejects invalid root (non-object)', () => {
    const result = validateProjectStrict('not an object');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_ROOT');
  });

  it('rejects when layouts is not an array', () => {
    const result = validateProjectStrict({ ...minimalValid, layouts: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_LAYOUTS');
  });

  it('rejects when mappings is not an array', () => {
    const result = validateProjectStrict({ ...minimalValid, mappings: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_MAPPINGS');
  });
});
