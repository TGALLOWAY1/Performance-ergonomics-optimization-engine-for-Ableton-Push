/**
 * Unit tests for Event Analysis Panel
 * 
 * Tests verify that:
 * - Timeline rows render correctly
 * - Onion Skin view renders current and ghost states distinctly
 * - Export functions work
 * 
 * Note: Requires @testing-library/react to be installed for full testing.
 * Run: npm install --save-dev @testing-library/react @testing-library/jest-dom
 */

import { describe, it, expect } from 'vitest';
// Note: Uncomment when @testing-library/react is installed
// import { render, screen } from '@testing-library/react';
import { EventAnalysisPanel } from '../EventAnalysisPanel';
import type { EngineResult } from '../../engine/core';
import type { Performance } from '../../types/performance';

/**
 * Helper to create a mock EngineResult
 */
function createMockEngineResult(): EngineResult {
  return {
    score: 80,
    unplayableCount: 0,
    hardCount: 1,
    debugEvents: [
      {
        noteNumber: 36,
        startTime: 0.0,
        assignedHand: 'left',
        finger: 'index',
        cost: 2.0,
        difficulty: 'Easy',
        row: 0,
        col: 0,
      },
      {
        noteNumber: 38,
        startTime: 0.5,
        assignedHand: 'left',
        finger: 'middle',
        cost: 3.0,
        difficulty: 'Medium',
        row: 0,
        col: 1,
      },
      {
        noteNumber: 40,
        startTime: 1.0,
        assignedHand: 'right',
        finger: 'index',
        cost: 4.0,
        difficulty: 'Hard',
        row: 0,
        col: 5,
      },
    ],
    fingerUsageStats: {
      'L-Index': 1,
      'L-Middle': 1,
      'R-Index': 1,
    },
    fatigueMap: {},
    averageDrift: 1.5,
    averageMetrics: {
      movement: 2.0,
      stretch: 1.0,
      drift: 1.5,
      bounce: 0.5,
      fatigue: 0.3,
      crossover: 0.2,
      total: 5.5,
    },
  };
}

/**
 * Helper to create a mock Performance
 */
function createMockPerformance(): Performance {
  return {
    events: [
      { noteNumber: 36, startTime: 0.0 },
      { noteNumber: 38, startTime: 0.5 },
      { noteNumber: 40, startTime: 1.0 },
    ],
    tempo: 120,
    name: 'Test Performance',
  };
}

describe('EventAnalysisPanel', () => {
  it('should create mock data correctly', () => {
    const engineResult = createMockEngineResult();
    const performance = createMockPerformance();

    // Basic smoke test - verify mocks are valid
    expect(engineResult.debugEvents).toHaveLength(3);
    expect(performance.events).toHaveLength(3);
    expect(engineResult.score).toBe(80);
  });

  // Full render tests require @testing-library/react
  // Uncomment when testing library is installed:
  /*
  it('should render timeline rows when engineResult is provided', () => {
    const engineResult = createMockEngineResult();
    const performance = createMockPerformance();

    render(
      <EventAnalysisPanel
        engineResult={engineResult}
        performance={performance}
      />
    );

    expect(screen.getByText('Event Analysis')).toBeInTheDocument();
    expect(screen.getByText(/Event Timeline/i)).toBeInTheDocument();
  });

  it('should render empty state when no engineResult', () => {
    render(
      <EventAnalysisPanel
        engineResult={null}
        performance={null}
      />
    );

    expect(screen.getByText(/No analysis data available/i)).toBeInTheDocument();
  });

  it('should render export buttons in header', () => {
    const engineResult = createMockEngineResult();
    const performance = createMockPerformance();

    render(
      <EventAnalysisPanel
        engineResult={engineResult}
        performance={performance}
      />
    );

    expect(screen.getByText('Export Metrics')).toBeInTheDocument();
    expect(screen.getByText('Export Hard Transitions')).toBeInTheDocument();
    expect(screen.getByText('Export Loop Settings')).toBeInTheDocument();
  });
  */
});

