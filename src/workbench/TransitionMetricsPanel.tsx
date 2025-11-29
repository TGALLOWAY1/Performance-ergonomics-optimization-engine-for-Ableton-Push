/**
 * Transition Metrics Panel
 * 
 * Displays detailed metrics for the currently selected transition.
 */

import React from 'react';
import type { AnalyzedEvent, Transition } from '../types/eventAnalysis';

interface TransitionMetricsPanelProps {
  /** Current analyzed event */
  currentEvent: AnalyzedEvent | undefined;
  /** Transition from current to next event */
  transition: Transition | null;
}

export const TransitionMetricsPanel: React.FC<TransitionMetricsPanelProps> = ({
  currentEvent,
  transition,
}) => {
  if (!currentEvent || !transition) {
    return (
      <div className="bg-[var(--bg-card)] p-4 rounded-[var(--radius-lg)] border border-[var(--border-subtle)]">
        <p className="text-xs text-[var(--text-tertiary)] italic text-center">
          Select a transition to view metrics
        </p>
      </div>
    );
  }

  const { metrics } = transition;

  return (
    <div className="bg-[var(--bg-card)] p-4 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] space-y-4">
      <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
        Transition Metrics
      </h3>

      {/* Time and Distance */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--bg-input)] rounded-[var(--radius-md)] p-3 border border-[var(--border-subtle)]">
          <div className="text-[10px] text-[var(--text-tertiary)] uppercase mb-1">Time Delta</div>
          <div className="text-lg font-mono text-[var(--text-primary)]">
            {metrics.timeDeltaMs.toFixed(0)}ms
          </div>
        </div>
        <div className="bg-[var(--bg-input)] rounded-[var(--radius-md)] p-3 border border-[var(--border-subtle)]">
          <div className="text-[10px] text-[var(--text-tertiary)] uppercase mb-1">Grid Distance</div>
          <div className="text-lg font-mono text-[var(--text-primary)]">
            {metrics.gridDistance.toFixed(2)} cells
          </div>
        </div>
      </div>

      {/* Difficulty Scores */}
      <div className="space-y-2">
        <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Difficulty Scores</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[var(--bg-input)] rounded-[var(--radius-md)] p-2 border border-[var(--border-subtle)]">
            <div className="text-[10px] text-[var(--text-tertiary)]">Composite</div>
            <div className="text-sm font-mono text-[var(--text-primary)]">
              {(metrics.compositeDifficultyScore * 100).toFixed(0)}%
            </div>
          </div>
          <div className="bg-[var(--bg-input)] rounded-[var(--radius-md)] p-2 border border-[var(--border-subtle)]">
            <div className="text-[10px] text-[var(--text-tertiary)]">Stretch</div>
            <div className="text-sm font-mono text-[var(--text-primary)]">
              {(metrics.anatomicalStretchScore * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      {/* Speed and Movement */}
      <div className="space-y-2">
        <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Movement</div>
        <div className="bg-[var(--bg-input)] rounded-[var(--radius-md)] p-2 border border-[var(--border-subtle)]">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-[var(--text-secondary)]">Speed Pressure</span>
            <span className="text-xs font-mono text-[var(--text-primary)]">
              {(metrics.speedPressure * 100).toFixed(0)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-[var(--bg-app)] rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${metrics.speedPressure * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Flags */}
      <div className="space-y-2">
        <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Transition Flags</div>
        <div className="flex flex-wrap gap-2">
          {metrics.handSwitch && (
            <span className="px-2 py-1 text-[10px] bg-orange-500/20 text-orange-400 rounded border border-orange-500/30">
              Hand Switch
            </span>
          )}
          {metrics.fingerChange && (
            <span className="px-2 py-1 text-[10px] bg-yellow-500/20 text-yellow-400 rounded border border-yellow-500/30">
              Finger Change
            </span>
          )}
          {!metrics.handSwitch && !metrics.fingerChange && (
            <span className="px-2 py-1 text-[10px] bg-green-500/20 text-green-400 rounded border border-green-500/30">
              Same Hand/Finger
            </span>
          )}
        </div>
      </div>

      {/* Event Details */}
      <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
        <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Event Details</div>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <span className="text-[var(--text-secondary)]">From:</span>
            <span className="ml-1 text-[var(--text-primary)] font-mono">
              {transition.fromEvent.notes.length} pad{transition.fromEvent.notes.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div>
            <span className="text-[var(--text-secondary)]">To:</span>
            <span className="ml-1 text-[var(--text-primary)] font-mono">
              {transition.toEvent.notes.length} pad{transition.toEvent.notes.length !== 1 ? 's' : ''}
            </span>
          </div>
          {transition.fromEvent.eventMetrics?.polyphony && transition.fromEvent.eventMetrics.polyphony > 1 && (
            <div>
              <span className="text-[var(--text-secondary)]">Polyphony:</span>
              <span className="ml-1 text-[var(--text-primary)]">
                {transition.fromEvent.eventMetrics.polyphony}×
              </span>
            </div>
          )}
          {transition.fromEvent.pads.length > 0 && (
            <div>
              <span className="text-[var(--text-secondary)]">Pads:</span>
              <span className="ml-1 text-[var(--text-primary)] font-mono text-[9px]">
                {transition.fromEvent.pads.slice(0, 3).join(', ')}
                {transition.fromEvent.pads.length > 3 ? '...' : ''}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

