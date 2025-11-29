/**
 * Event Analysis Panel
 * 
 * Main panel combining Event Timeline, Onion Skin visualization, and Transition Metrics.
 * Integrates the event analysis pipeline (analyzeEvents, analyzeAllTransitions, buildOnionSkinModel).
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { EngineResult } from '../engine/core';
import type { Performance } from '../types/performance';
import { analyzeEvents } from '../engine/eventMetrics';
import { analyzeAllTransitions } from '../engine/transitionAnalyzer';
import { buildOnionSkinModel, type OnionSkinInput } from '../engine/onionSkinBuilder';
import { EventTimelinePanel } from './EventTimelinePanel';
import { TransitionMetricsPanel } from './TransitionMetricsPanel';
import { OnionSkinGrid } from '../components/vis/OnionSkinGrid';
import { PracticeLoopControls } from './PracticeLoopControls';
import { usePracticeLoop } from '../hooks/usePracticeLoop';
import {
  exportAllEventsToJson,
  exportHardTransitionsToJson,
  exportPracticeLoopSettingsToJson,
  downloadJsonFile,
} from '../utils/eventExport';

interface EventAnalysisPanelProps {
  /** Engine result containing debug events */
  engineResult: EngineResult | null;
  /** Performance data (for tempo) */
  performance: Performance | null;
}

