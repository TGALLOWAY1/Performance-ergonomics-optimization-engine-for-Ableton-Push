import { BiomechanicalSolver } from './core';
import { GridMapService } from './gridMapService';
import { EngineResult, SolverType } from './solvers/types';
import { GridMapping } from '../types/layout';
import { InstrumentConfig, Performance } from '../types/performance';

export type RudimentToken = 'R' | 'L' | 'RR' | 'LL' | 'RL' | 'LR' | '-';

export interface RudimentDefinition {
  id: string;
  name: string;
  description: string;
  sticking: RudimentToken[];
}

export interface RudimentGenerationOptions {
  bpm: number;
  subdivision: 4 | 8 | 16;
  noteNumber?: number;
  bars?: number;
  solverType?: SolverType;
}

export interface RudimentEvaluation {
  rudiment: RudimentDefinition;
  performance: Performance;
  solverResult: EngineResult;
}

export const RUDIMENT_LIBRARY: RudimentDefinition[] = [
  {
    id: 'single-stroke-roll',
    name: 'Single Stroke Roll',
    description: 'Alternating strokes for timing and hand symmetry.',
    sticking: ['R', 'L', 'R', 'L', 'R', 'L', 'R', 'L'],
  },
  {
    id: 'double-stroke-roll',
    name: 'Double Stroke Roll',
    description: 'Two strokes per hand to train rebound control.',
    sticking: ['RR', 'LL', 'RR', 'LL'],
  },
  {
    id: 'single-paradiddle',
    name: 'Single Paradiddle',
    description: 'Classic RLRR / LRLL phrase for control and transitions.',
    sticking: ['R', 'L', 'R', 'RR', 'L', 'R', 'L', 'LL'],
  },
  {
    id: 'paradiddle-diddle',
    name: 'Paradiddle-Diddle',
    description: 'RLRRLL / LRLLRR hybrid for flow and accents.',
    sticking: ['R', 'L', 'RR', 'LL', 'L', 'R', 'LL', 'RR'],
  },
];

function normalizeStickToken(token: RudimentToken): Array<'left' | 'right'> {
  switch (token) {
    case 'R':
      return ['right'];
    case 'L':
      return ['left'];
    case 'RR':
      return ['right', 'right'];
    case 'LL':
      return ['left', 'left'];
    case 'RL':
      return ['right', 'left'];
    case 'LR':
      return ['left', 'right'];
    default:
      return [];
  }
}

function getDefaultCenterNote(config: InstrumentConfig): number {
  const centerRow = Math.floor(config.rows / 2);
  const centerCol = Math.floor(config.cols / 2);
  return GridMapService.getNoteForPosition(centerRow, centerCol, config);
}

export function generateRudimentPerformance(
  rudiment: RudimentDefinition,
  config: InstrumentConfig,
  options: RudimentGenerationOptions
): Performance {
  const bars = options.bars ?? 1;
  const bpm = options.bpm;
  const noteNumber = options.noteNumber ?? getDefaultCenterNote(config);
  const stepDuration = (60 / bpm) * (4 / options.subdivision);
  const events: Performance['events'] = [];

  for (let bar = 0; bar < bars; bar++) {
    for (let tokenIndex = 0; tokenIndex < rudiment.sticking.length; tokenIndex++) {
      const token = rudiment.sticking[tokenIndex];
      const resolvedStrokes = normalizeStickToken(token);
      const tokenStart = (bar * rudiment.sticking.length + tokenIndex) * stepDuration;

      for (let strokeIndex = 0; strokeIndex < resolvedStrokes.length; strokeIndex++) {
        events.push({
          noteNumber,
          startTime: tokenStart + strokeIndex * (stepDuration / Math.max(1, resolvedStrokes.length)),
          velocity: 96,
          duration: stepDuration * 0.8,
        });
      }
    }
  }

  return {
    name: `${rudiment.name} @ ${bpm} BPM`,
    tempo: bpm,
    events,
  };
}

export async function evaluateRudimentWithBiomechanics(
  rudiment: RudimentDefinition,
  instrumentConfig: InstrumentConfig,
  engineConfig: ConstructorParameters<typeof BiomechanicalSolver>[3],
  options: RudimentGenerationOptions,
  gridMapping: GridMapping | null = null
): Promise<RudimentEvaluation> {
  const solverType = options.solverType ?? 'beam';
  const performance = generateRudimentPerformance(rudiment, instrumentConfig, options);
  const solver = new BiomechanicalSolver(instrumentConfig, gridMapping, undefined, engineConfig, solverType);
  const solverResult = await solver.solveAsync(performance);

  return {
    rudiment,
    performance,
    solverResult,
  };
}
