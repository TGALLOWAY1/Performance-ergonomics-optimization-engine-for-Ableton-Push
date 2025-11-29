/**
 * Event Timeline Panel
 * 
 * Displays a scrollable list of transitions (N → N+1) with difficulty heatmap.
 * Each row shows event index, timestamp, and a colored difficulty bar.
 */

import React, { useMemo, useEffect, useRef } from 'react';
import type { AnalyzedEvent, Transition } from '../types/eventAnalysis';

interface EventTimelinePanelProps {
  /** Array of analyzed events */
  events: AnalyzedEvent[];
  /** Array of transitions between consecutive events */
  transitions: Transition[];
  /** Currently selected event index */
  selectedIndex: number | null;
  /** Callback when an event is selected */
  onSelectIndex: (index: number) => void;
}

/**
 * Gets color for difficulty score (heatmap)
 */
function getDifficultyColor(score: number): string {
  if (score >= 0.8) return '#FF0000'; // Red - very difficult
  if (score >= 0.6) return '#FF8800'; // Orange - difficult
  if (score >= 0.4) return '#FFAA00'; // Yellow - moderate
  if (score >= 0.2) return '#88FF00'; // Light green - easy
  return '#00FF00'; // Green - very easy
}

/**
 * Maps FingerType to numeric ID (1-5)
 */
function getFingerNumber(finger: string | null): number {
  switch (finger) {
    case 'thumb': return 1;
    case 'index': return 2;
    case 'middle': return 3;
    case 'ring': return 4;
    case 'pinky': return 5;
    default: return 0;
  }
}

/**
 * Formats finger indicators for an event (e.g., "L2, R3, L4")
 * Returns a string like "L2 R3" or "L1" for single finger
 */
function formatFingerIndicators(event: AnalyzedEvent): string {
  const indicators: string[] = [];
  
  for (const note of event.notes) {
    const hand = note.debugEvent.assignedHand;
    const finger = note.debugEvent.finger;
    
    if (hand !== 'Unplayable' && finger) {
      const fingerNum = getFingerNumber(finger);
      if (fingerNum > 0) {
        const handPrefix = hand === 'left' ? 'L' : 'R';
        const indicator = `${handPrefix}${fingerNum}`;
        // Only add if not already in the list (avoid duplicates)
        if (!indicators.includes(indicator)) {
          indicators.push(indicator);
        }
      }
    }
  }
  
  return indicators.length > 0 ? indicators.join(' ') : '—';
}

export const EventTimelinePanel: React.FC<EventTimelinePanelProps> = ({
  events,
  transitions,
  selectedIndex,
  onSelectIndex,
}) => {
  // Ref for the scrollable container
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Ref for the selected row element
  const selectedRowRef = useRef<HTMLDivElement>(null);

  // Create rows for transitions (N → N+1)
  const rows = useMemo(() => {
    return transitions.map((transition, idx) => {
      const fromEvent = transition.fromEvent;
      const toEvent = transition.toEvent;
      const difficultyScore = transition.metrics.compositeDifficultyScore;
      
      return {
        transition,
        fromIndex: transition.fromIndex,
        toIndex: transition.toIndex,
        fromEvent,
        toEvent,
        difficultyScore,
        timeDeltaMs: transition.metrics.timeDeltaMs,
        timestamp: fromEvent.timestamp,
      };
    });
  }, [transitions]);

  // Scroll selected row into view when selectedIndex changes
  useEffect(() => {
    if (selectedRowRef.current && scrollContainerRef.current) {
      selectedRowRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-none px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-card)]">
        <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
          Event Timeline
        </h3>
        <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
          Click a transition or use ↑↓ arrow keys to navigate
        </p>
      </div>

      {/* Scrollable list */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar bg-[var(--bg-panel)]">
        {rows.length === 0 ? (
          <div className="p-4 text-center text-[var(--text-tertiary)] text-xs italic">
            No transitions to display
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {rows.map((row, idx) => {
              const isSelected = selectedIndex === row.fromIndex;
              const difficultyColor = getDifficultyColor(row.difficultyScore);
              
              return (
                <div
                  key={`transition-${row.fromIndex}-${row.toIndex}`}
                  ref={isSelected ? selectedRowRef : null}
                  onClick={() => onSelectIndex(row.fromIndex)}
                  className={`
                    px-4 py-3 cursor-pointer transition-colors
                    ${isSelected 
                      ? 'bg-[var(--bg-input)] border-l-2 border-l-blue-500' 
                      : 'hover:bg-[var(--bg-input)]/50'
                    }
                  `}
                >
                  {/* Row header: Index and timestamp */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-[var(--text-secondary)]">
                        {row.fromIndex} → {row.toIndex}
                      </span>
                      <span className="text-[10px] text-[var(--text-tertiary)]">
                        {row.timestamp.toFixed(2)}s
                      </span>
                    </div>
                    <div className="text-[10px] text-[var(--text-tertiary)]">
                      {row.timeDeltaMs.toFixed(0)}ms
                    </div>
                  </div>

                  {/* Difficulty bar */}
                  <div className="w-full h-2 bg-[var(--bg-app)] rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${row.difficultyScore * 100}%`,
                        backgroundColor: difficultyColor,
                      }}
                    />
                  </div>

                  {/* Event info */}
                  <div className="flex items-center gap-4 mt-2 text-[10px] text-[var(--text-tertiary)]">
                    <span className="font-mono">
                      {formatFingerIndicators(row.fromEvent)} → {formatFingerIndicators(row.toEvent)}
                    </span>
                    {row.transition.metrics.handSwitch && (
                      <span className="text-orange-400">Hand Switch</span>
                    )}
                    {row.transition.metrics.fingerChange && (
                      <span className="text-yellow-400">Finger Change</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

