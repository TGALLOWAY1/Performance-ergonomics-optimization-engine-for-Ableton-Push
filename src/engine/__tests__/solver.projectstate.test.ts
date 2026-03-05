/**
 * ProjectState JSON Fixture Tests (Option A)
 * 
 * Tests that load full ProjectState JSON files (as exported from Timeline/Grid Editor)
 * and run them through the solver. This provides end-to-end "UI export → test harness"
 * sanity checking.
 * 
 * These tests verify the complete pipeline: ProjectState → validateProjectState → solver
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { validateProjectState } from '@/utils/projectPersistence';
import { BiomechanicalSolver } from '@/engine/core';
import { Performance, InstrumentConfig } from '@/types/performance';
import { GridMapping } from '@/types/layout';
import { ProjectState } from '@/types/projectState';
import { EngineResult } from '@/engine/solvers/types';
import {
  assertPerformanceUnits,
  expectWithinEpsilon,
} from './helpers/testHelpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECTS_DIR = join(__dirname, 'fixtures', 'projects');

interface LoadedProject {
  state: ProjectState;
  performance: Performance;
  instrumentConfig: InstrumentConfig;
  mapping: GridMapping | null;
}

function loadProjectFixture(filename: string): LoadedProject {
  const filePath = join(PROJECTS_DIR, filename);
  const content = readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(content);
  const state = validateProjectState(parsed);
  
  const activeLayout = state.activeLayoutId
    ? state.layouts.find(l => l.id === state.activeLayoutId)
    : state.layouts[0];
  
  if (!activeLayout) {
    throw new Error(`No active layout found in project fixture: ${filename}`);
  }
  
  const mapping = state.activeMappingId
    ? state.mappings.find(m => m.id === state.activeMappingId) || null
    : null;
  
  return {
    state,
    performance: activeLayout.performance,
    instrumentConfig: state.instrumentConfig,
    mapping,
  };
}

function runProjectSolver(project: LoadedProject): EngineResult {
  const solver = new BiomechanicalSolver(project.instrumentConfig, project.mapping);
  return solver.solve(project.performance);
}

describe('ProjectState JSON Fixture Tests', () => {
  describe('Simple Monophonic Pattern', () => {
    let project: LoadedProject;
    let result: EngineResult;

    beforeAll(() => {
      project = loadProjectFixture('simple_monophonic.project.json');
      result = runProjectSolver(project);
    });

    it('should load ProjectState via validateProjectState()', () => {
      expect(project.state).toBeDefined();
      expect(project.state.layouts.length).toBeGreaterThan(0);
      expect(project.state.instrumentConfig).toBeDefined();
    });

    it('should extract performance from layout', () => {
      expect(project.performance).toBeDefined();
      expect(project.performance.events.length).toBe(8);
    });

    it('should have valid time units in performance', () => {
      expect(() => assertPerformanceUnits(project.performance)).not.toThrow();
    });

    it('should solve successfully without crashes', () => {
      expect(result).toBeDefined();
      expect(result.debugEvents.length).toBe(8);
    });

    it('should be feasible (all notes on-grid)', () => {
      expect(result).toBeFeasible();
    });

    it('should have no NaN values', () => {
      expect(result).toHaveNoNaNs();
    });

    it('should have valid grid positions', () => {
      expect(result).toHaveValidGridPositions();
    });

    it('should maintain event ordering', () => {
      for (let i = 1; i < result.debugEvents.length; i++) {
        expect(result.debugEvents[i].startTime).toBeGreaterThanOrEqual(
          result.debugEvents[i - 1].startTime
        );
      }
    });
  });

  describe('Chord Heavy Pattern', () => {
    let project: LoadedProject;
    let result: EngineResult;

    beforeAll(() => {
      project = loadProjectFixture('chord_heavy.project.json');
      result = runProjectSolver(project);
    });

    it('should load ProjectState with chord events', () => {
      expect(project.state).toBeDefined();
      expect(project.performance.events.length).toBe(13);
    });

    it('should identify chords (same-startTime events)', () => {
      const chord1Events = project.performance.events.filter(e => e.startTime === 0.0);
      expect(chord1Events.length).toBe(3);
      
      const chord4Events = project.performance.events.filter(e => e.startTime === 1.8);
      expect(chord4Events.length).toBe(4);
    });

    it('should solve successfully', () => {
      expect(result).toBeDefined();
      expect(result.debugEvents.length).toBe(13);
    });

    it('should be feasible', () => {
      expect(result).toBeFeasible();
    });

    it('should handle chords with unique finger assignments', () => {
      const chord1DebugEvents = result.debugEvents.filter(
        e => e.startTime === 0.0 && e.assignedHand !== 'Unplayable'
      );
      
      const usedFingers = new Set(
        chord1DebugEvents.map(e => `${e.assignedHand}-${e.finger}`)
      );
      expect(usedFingers.size).toBe(chord1DebugEvents.length);
    });

    it('should have valid mapping integrity', () => {
      expect(result).toHaveValidMappingIntegrity();
    });
  });

  describe('ProjectState Validation', () => {
    it('should handle missing fields gracefully', () => {
      const minimalProject = {
        layouts: [{
          id: 'test',
          name: 'Test',
          performance: {
            name: 'Test',
            tempo: 120,
            events: [{ noteNumber: 36, startTime: 0, duration: 0.5, velocity: 100 }],
          },
          createdAt: new Date().toISOString(),
        }],
      };
      
      const validated = validateProjectState(minimalProject);
      
      expect(validated.layouts).toHaveLength(1);
      expect(validated.projectTempo).toBe(120);
      expect(validated.mappings).toEqual([]);
      expect(validated.ignoredNoteNumbers).toEqual([]);
    });

    it('should extract correct instrumentConfig', () => {
      const project = loadProjectFixture('simple_monophonic.project.json');
      
      expect(project.instrumentConfig.rows).toBe(8);
      expect(project.instrumentConfig.cols).toBe(8);
      expect(project.instrumentConfig.bottomLeftNote).toBe(36);
    });
  });

  describe('End-to-End Pipeline Consistency', () => {
    it('should produce deterministic results for same ProjectState', () => {
      const project1 = loadProjectFixture('simple_monophonic.project.json');
      const project2 = loadProjectFixture('simple_monophonic.project.json');
      
      const result1 = runProjectSolver(project1);
      const result2 = runProjectSolver(project2);
      
      expect(result1.score).toBe(result2.score);
      expect(result1.unplayableCount).toBe(result2.unplayableCount);
      expect(result1.hardCount).toBe(result2.hardCount);
      expectWithinEpsilon(
        result1.averageMetrics.total,
        result2.averageMetrics.total,
        0.001
      );
    });

    it('should use null mapping when activeMappingId is null', () => {
      const project = loadProjectFixture('simple_monophonic.project.json');
      
      expect(project.state.activeMappingId).toBeNull();
      expect(project.mapping).toBeNull();
    });
  });
});
