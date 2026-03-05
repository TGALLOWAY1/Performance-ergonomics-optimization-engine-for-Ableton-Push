/**
 * Fixture loader utilities for tests.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { Performance } from '../../../types/performance';
import { GridMapping } from '../../../types/layout';
import { ResultBands } from './testHelpers';

const FIXTURES_DIR = join(__dirname, '..', 'fixtures');

/**
 * Loads a Performance fixture from JSON.
 */
export function loadPerformanceFixture(fixtureId: string): Performance {
  const filePath = join(FIXTURES_DIR, 'performances', `${fixtureId}.json`);
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as Performance;
}

/**
 * Loads a GridMapping fixture from JSON.
 * Returns null for L01 (standard chromatic uses null mapping).
 */
export function loadMappingFixture(mappingId: string): GridMapping | null {
  if (mappingId === 'L01') {
    return null;
  }
  
  const filePath = join(FIXTURES_DIR, 'mappings', `${mappingId}.json`);
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as GridMapping;
}

/**
 * Loads threshold bands from bands.json.
 */
export function loadBands(): Record<string, ResultBands> {
  const filePath = join(FIXTURES_DIR, 'bands.json');
  const content = readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(content);
  
  const bands: Record<string, ResultBands> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!key.startsWith('_')) {
      bands[key] = value as ResultBands;
    }
  }
  
  return bands;
}

/**
 * Gets threshold bands for a specific fixture.
 */
export function getBands(fixtureId: string): ResultBands | undefined {
  const allBands = loadBands();
  return allBands[fixtureId];
}

/**
 * List of all performance fixture IDs.
 */
export const PERFORMANCE_FIXTURE_IDS = [
  'F01', 'F02', 'F03', 'F04', 'F05_slow', 'F05_fast',
  'F06', 'F07', 'F08', 'F09', 'F10', 'F11', 'F12',
  'I01', 'I02', 'I03', 'I04', 'I05',
] as const;

/**
 * List of all mapping fixture IDs.
 */
export const MAPPING_FIXTURE_IDS = [
  'L01', 'L02_rotated', 'L03_sparse', 'L04_clustered', 'L05_noncontiguous',
] as const;

export type PerformanceFixtureId = typeof PERFORMANCE_FIXTURE_IDS[number];
export type MappingFixtureId = typeof MAPPING_FIXTURE_IDS[number];
