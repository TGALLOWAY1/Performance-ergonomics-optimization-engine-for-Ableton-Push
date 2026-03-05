/**
 * L01 Standard Mapping Freeze Tests
 * 
 * These tests ensure that the "default chromatic layout" (L01) remains stable.
 * If the derivation logic in GridMapService changes, these tests will catch it
 * as a breaking change rather than silently drifting all tests together.
 * 
 * The frozen reference is stored in fixtures/mappings/L01_standard_frozen.json
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GridMapService } from '../gridMapService';
import { DEFAULT_TEST_CONFIG, runSolver, createTestPerformance, expectWithinEpsilon } from './helpers/testHelpers';
import { InstrumentConfig } from '../../types/performance';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface FrozenL01Reference {
  id: string;
  name: string;
  bottomLeftNote: number;
  gridSize: { rows: number; cols: number };
  noteToPosition: Record<string, [number, number]>;
  unmappedBelow: number;
  unmappedAbove: number;
}

function loadFrozenL01(): FrozenL01Reference {
  const filePath = join(__dirname, 'fixtures', 'mappings', 'L01_standard_frozen.json');
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

describe('L01 Standard Mapping Freeze Tests', () => {
  let frozenRef: FrozenL01Reference;

  beforeAll(() => {
    frozenRef = loadFrozenL01();
  });

  describe('GridMapService.noteToGrid() matches frozen reference', () => {
    it('should match frozen reference for all 64 valid notes', () => {
      for (const [noteStr, expectedPos] of Object.entries(frozenRef.noteToPosition)) {
        const noteNumber = parseInt(noteStr, 10);
        const actualPos = GridMapService.noteToGrid(noteNumber, DEFAULT_TEST_CONFIG);
        
        expect(actualPos).not.toBeNull();
        expect(actualPos![0]).toBe(expectedPos[0]);
        expect(actualPos![1]).toBe(expectedPos[1]);
      }
    });

    it('should return null for notes below bottomLeftNote', () => {
      const belowNote = frozenRef.unmappedBelow;
      const result = GridMapService.noteToGrid(belowNote, DEFAULT_TEST_CONFIG);
      expect(result).toBeNull();
    });

    it('should return null for notes above the 64-pad window', () => {
      const aboveNote = frozenRef.unmappedAbove;
      const result = GridMapService.noteToGrid(aboveNote, DEFAULT_TEST_CONFIG);
      expect(result).toBeNull();
    });
  });

  describe('Frozen reference consistency', () => {
    it('should use bottomLeftNote 36 as reference', () => {
      expect(frozenRef.bottomLeftNote).toBe(DEFAULT_TEST_CONFIG.bottomLeftNote);
    });

    it('should have 64 mapped notes (8x8 grid)', () => {
      const mappedCount = Object.keys(frozenRef.noteToPosition).length;
      expect(mappedCount).toBe(64);
    });

    it('should have continuous note range from 36 to 99', () => {
      const notes = Object.keys(frozenRef.noteToPosition).map(n => parseInt(n, 10)).sort((a, b) => a - b);
      expect(notes[0]).toBe(36);
      expect(notes[notes.length - 1]).toBe(99);
      
      for (let i = 1; i < notes.length; i++) {
        expect(notes[i]).toBe(notes[i - 1] + 1);
      }
    });
  });

  describe('Solver results consistency with frozen vs derived mapping', () => {
    it('should produce identical results for null mapping (derived) on standard config', () => {
      const testNotes = [36, 40, 44, 48, 52, 56, 60, 64];
      const performance = createTestPerformance(
        testNotes.map((n, i) => ({ noteNumber: n, startTime: i * 0.5 }))
      );
      
      const result1 = runSolver(performance, DEFAULT_TEST_CONFIG, null);
      const result2 = runSolver(performance, DEFAULT_TEST_CONFIG, null);
      
      expect(result1.score).toBe(result2.score);
      expect(result1.unplayableCount).toBe(result2.unplayableCount);
      
      for (let i = 0; i < result1.debugEvents.length; i++) {
        expect(result1.debugEvents[i].row).toBe(result2.debugEvents[i].row);
        expect(result1.debugEvents[i].col).toBe(result2.debugEvents[i].col);
      }
    });

    it('should map corner notes to expected positions', () => {
      const cornerCases = [
        { note: 36, expectedRow: 0, expectedCol: 0 },
        { note: 43, expectedRow: 0, expectedCol: 7 },
        { note: 92, expectedRow: 7, expectedCol: 0 },
        { note: 99, expectedRow: 7, expectedCol: 7 },
      ];
      
      for (const { note, expectedRow, expectedCol } of cornerCases) {
        const pos = GridMapService.noteToGrid(note, DEFAULT_TEST_CONFIG);
        expect(pos).not.toBeNull();
        expect(pos![0]).toBe(expectedRow);
        expect(pos![1]).toBe(expectedCol);
      }
    });
  });

  describe('Different bottomLeftNote configurations', () => {
    it('should correctly offset positions for different bottomLeftNote', () => {
      const altConfig: InstrumentConfig = {
        ...DEFAULT_TEST_CONFIG,
        id: 'alt-config',
        name: 'Alt Config',
        bottomLeftNote: 48,
      };
      
      const posFor48 = GridMapService.noteToGrid(48, altConfig);
      expect(posFor48).toEqual([0, 0]);
      
      const posFor47 = GridMapService.noteToGrid(47, altConfig);
      expect(posFor47).toBeNull();
      
      const posFor112 = GridMapService.noteToGrid(48 + 64, altConfig);
      expect(posFor112).toBeNull();
    });
  });

  describe('Regression detection', () => {
    it('GUARD: derived mapping must match frozen reference exactly', () => {
      let mismatches = 0;
      
      for (const [noteStr, expectedPos] of Object.entries(frozenRef.noteToPosition)) {
        const noteNumber = parseInt(noteStr, 10);
        const actualPos = GridMapService.noteToGrid(noteNumber, DEFAULT_TEST_CONFIG);
        
        if (!actualPos || actualPos[0] !== expectedPos[0] || actualPos[1] !== expectedPos[1]) {
          mismatches++;
        }
      }
      
      expect(mismatches).toBe(0);
    });

    it('INFO: current derivation uses row-major formula (informational, not enforced)', () => {
      let matchesRowMajor = true;
      
      for (let note = 36; note < 100; note++) {
        const offset = note - 36;
        const expectedRow = Math.floor(offset / 8);
        const expectedCol = offset % 8;
        
        const actualPos = GridMapService.noteToGrid(note, DEFAULT_TEST_CONFIG);
        
        if (!actualPos || actualPos[0] !== expectedRow || actualPos[1] !== expectedCol) {
          matchesRowMajor = false;
          break;
        }
      }
      
      console.log(`Current derivation uses row-major formula: ${matchesRowMajor}`);
      console.log('Note: The frozen reference is the authoritative source, not this formula.');
    });
  });
});
