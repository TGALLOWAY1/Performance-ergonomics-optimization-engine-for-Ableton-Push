/**
 * Rebaseline Bands Script
 * 
 * Runs the solver on all fixtures and updates bands.json with current values.
 * Use this when solver behavior intentionally changes.
 * 
 * Run with: npx tsx scripts/rebaseline_bands.ts
 * 
 * After running, review the diff and commit with a clear message like:
 * "chore: rebaseline solver bands after cost weight change"
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { BiomechanicalSolver } from '../src/engine/core';
import { InstrumentConfig } from '../src/types/performance';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_DIR = join(__dirname, '..', 'src', 'engine', '__tests__', 'fixtures');
const PERFORMANCES_DIR = join(FIXTURES_DIR, 'performances');
const BANDS_FILE = join(FIXTURES_DIR, 'bands.json');

const DEFAULT_CONFIG: InstrumentConfig = {
  id: 'default',
  name: 'Standard 8x8',
  rows: 8,
  cols: 8,
  bottomLeftNote: 36,
  layoutMode: 'drum_64',
};

interface Performance {
  name: string;
  tempo: number;
  events: Array<{
    noteNumber: number;
    startTime: number;
    duration: number;
    velocity: number;
    eventKey: string;
  }>;
}

interface ResultBands {
  feasible?: boolean;
  unplayableCount?: number;
  hardCountMax?: number;
  crossoverRateMax?: number;
  movementCostMax?: number;
  scoreMin?: number;
  metricProfile?: {
    movementShareMin?: number;
    movementShareMax?: number;
    fatigueShareMin?: number;
    fatigueShareMax?: number;
    crossoverShareMin?: number;
    crossoverShareMax?: number;
    stretchShareMin?: number;
    stretchShareMax?: number;
    bounceShareMin?: number;
    bounceShareMax?: number;
    driftShareMin?: number;
    driftShareMax?: number;
  };
}

function main(): void {
  console.log('Rebaselining solver bands...\n');
  
  const files = readdirSync(PERFORMANCES_DIR).filter(f => f.endsWith('.json'));
  const bands: Record<string, ResultBands> = {
    _comment: 'Threshold bands for solver fixture tests. Update via scripts/rebaseline_bands.ts' as unknown as ResultBands,
    _version: '1.0.0' as unknown as ResultBands,
  };
  
  const solver = new BiomechanicalSolver(DEFAULT_CONFIG, null);
  
  for (const file of files) {
    const fixtureId = file.replace('.json', '');
    const content = readFileSync(join(PERFORMANCES_DIR, file), 'utf-8');
    const performance = JSON.parse(content) as Performance;
    
    console.log(`Processing ${fixtureId}...`);
    
    try {
      const result = solver.solve(performance);
      
      const newBands: ResultBands = {
        feasible: result.unplayableCount === 0,
        unplayableCount: result.unplayableCount,
      };
      
      if (result.hardCount > 0) {
        newBands.hardCountMax = Math.ceil(result.hardCount * 1.2);
      }
      
      if (result.averageMetrics.crossover > 0) {
        newBands.crossoverRateMax = Math.ceil(result.averageMetrics.crossover * 1.2 * 100) / 100;
      }
      
      if (result.averageMetrics.movement > 0) {
        newBands.movementCostMax = Math.ceil(result.averageMetrics.movement * 1.2);
      }
      
      if (result.score > 0) {
        newBands.scoreMin = Math.floor(result.score * 0.9);
      }
      
      if (fixtureId === 'I05' && result.averageMetrics.total > 0) {
        const total = result.averageMetrics.total;
        const movementShare = (result.averageMetrics.movement / total) * 100;
        const fatigueShare = (result.averageMetrics.fatigue / total) * 100;
        const crossoverShare = (result.averageMetrics.crossover / total) * 100;
        const stretchShare = (result.averageMetrics.stretch / total) * 100;
        const bounceShare = (result.averageMetrics.bounce / total) * 100;
        const driftShare = (result.averageMetrics.drift / total) * 100;
        
        newBands.metricProfile = {
          movementShareMin: Math.floor(movementShare * 0.5),
          movementShareMax: Math.ceil(movementShare * 1.5),
          fatigueShareMin: Math.floor(fatigueShare * 0.5),
          fatigueShareMax: Math.ceil(fatigueShare * 1.5),
          crossoverShareMin: Math.floor(crossoverShare * 0.5),
          crossoverShareMax: Math.ceil(crossoverShare * 1.5),
          stretchShareMin: Math.floor(stretchShare * 0.5),
          stretchShareMax: Math.ceil(stretchShare * 1.5),
          bounceShareMin: Math.floor(bounceShare * 0.5),
          bounceShareMax: Math.ceil(bounceShare * 1.5),
          driftShareMin: Math.floor(driftShare * 0.5),
          driftShareMax: Math.ceil(driftShare * 1.5),
        };
        
        console.log(`  Metric profile captured for I05:`);
        console.log(`    Movement: ${movementShare.toFixed(1)}%`);
        console.log(`    Fatigue: ${fatigueShare.toFixed(1)}%`);
        console.log(`    Crossover: ${crossoverShare.toFixed(1)}%`);
      }
      
      bands[fixtureId] = newBands;
      
      console.log(`  Score: ${result.score}, Unplayable: ${result.unplayableCount}, Hard: ${result.hardCount}`);
    } catch (error) {
      console.error(`  Error processing ${fixtureId}:`, error);
      bands[fixtureId] = { feasible: false };
    }
  }
  
  writeFileSync(BANDS_FILE, JSON.stringify(bands, null, 2));
  console.log(`\nWrote updated bands to ${BANDS_FILE}`);
  console.log('\nReview the changes and commit if they look correct.');
}

main();