export const EventAnalysisPanel: React.FC<EventAnalysisPanelProps> = ({
  engineResult,
  performance,
}) => {
  // Analyze events and transitions (memoized with proper dependencies)
  const { analyzedEvents, transitions } = useMemo(() => {
    if (!engineResult) {
      return { analyzedEvents: [], transitions: [] };
    }

    // Step 1: Analyze events (add anatomical stretch and composite difficulty scores)
    const events = analyzeEvents(engineResult);

    // Step 2: Analyze transitions between consecutive events
    const tempoBpm = performance?.tempo;
    const trans = analyzeAllTransitions(events, tempoBpm);

    return {
      analyzedEvents: events,
      transitions: trans,
    };
  }, [engineResult, performance?.tempo]); // Key on engineResult and tempo (performance object reference may change)

  // Selected event index state
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(() => {
    // Default to first event if available
    return analyzedEvents.length > 0 ? 0 : null;
  });

  // Update selected index when events change
  React.useEffect(() => {
    if (analyzedEvents.length > 0 && (selectedEventIndex === null || selectedEventIndex >= analyzedEvents.length)) {
      setSelectedEventIndex(0);
    }
  }, [analyzedEvents.length, selectedEventIndex]);

  // Keyboard navigation: Arrow Up/Down to navigate between events
  useEffect(() => {
    if (analyzedEvents.length === 0) {
      return; // No events to navigate
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle arrow keys if not typing in an input/textarea
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return; // Don't interfere with text input
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedEventIndex((prevIndex) => {
          if (prevIndex === null) {
            return 0; // Start at first event
          }
          if (prevIndex < analyzedEvents.length - 1) {
            return prevIndex + 1; // Move to next event
          }
          return prevIndex; // Already at last event
        });
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedEventIndex((prevIndex) => {
          if (prevIndex === null) {
            return 0; // Start at first event
          }
          if (prevIndex > 0) {
            return prevIndex - 1; // Move to previous event
          }
          return prevIndex; // Already at first event
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [analyzedEvents.length]);

  // Build onion skin model for selected event (memoized)
  const onionSkinModel = useMemo(() => {
    if (selectedEventIndex === null || analyzedEvents.length === 0) {
      return null;
    }

    const input: OnionSkinInput = {
      events: analyzedEvents,
      transitions,
    };

    return buildOnionSkinModel(input, selectedEventIndex);
  }, [analyzedEvents, transitions, selectedEventIndex]); // Properly memoized

  // Get current transition (from selected event to next)
  const currentTransition = useMemo(() => {
    if (selectedEventIndex === null) return null;
    return transitions.find(t => t.fromIndex === selectedEventIndex) || null;
  }, [transitions, selectedEventIndex]);

  // Get current event
  const currentEvent = selectedEventIndex !== null && selectedEventIndex < analyzedEvents.length
    ? analyzedEvents[selectedEventIndex]
    : undefined;

  // Practice loop hook
  const practiceLoop = usePracticeLoop({
    performance,
    events: analyzedEvents,
    transitions,
    selectedIndex: selectedEventIndex,
    onIndexChange: setSelectedEventIndex,
  });

  // Check if there's a next event for practice loop
  const hasNextEvent = selectedEventIndex !== null && selectedEventIndex < analyzedEvents.length - 1;

  // Export handlers
  const handleExportAllEvents = useCallback(() => {
    const json = exportAllEventsToJson(analyzedEvents, transitions);
    const songName = performance?.name || 'events';
    const filename = `${songName}_event-metrics.json`;
    downloadJsonFile(json, filename);
  }, [analyzedEvents, transitions, performance?.name]);

  const handleExportHardTransitions = useCallback(() => {
    const json = exportHardTransitionsToJson(transitions, 0.7);
    const songName = performance?.name || 'transitions';
    const filename = `${songName}_hard-transitions.json`;
    downloadJsonFile(json, filename);
  }, [transitions, performance?.name]);

  const handleExportPracticeLoopSettings = useCallback(() => {
    const speeds = [0.75, 0.85, 1.0, 1.10];
    const json = exportPracticeLoopSettingsToJson(selectedEventIndex, speeds);
    const songName = performance?.name || 'practice';
    const filename = `${songName}_practice-loop-settings.json`;
    downloadJsonFile(json, filename);
  }, [selectedEventIndex, performance?.name]);

  if (!engineResult || analyzedEvents.length === 0) {
    return (
      <div className="h-full flex flex-col bg-[var(--bg-panel)] border-l border-[var(--border-subtle)] backdrop-blur-md">
        <div className="flex-none h-12 border-b border-[var(--border-subtle)] flex items-center px-4 bg-[var(--bg-card)]">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] tracking-wide uppercase">
            Event Analysis
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[var(--text-tertiary)] italic">
            No analysis data available. Run the engine to see event analysis.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--bg-app)] overflow-hidden">
      {/* Export Buttons Bar */}
      <div className="flex-none h-10 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] flex items-center justify-end px-4 gap-2">
        <button
          onClick={handleExportAllEvents}
          className="px-3 py-1 text-[10px] font-semibold bg-[var(--bg-input)] hover:bg-[var(--bg-input)]/80 text-[var(--text-primary)] rounded-[var(--radius-sm)] border border-[var(--border-subtle)] transition-all"
          title="Export all event metrics to JSON"
        >
          Export Metrics
        </button>
        <button
          onClick={handleExportHardTransitions}
          className="px-3 py-1 text-[10px] font-semibold bg-[var(--bg-input)] hover:bg-[var(--bg-input)]/80 text-[var(--text-primary)] rounded-[var(--radius-sm)] border border-[var(--border-subtle)] transition-all"
          title="Export hard transitions (difficulty ≥ 0.7) to JSON"
        >
          Export Hard Transitions
        </button>
        <button
          onClick={handleExportPracticeLoopSettings}
          className="px-3 py-1 text-[10px] font-semibold bg-[var(--bg-input)] hover:bg-[var(--bg-input)]/80 text-[var(--text-primary)] rounded-[var(--radius-sm)] border border-[var(--border-subtle)] transition-all"
          title="Export practice loop settings to JSON"
        >
          Export Loop Settings
        </button>
      </div>

      {/* Main content: Three-column layout */}
      <div className="flex-1 flex overflow-hidden min-w-0">
        {/* Left: Event Timeline (scrollable) */}
        <div className="w-80 flex-none border-r border-[var(--border-subtle)] bg-[var(--bg-panel)] flex flex-col overflow-hidden">
          <EventTimelinePanel
            events={analyzedEvents}
            transitions={transitions}
            selectedIndex={selectedEventIndex}
            onSelectIndex={setSelectedEventIndex}
          />
        </div>

        {/* Center: Onion Skin Grid Visualization */}
        <div 
          className="flex-1 flex items-center justify-center p-6 bg-[var(--bg-app)] min-w-0 overflow-hidden" 
          style={{ containerType: 'size' } as React.CSSProperties}
        >
          {onionSkinModel ? (
            <div 
              style={{
                width: 'calc(100cqmin - 48px)',
                height: 'calc(100cqmin - 48px)',
                aspectRatio: '1/1',
                maxWidth: '100%',
                maxHeight: '100%'
              }}
            >
              <OnionSkinGrid
                model={onionSkinModel}
                onPadHover={(padKey) => {
                  // Optional: Could show tooltip or highlight
                  console.log('Pad hovered:', padKey);
                }}
              />
            </div>
          ) : (
            <div className="text-center text-[var(--text-tertiary)] text-sm italic">
              No visualization available
            </div>
          )}
        </div>

        {/* Right: Metrics & Controls */}
        <div className="w-96 flex-none border-l border-[var(--border-subtle)] bg-[var(--bg-panel)] flex flex-col overflow-y-auto">
          {/* Practice Loop Controls */}
          <div className="flex-none p-4 border-b border-[var(--border-subtle)]">
            <PracticeLoopControls
              hasNextEvent={hasNextEvent}
              selectedIndex={selectedEventIndex}
              onStartLoop={practiceLoop.startLoop}
              onStopLoop={practiceLoop.stopLoop}
              isPlaying={practiceLoop.isPlaying}
            />
          </div>

          {/* Transition Metrics Panel */}
          <div className="flex-1 p-4">
            <TransitionMetricsPanel
              currentEvent={currentEvent}
              transition={currentTransition}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

