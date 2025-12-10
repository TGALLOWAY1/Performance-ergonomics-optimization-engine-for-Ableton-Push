/**
 * Cost Debug Page
 * 
 * Developer-facing diagnostic view for detailed per-event cost breakdown analysis.
 * This page visualizes EngineResult.debugEvents and costBreakdown data to help
 * developers understand how the solver calculates ergonomic costs for each event.
 * 
 * **Dev-Only Feature**: This page is only available in development builds.
 * It's safe to disable in production as it relies on debug data that may not
 * be present in optimized builds.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { EngineDebugEvent, CostBreakdown, AnnealingIterationSnapshot } from '../engine/core';
import { songService } from '../services/SongService';

// Dev-only flag: only show Cost Debug in development builds
const SHOW_COST_DEBUG = import.meta.env.MODE === 'development';

type SortMode = 'time' | 'cost';
type CostDebugMode = 'events' | 'annealing' | 'annealingMetrics';

export const CostDebugPage: React.FC = () => {
  const { engineResult } = useProject();
  const [searchParams] = useSearchParams();
  const songId = searchParams.get('songId');
  const [songName, setSongName] = useState<string | null>(null);
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('time');
  const [mode, setMode] = useState<CostDebugMode>('events');

  // Get song metadata for display
  useEffect(() => {
    if (songId) {
      const song = songService.getSong(songId);
      if (song) {
        setSongName(song.metadata.title);
      }
    }
  }, [songId]);

  // Build navigation links with songId if present
  const workbenchLink = songId ? `/workbench?songId=${songId}` : '/workbench';
  const dashboardLink = '/';
  const timelineLink = songId ? `/timeline?songId=${songId}` : '/timeline';
  const eventAnalysisLink = songId ? `/event-analysis?songId=${songId}` : '/event-analysis';

  // Dev-only check: show disabled message if not in development
  if (!SHOW_COST_DEBUG) {
    return (
      <div className="h-screen w-screen flex flex-col bg-[var(--bg-app)] text-[var(--text-primary)] items-center justify-center">
        <div className="max-w-md text-center space-y-4 p-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Cost Debug</h1>
          <p className="text-[var(--text-secondary)]">
            Cost Debug is disabled in this build. This diagnostic view is only available in development mode.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link
              to={workbenchLink}
              className="px-4 py-2 bg-[var(--bg-card)] hover:brightness-110 text-[var(--text-primary)] rounded-[var(--radius-sm)] border border-[var(--border-subtle)] transition-all"
            >
              Go to Workbench
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Get debug events and sort them
  const rawDebugEvents = engineResult?.debugEvents || [];
  
  // Get annealing trace
  const annealingTrace = engineResult?.annealingTrace ?? [];

  // Memoized sorted events: default to time ascending, optional cost descending
  const sortedDebugEvents = useMemo(() => {
    const events = [...rawDebugEvents];
    if (sortMode === 'time') {
      return events.sort((a, b) => a.startTime - b.startTime);
    } else {
      // Sort by cost descending (highest cost first)
      return events.sort((a, b) => {
        const costA = a.costBreakdown?.total ?? a.cost;
        const costB = b.costBreakdown?.total ?? b.cost;
        // Handle Infinity values
        if (costA === Infinity && costB === Infinity) return 0;
        if (costA === Infinity) return -1;
        if (costB === Infinity) return 1;
        return costB - costA;
      });
    }
  }, [rawDebugEvents, sortMode]);

  // Get debug events (using sorted version)
  const debugEvents = sortedDebugEvents;

  // Calculate aggregate metrics across all events
  const aggregateMetrics = useMemo(() => {
    if (!engineResult?.debugEvents || engineResult.debugEvents.length === 0) {
      return null;
    }

    const events = engineResult.debugEvents;
    const playableEvents = events.filter(e => e.assignedHand !== 'Unplayable' && e.costBreakdown);
    
    if (playableEvents.length === 0) {
      return null;
    }

    const totals: CostBreakdown = {
      movement: 0,
      stretch: 0,
      drift: 0,
      bounce: 0,
      fatigue: 0,
      crossover: 0,
      total: 0,
    };

    playableEvents.forEach(event => {
      if (event.costBreakdown) {
        totals.movement += event.costBreakdown.movement;
        totals.stretch += event.costBreakdown.stretch;
        totals.drift += event.costBreakdown.drift;
        totals.bounce += event.costBreakdown.bounce;
        totals.fatigue += event.costBreakdown.fatigue;
        totals.crossover += event.costBreakdown.crossover;
        totals.total += event.costBreakdown.total;
      }
    });

    const count = playableEvents.length;
    return {
      movement: totals.movement / count,
      stretch: totals.stretch / count,
      drift: totals.drift / count,
      bounce: totals.bounce / count,
      fatigue: totals.fatigue / count,
      crossover: totals.crossover / count,
      total: totals.total / count,
    };
  }, [engineResult]);

  // Get selected event (using sorted index)
  const selectedEvent = useMemo(() => {
    if (selectedEventIndex === null || !debugEvents[selectedEventIndex]) {
      return null;
    }
    return debugEvents[selectedEventIndex];
  }, [selectedEventIndex, debugEvents]);

  // Memoized selection handler for performance
  const handleEventSelect = useCallback((index: number) => {
    setSelectedEventIndex(index);
  }, []);

  // Format pad display (padId or "row,col" or "N/A")
  const formatPad = (event: EngineDebugEvent): string => {
    if (event.padId) {
      return event.padId;
    }
    if (event.row !== undefined && event.col !== undefined) {
      return `${event.row},${event.col}`;
    }
    return 'N/A';
  };

  // Format difficulty badge color
  const getDifficultyColor = (difficulty: string): string => {
    switch (difficulty) {
      case 'Easy':
        return 'text-emerald-400 bg-emerald-400/10';
      case 'Medium':
        return 'text-amber-400 bg-amber-400/10';
      case 'Hard':
        return 'text-red-400 bg-red-400/10';
      case 'Unplayable':
        return 'text-red-600 bg-red-600/10';
      default:
        return 'text-[var(--text-secondary)] bg-[var(--bg-input)]';
    }
  };

  // Empty state: no data available
  if (!engineResult || !debugEvents || debugEvents.length === 0) {
    return (
      <div className="h-screen w-screen flex flex-col bg-[var(--bg-app)] text-[var(--text-primary)] items-center justify-center">
        <div className="max-w-md text-center space-y-4 p-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Cost Debug</h1>
          <p className="text-[var(--text-secondary)]">
            {!engineResult
              ? 'Run the solver in the Workbench to see cost breakdown.'
              : 'No debug events available. The solver needs to run first.'}
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link
              to={workbenchLink}
              className="px-4 py-2 bg-[var(--bg-card)] hover:brightness-110 text-[var(--text-primary)] rounded-[var(--radius-sm)] border border-[var(--border-subtle)] transition-all"
            >
              Go to Workbench
            </Link>
            <Link
              to={dashboardLink}
              className="px-4 py-2 bg-[var(--bg-card)] hover:brightness-110 text-[var(--text-primary)] rounded-[var(--radius-sm)] border border-[var(--border-subtle)] transition-all"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden font-[family-name:var(--font-ui)]">
      {/* Header */}
      <div className="flex-none h-16 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] backdrop-blur-md flex items-center justify-between px-6 z-50 relative shadow-sm">
        {/* Left: Navigation & Title */}
        <div className="flex items-center gap-4">
          <Link
            to={workbenchLink}
            className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <div className="h-6 w-px bg-[var(--border-subtle)]" />
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight">Cost Debug</h1>
            {songName && (
              <span className="text-[10px] text-[var(--text-secondary)] font-medium tracking-wider uppercase">
                {songName}
              </span>
            )}
          </div>
        </div>

        {/* Right: Navigation Links */}
        <div className="flex items-center gap-4">
          <Link
            to={dashboardLink}
            className="px-3 py-1.5 text-xs font-semibold bg-[var(--bg-card)] hover:brightness-110 text-[var(--text-primary)] rounded-[var(--radius-sm)] border border-[var(--border-subtle)] transition-all flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </Link>
          <Link
            to={workbenchLink}
            className="px-3 py-1.5 text-xs font-semibold bg-[var(--bg-card)] hover:brightness-110 text-[var(--text-primary)] rounded-[var(--radius-sm)] border border-[var(--border-subtle)] transition-all"
          >
            Workbench
          </Link>
          <Link
            to={timelineLink}
            className="px-3 py-1.5 text-xs font-semibold bg-[var(--bg-card)] hover:brightness-110 text-[var(--text-primary)] rounded-[var(--radius-sm)] border border-[var(--border-subtle)] transition-all"
          >
            Timeline
          </Link>
          <Link
            to={eventAnalysisLink}
            className="px-3 py-1.5 text-xs font-semibold bg-[var(--bg-card)] hover:brightness-110 text-[var(--text-primary)] rounded-[var(--radius-sm)] border border-[var(--border-subtle)] transition-all flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Event Analysis
          </Link>
          <div className="h-6 w-px bg-[var(--border-subtle)]" />
          <span className="px-3 py-1.5 text-xs font-semibold bg-[var(--bg-input)] text-[var(--text-primary)] rounded-[var(--radius-sm)] border border-[var(--border-subtle)]">
            Cost Debug
          </span>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex-none border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] px-6 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode('events')}
            className={`px-4 py-2 text-sm font-semibold rounded-[var(--radius-sm)] transition-all ${
              mode === 'events'
                ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-sm'
                : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Event Costs
          </button>
          <button
            onClick={() => setMode('annealing')}
            className={`px-4 py-2 text-sm font-semibold rounded-[var(--radius-sm)] transition-all ${
              mode === 'annealing'
                ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-sm'
                : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Annealing Trajectory
          </button>
          <button
            onClick={() => setMode('annealingMetrics')}
            className={`px-4 py-2 text-sm font-semibold rounded-[var(--radius-sm)] transition-all ${
              mode === 'annealingMetrics'
                ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-sm'
                : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Annealing Metrics
          </button>
        </div>
      </div>

      {/* Main Content */}
      {mode === 'events' ? (
        <EventCostsView
          debugEvents={debugEvents}
          selectedEventIndex={selectedEventIndex}
          onSelectEvent={handleEventSelect}
          selectedEvent={selectedEvent}
          aggregateMetrics={aggregateMetrics}
          sortMode={sortMode}
          onSortChange={setSortMode}
          formatPad={formatPad}
          getDifficultyColor={getDifficultyColor}
        />
      ) : mode === 'annealing' ? (
        <AnnealingTrajectoryView annealingTrace={annealingTrace} />
      ) : (
        <AnnealingMetricsView annealingTrace={annealingTrace} />
      )}
    </div>
  );
};

// ============================================================================
// Event Costs View Component
// ============================================================================

interface EventCostsViewProps {
  debugEvents: EngineDebugEvent[];
  selectedEventIndex: number | null;
  onSelectEvent: (index: number) => void;
  selectedEvent: EngineDebugEvent | null;
  aggregateMetrics: ReturnType<typeof useMemo<CostBreakdown | null>>;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  formatPad: (event: EngineDebugEvent) => string;
  getDifficultyColor: (difficulty: string) => string;
}

const EventCostsView: React.FC<EventCostsViewProps> = ({
  debugEvents,
  selectedEventIndex,
  onSelectEvent,
  selectedEvent,
  aggregateMetrics,
  sortMode,
  onSortChange,
  formatPad,
  getDifficultyColor,
}) => {
  return (
    <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Event List Table */}
        <div className="flex-1 flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-panel)]">
          {/* Aggregate Metrics Header */}
          {aggregateMetrics && (
            <div className="flex-none p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-card)]">
              <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Average Cost Metrics</h2>
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-[var(--bg-input)] rounded-[var(--radius-md)] p-2 border border-[var(--border-subtle)]">
                  <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Movement</div>
                  <div className="text-sm font-mono text-[var(--text-primary)] mt-1">{aggregateMetrics.movement.toFixed(2)}</div>
                </div>
                <div className="bg-[var(--bg-input)] rounded-[var(--radius-md)] p-2 border border-[var(--border-subtle)]">
                  <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Stretch</div>
                  <div className="text-sm font-mono text-[var(--text-primary)] mt-1">{aggregateMetrics.stretch.toFixed(2)}</div>
                </div>
                <div className="bg-[var(--bg-input)] rounded-[var(--radius-md)] p-2 border border-[var(--border-subtle)]">
                  <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Drift</div>
                  <div className="text-sm font-mono text-[var(--text-primary)] mt-1">{aggregateMetrics.drift.toFixed(2)}</div>
                </div>
                <div className="bg-[var(--bg-input)] rounded-[var(--radius-md)] p-2 border border-[var(--border-subtle)]">
                  <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Total</div>
                  <div className="text-sm font-mono text-[var(--text-primary)] mt-1">{aggregateMetrics.total.toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Table Header with Sort Controls */}
          <div className="flex-none border-b border-[var(--border-subtle)] bg-[var(--bg-card)]">
            <div className="grid grid-cols-[50px_80px_60px_80px_80px_80px_100px_100px] gap-2 px-4 py-3 text-[10px] uppercase text-[var(--text-secondary)] font-semibold tracking-wider">
              <div>#</div>
              <div className="flex items-center gap-1.5 cursor-pointer hover:text-[var(--text-primary)] transition-colors" onClick={() => onSortChange('time')}>
                Time
                {sortMode === 'time' && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                )}
              </div>
              <div>Note</div>
              <div>Pad</div>
              <div>Hand</div>
              <div>Finger</div>
              <div className="text-right flex items-center justify-end gap-1.5 cursor-pointer hover:text-[var(--text-primary)] transition-colors" onClick={() => onSortChange('cost')}>
                Total Cost
                {sortMode === 'cost' && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </div>
              <div>Difficulty</div>
            </div>
          </div>

          {/* Table Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {debugEvents.map((event, index) => {
              const isSelected = selectedEventIndex === index;
              const displayIndex = event.eventIndex !== undefined ? event.eventIndex : index;
              const totalCost = event.costBreakdown?.total ?? event.cost;
              const isUnplayable = event.assignedHand === 'Unplayable' || event.cost === Infinity;

              return (
                <div
                  key={`${event.eventIndex ?? index}-${event.startTime}`}
                  onClick={() => onSelectEvent(index)}
                  className={`grid grid-cols-[50px_80px_60px_80px_80px_80px_100px_100px] gap-2 px-4 py-2 border-b border-[var(--border-subtle)] text-xs cursor-pointer transition-all items-center ${
                    isSelected
                      ? 'bg-blue-500/10 border-l-4 border-l-blue-500 shadow-sm'
                      : 'hover:bg-[var(--bg-input)]/50 hover:border-l-2 hover:border-l-[var(--border-subtle)]'
                  } ${isUnplayable ? 'opacity-60' : ''}`}
                >
                  <div className="text-[var(--text-tertiary)] font-mono">{displayIndex + 1}</div>
                  <div className="text-[var(--text-secondary)] font-mono">
                    {event.startTime.toFixed(3)}s
                  </div>
                  <div className="text-[var(--text-primary)] font-medium">
                    {event.noteNumber || '—'}
                  </div>
                  <div className="text-[var(--text-secondary)] font-mono text-[10px]">
                    {formatPad(event)}
                  </div>
                  <div className="text-[var(--text-secondary)]">
                    {event.assignedHand === 'Unplayable' ? (
                      <span className="text-red-400">—</span>
                    ) : (
                      event.assignedHand === 'left' ? 'L' : 'R'
                    )}
                  </div>
                  <div className="text-[var(--text-secondary)]">
                    {event.finger ? (
                      event.finger.charAt(0).toUpperCase() + event.finger.slice(1)
                    ) : (
                      <span className="text-red-400">—</span>
                    )}
                  </div>
                  <div className={`text-right font-mono ${
                    isUnplayable
                      ? 'text-red-400'
                      : totalCost > 10
                      ? 'text-red-400'
                      : totalCost > 5
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}>
                    {isUnplayable ? '∞' : totalCost.toFixed(2)}
                  </div>
                  <div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${getDifficultyColor(event.difficulty)}`}>
                      {event.difficulty}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel: Event Detail */}
        <div className="w-96 flex-none bg-[var(--bg-panel)] border-l border-[var(--border-subtle)] flex flex-col">
          {!selectedEvent ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center space-y-2">
                <svg
                  className="w-12 h-12 mx-auto text-[var(--text-tertiary)] opacity-50"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <p className="text-sm text-[var(--text-secondary)]">
                  Select an event from the list to view cost breakdown.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              {/* Event Metadata */}
              <div className="bg-[var(--bg-card)] p-4 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] space-y-3">
                <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Event Metadata</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-[10px] text-[var(--text-tertiary)] uppercase mb-1">Time</div>
                    <div className="font-mono text-[var(--text-primary)]">{selectedEvent.startTime.toFixed(3)}s</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-tertiary)] uppercase mb-1">Note</div>
                    <div className="font-mono text-[var(--text-primary)]">{selectedEvent.noteNumber || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-tertiary)] uppercase mb-1">Pad</div>
                    <div className="font-mono text-[var(--text-primary)]">{formatPad(selectedEvent)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-tertiary)] uppercase mb-1">Hand</div>
                    <div className="text-[var(--text-primary)]">
                      {selectedEvent.assignedHand === 'Unplayable' ? (
                        <span className="text-red-400">Unplayable</span>
                      ) : (
                        selectedEvent.assignedHand === 'left' ? 'Left' : 'Right'
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-tertiary)] uppercase mb-1">Finger</div>
                    <div className="text-[var(--text-primary)]">
                      {selectedEvent.finger ? (
                        selectedEvent.finger.charAt(0).toUpperCase() + selectedEvent.finger.slice(1)
                      ) : (
                        <span className="text-red-400">—</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-tertiary)] uppercase mb-1">Difficulty</div>
                    <div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(selectedEvent.difficulty)}`}>
                        {selectedEvent.difficulty}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="bg-[var(--bg-card)] p-4 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] space-y-4">
                <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Cost Breakdown</h3>
                {!selectedEvent.costBreakdown ? (
                  <div className="text-center py-4 text-[var(--text-tertiary)] text-sm italic">
                    Cost breakdown not available for this event.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(selectedEvent.costBreakdown)
                      .filter(([key]) => key !== 'total')
                      .map(([key, value]) => {
                        const total = selectedEvent.costBreakdown!.total;
                        const percentage = total > 0 ? (value / total) * 100 : 0;
                        const componentName = key.charAt(0).toUpperCase() + key.slice(1);

                        return (
                          <div key={key} className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-[var(--text-secondary)]">{componentName}</span>
                              <span className="font-mono text-[var(--text-primary)]">
                                {value === Infinity ? '∞' : value.toFixed(2)}
                              </span>
                            </div>
                            <div className="h-2 bg-[var(--bg-input)] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[var(--finger-L2)] transition-all"
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    <div className="pt-2 border-t border-[var(--border-subtle)]">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">Total Cost</span>
                        <span className={`font-mono text-lg font-bold ${
                          selectedEvent.costBreakdown.total === Infinity
                            ? 'text-red-400'
                            : selectedEvent.costBreakdown.total > 10
                            ? 'text-red-400'
                            : selectedEvent.costBreakdown.total > 5
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}>
                          {selectedEvent.costBreakdown.total === Infinity
                            ? '∞'
                            : selectedEvent.costBreakdown.total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
  );
};

// ============================================================================
// Annealing Trajectory View Component
// ============================================================================

interface AnnealingTrajectoryViewProps {
  annealingTrace: AnnealingIterationSnapshot[];
}

const AnnealingTrajectoryView: React.FC<AnnealingTrajectoryViewProps> = ({ annealingTrace }) => {
  // Calculate aggregate metrics
  const aggregates = useMemo(() => {
    if (!annealingTrace || annealingTrace.length === 0) {
      return null;
    }

    const first = annealingTrace[0];
    const last = annealingTrace[annealingTrace.length - 1];
    const allCosts = annealingTrace.map(s => s.currentCost);
    const minCost = Math.min(...allCosts);
    const acceptedCount = annealingTrace.filter(s => s.accepted).length;
    const acceptanceRate = annealingTrace.length > 0 ? acceptedCount / annealingTrace.length : 0;

    return {
      initialCost: first.currentCost,
      finalCost: last.currentCost,
      bestCost: last.bestCost,
      minCost,
      acceptanceRate,
    };
  }, [annealingTrace]);

  // Empty state
  if (!annealingTrace || annealingTrace.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-2 max-w-md">
          <svg
            className="w-12 h-12 mx-auto text-[var(--text-tertiary)] opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="text-sm text-[var(--text-secondary)]">
            No annealing trace available. Make sure the simulated annealing solver has been run.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Aggregate Summary Cards */}
      {aggregates && (
        <div className="flex-none p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-card)]">
          <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Optimization Summary</h2>
          <div className="grid grid-cols-5 gap-3">
            <div className="bg-[var(--bg-input)] rounded-[var(--radius-md)] p-2 border border-[var(--border-subtle)]">
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Initial Cost</div>
              <div className="text-sm font-mono text-[var(--text-primary)] mt-1">{aggregates.initialCost.toFixed(2)}</div>
            </div>
            <div className="bg-[var(--bg-input)] rounded-[var(--radius-md)] p-2 border border-[var(--border-subtle)]">
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Final Cost</div>
              <div className="text-sm font-mono text-[var(--text-primary)] mt-1">{aggregates.finalCost.toFixed(2)}</div>
            </div>
            <div className="bg-[var(--bg-input)] rounded-[var(--radius-md)] p-2 border border-[var(--border-subtle)]">
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Best Cost</div>
              <div className="text-sm font-mono text-emerald-400 mt-1">{aggregates.bestCost.toFixed(2)}</div>
            </div>
            <div className="bg-[var(--bg-input)] rounded-[var(--radius-md)] p-2 border border-[var(--border-subtle)]">
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Min Observed</div>
              <div className="text-sm font-mono text-emerald-400 mt-1">{aggregates.minCost.toFixed(2)}</div>
            </div>
            <div className="bg-[var(--bg-input)] rounded-[var(--radius-md)] p-2 border border-[var(--border-subtle)]">
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Acceptance Rate</div>
              <div className="text-sm font-mono text-[var(--text-primary)] mt-1">{(aggregates.acceptanceRate * 100).toFixed(1)}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Chart Section */}
      <div className="flex-none p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]">
        <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Cost vs. Iteration</h3>
        <AnnealingTrajectoryChart trace={annealingTrace} />
      </div>

      {/* Table Section */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-panel)]">
        <div className="flex-none border-b border-[var(--border-subtle)] bg-[var(--bg-card)]">
          <div className="grid grid-cols-[80px_100px_100px_100px_80px_100px] gap-2 px-4 py-3 text-[10px] uppercase text-[var(--text-secondary)] font-semibold tracking-wider">
            <div>Iteration</div>
            <div>Temperature</div>
            <div>Current Cost</div>
            <div>Best Cost</div>
            <div>Accepted</div>
            <div>Δ Cost</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {annealingTrace.map((snapshot) => {
            const isImprovement = snapshot.deltaCost < 0 && snapshot.accepted;
            const isWorseAccepted = snapshot.deltaCost > 0 && snapshot.accepted;
            const isRejected = !snapshot.accepted;

            return (
              <div
                key={snapshot.iteration}
                className={`grid grid-cols-[80px_100px_100px_100px_80px_100px] gap-2 px-4 py-2 border-b border-[var(--border-subtle)] text-xs items-center transition-colors ${
                  isImprovement
                    ? 'bg-emerald-500/10'
                    : isWorseAccepted
                    ? 'bg-amber-500/10'
                    : isRejected
                    ? 'bg-[var(--bg-input)]/30'
                    : 'hover:bg-[var(--bg-input)]/50'
                }`}
              >
                <div className="text-[var(--text-tertiary)] font-mono">{snapshot.iteration}</div>
                <div className="text-[var(--text-secondary)] font-mono">{snapshot.temperature.toFixed(1)}</div>
                <div className="text-[var(--text-primary)] font-mono">{snapshot.currentCost.toFixed(2)}</div>
                <div className="text-emerald-400 font-mono">{snapshot.bestCost.toFixed(2)}</div>
                <div className="text-[var(--text-primary)]">
                  {snapshot.accepted ? (
                    <span className="text-emerald-400">✓</span>
                  ) : (
                    <span className="text-[var(--text-tertiary)]">✗</span>
                  )}
                </div>
                <div className={`font-mono ${
                  snapshot.deltaCost < 0
                    ? 'text-emerald-400'
                    : snapshot.deltaCost > 0
                    ? 'text-red-400'
                    : 'text-[var(--text-secondary)]'
                }`}>
                  {snapshot.deltaCost < 0 ? '-' : '+'}{Math.abs(snapshot.deltaCost).toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Annealing Trajectory Chart Component
// ============================================================================

interface AnnealingTrajectoryChartProps {
  trace: AnnealingIterationSnapshot[];
}

const AnnealingTrajectoryChart: React.FC<AnnealingTrajectoryChartProps> = ({ trace }) => {
  const width = 800;
  const height = 300;
  const padding = { top: 30, right: 60, bottom: 40, left: 60 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Find min/max for cost scaling
  const allCurrentCosts = trace.map(s => s.currentCost);
  const allBestCosts = trace.map(s => s.bestCost);
  const minCost = Math.min(...allCurrentCosts, ...allBestCosts);
  const maxCost = Math.max(...allCurrentCosts, ...allBestCosts);
  const costRange = maxCost - minCost || 1;

  // Scale functions
  const scaleX = (iteration: number) => {
    const maxIter = Math.max(...trace.map(s => s.iteration));
    return padding.left + (iteration / maxIter) * chartWidth;
  };

  const scaleY = (cost: number) => {
    return padding.top + chartHeight - ((cost - minCost) / costRange) * chartHeight;
  };

  // Generate paths
  const currentCostPath = trace
    .map((snapshot, i) => {
      const x = scaleX(snapshot.iteration);
      const y = scaleY(snapshot.currentCost);
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .join(' ');

  const bestCostPath = trace
    .map((snapshot, i) => {
      const x = scaleX(snapshot.iteration);
      const y = scaleY(snapshot.bestCost);
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .join(' ');

  // Y-axis ticks
  const numYTicks = 5;
  const yTicks = Array.from({ length: numYTicks }, (_, i) => {
    const cost = minCost + (costRange / (numYTicks - 1)) * i;
    return cost;
  });

  // X-axis ticks
  const numXTicks = 6;
  const xTicks = trace.filter((_, i) => {
    const step = Math.floor(trace.length / (numXTicks - 1));
    return i % step === 0 || i === trace.length - 1;
  });

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} className="bg-[var(--bg-card)] rounded-[var(--radius-md)]">
        {/* Grid lines */}
        {yTicks.map(cost => {
          const y = scaleY(cost);
          return (
            <g key={cost}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="var(--border-subtle)"
                strokeWidth="1"
                strokeDasharray="2,2"
                opacity="0.5"
              />
            </g>
          );
        })}

        {/* Y-axis labels */}
        {yTicks.map(cost => {
          const y = scaleY(cost);
          return (
            <g key={`y-label-${cost}`}>
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="var(--text-tertiary)"
              >
                {cost.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* X-axis labels */}
        {xTicks.map(snapshot => {
          const x = scaleX(snapshot.iteration);
          return (
            <g key={`x-label-${snapshot.iteration}`}>
              <line
                x1={x}
                y1={padding.top + chartHeight}
                x2={x}
                y2={padding.top + chartHeight + 5}
                stroke="var(--border-subtle)"
                strokeWidth="1"
              />
              <text
                x={x}
                y={height - padding.bottom + 15}
                textAnchor="middle"
                fontSize="10"
                fill="var(--text-tertiary)"
              >
                {snapshot.iteration}
              </text>
            </g>
          );
        })}

        {/* Best cost line (green, always improving) */}
        <path
          d={bestCostPath}
          fill="none"
          stroke="var(--finger-L2)"
          strokeWidth="2"
          opacity="0.8"
        />

        {/* Current cost line (blue, noisy) */}
        <path
          d={currentCostPath}
          fill="none"
          stroke="var(--finger-R1)"
          strokeWidth="1.5"
          opacity="0.6"
        />

        {/* Data points (sampled) */}
        {trace.map((snapshot, i) => {
          const sampleRate = Math.max(1, Math.floor(trace.length / 200));
          if (i % sampleRate !== 0 && i !== trace.length - 1) return null;
          
          const x = scaleX(snapshot.iteration);
          const y = scaleY(snapshot.currentCost);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="2"
              fill={snapshot.accepted ? "var(--finger-R1)" : "var(--text-tertiary)"}
              opacity={snapshot.accepted ? 0.7 : 0.3}
            />
          );
        })}

        {/* Axis labels */}
        <text
          x={width / 2}
          y={height - 10}
          textAnchor="middle"
          fontSize="11"
          fill="var(--text-secondary)"
          fontWeight="500"
        >
          Iteration
        </text>
        <text
          x={20}
          y={height / 2}
          textAnchor="middle"
          fontSize="11"
          fill="var(--text-secondary)"
          fontWeight="500"
          transform={`rotate(-90, 20, ${height / 2})`}
        >
          Cost
        </text>

        {/* Legend */}
        <g transform={`translate(${padding.left + 10}, ${padding.top + 10})`}>
          <line x1="0" y1="0" x2="30" y2="0" stroke="var(--finger-L2)" strokeWidth="2" opacity="0.8" />
          <text x="35" y="4" fontSize="10" fill="var(--text-primary)">Best Cost</text>
          <line x1="0" y1="15" x2="30" y2="15" stroke="var(--finger-R1)" strokeWidth="1.5" opacity="0.6" />
          <text x="35" y="19" fontSize="10" fill="var(--text-primary)">Current Cost</text>
        </g>
      </svg>
    </div>
  );
};

// ============================================================================
// Annealing Metrics View Component
// ============================================================================

interface AnnealingMetricsViewProps {
  annealingTrace: AnnealingIterationSnapshot[];
}

type MetricViewMode = 'absolute' | 'proportional';

const AnnealingMetricsView: React.FC<AnnealingMetricsViewProps> = ({ annealingTrace }) => {
  const [metricViewMode, setMetricViewMode] = useState<MetricViewMode>('absolute');
  const [visibleMetrics, setVisibleMetrics] = useState({
    movement: true,
    stretch: true,
    drift: true,
    bounce: false,
    fatigue: false,
    crossover: false,
  });
  const [weights, setWeights] = useState({
    movement: 1,
    stretch: 1,
    drift: 1,
    bounce: 1,
    fatigue: 1,
    crossover: 1,
  });
  const [showSyntheticCost, setShowSyntheticCost] = useState(true);

  // Prepare data arrays
  const { iterations, movementSums, stretchSums, driftSums, bounceSums, fatigueSums, crossoverSums, movementShares, stretchShares, driftShares, bounceShares, fatigueShares, crossoverShares, finalSnapshot, bestSnapshot } = useMemo(() => {
    if (!annealingTrace || annealingTrace.length === 0) {
      return {
        iterations: [],
        movementSums: [],
        stretchSums: [],
        driftSums: [],
        bounceSums: [],
        fatigueSums: [],
        crossoverSums: [],
        movementShares: [],
        stretchShares: [],
        driftShares: [],
        bounceShares: [],
        fatigueShares: [],
        crossoverShares: [],
        finalSnapshot: null,
        bestSnapshot: null,
      };
    }

    const iterations = annealingTrace.map(s => s.iteration);
    const movementSums = annealingTrace.map(s => s.movementSum);
    const stretchSums = annealingTrace.map(s => s.stretchSum);
    const driftSums = annealingTrace.map(s => s.driftSum);
    const bounceSums = annealingTrace.map(s => s.bounceSum);
    const fatigueSums = annealingTrace.map(s => s.fatigueSum);
    const crossoverSums = annealingTrace.map(s => s.crossoverSum);

    // Compute shares: use snapshot.movementShare if present, otherwise compute from sums
    const movementShares = annealingTrace.map(s => {
      if (s.movementShare !== undefined) return s.movementShare;
      const totalSum = s.movementSum + s.stretchSum + s.driftSum + s.bounceSum + s.fatigueSum + s.crossoverSum;
      return totalSum > 0 ? s.movementSum / totalSum : 0;
    });
    const stretchShares = annealingTrace.map(s => {
      if (s.stretchShare !== undefined) return s.stretchShare;
      const totalSum = s.movementSum + s.stretchSum + s.driftSum + s.bounceSum + s.fatigueSum + s.crossoverSum;
      return totalSum > 0 ? s.stretchSum / totalSum : 0;
    });
    const driftShares = annealingTrace.map(s => {
      if (s.driftShare !== undefined) return s.driftShare;
      const totalSum = s.movementSum + s.stretchSum + s.driftSum + s.bounceSum + s.fatigueSum + s.crossoverSum;
      return totalSum > 0 ? s.driftSum / totalSum : 0;
    });
    const bounceShares = annealingTrace.map(s => {
      if (s.bounceShare !== undefined) return s.bounceShare;
      const totalSum = s.movementSum + s.stretchSum + s.driftSum + s.bounceSum + s.fatigueSum + s.crossoverSum;
      return totalSum > 0 ? s.bounceSum / totalSum : 0;
    });
    const fatigueShares = annealingTrace.map(s => {
      if (s.fatigueShare !== undefined) return s.fatigueShare;
      const totalSum = s.movementSum + s.stretchSum + s.driftSum + s.bounceSum + s.fatigueSum + s.crossoverSum;
      return totalSum > 0 ? s.fatigueSum / totalSum : 0;
    });
    const crossoverShares = annealingTrace.map(s => {
      if (s.crossoverShare !== undefined) return s.crossoverShare;
      const totalSum = s.movementSum + s.stretchSum + s.driftSum + s.bounceSum + s.fatigueSum + s.crossoverSum;
      return totalSum > 0 ? s.crossoverSum / totalSum : 0;
    });

    const finalSnapshot = annealingTrace[annealingTrace.length - 1] || null;
    const bestSnapshot = annealingTrace.reduce((best, current) => {
      if (!best) return current;
      return current.bestCost < best.bestCost ? current : best;
    }, null as AnnealingIterationSnapshot | null);

    return {
      iterations,
      movementSums,
      stretchSums,
      driftSums,
      bounceSums,
      fatigueSums,
      crossoverSums,
      movementShares,
      stretchShares,
      driftShares,
      bounceShares,
      fatigueShares,
      crossoverShares,
      finalSnapshot,
      bestSnapshot,
    };
  }, [annealingTrace]);

  // Compute synthetic costs
  const syntheticCosts = useMemo(
    () => annealingTrace.map(s => 
      weights.movement * s.movementSum +
      weights.stretch * s.stretchSum +
      weights.drift * s.driftSum +
      weights.bounce * s.bounceSum +
      weights.fatigue * s.fatigueSum +
      weights.crossover * s.crossoverSum
    ),
    [annealingTrace, weights]
  );

  // Empty state
  if (!annealingTrace || annealingTrace.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-2 max-w-md">
          <svg
            className="w-12 h-12 mx-auto text-[var(--text-tertiary)] opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="text-sm text-[var(--text-secondary)]">
            No annealing trace available. Run the solver with simulated annealing to see metric trajectories.
          </p>
        </div>
      </div>
    );
  }

  // Get data arrays based on view mode
  const getMetricData = (metric: string) => {
    if (metricViewMode === 'absolute') {
      switch (metric) {
        case 'movement': return movementSums;
        case 'stretch': return stretchSums;
        case 'drift': return driftSums;
        case 'bounce': return bounceSums;
        case 'fatigue': return fatigueSums;
        case 'crossover': return crossoverSums;
        default: return [];
      }
    } else {
      switch (metric) {
        case 'movement': return movementShares;
        case 'stretch': return stretchShares;
        case 'drift': return driftShares;
        case 'bounce': return bounceShares;
        case 'fatigue': return fatigueShares;
        case 'crossover': return crossoverShares;
        default: return [];
      }
    }
  };

  // Get color for metric
  const getMetricColor = (metric: string): string => {
    switch (metric) {
      case 'movement': return 'var(--finger-L1)';
      case 'stretch': return 'var(--finger-L2)';
      case 'drift': return 'var(--finger-R1)';
      case 'bounce': return 'var(--finger-R2)';
      case 'fatigue': return 'var(--finger-R3)';
      case 'crossover': return 'var(--finger-L3)';
      default: return 'var(--text-primary)';
    }
  };

  // Get max value for scaling
  const allValues = useMemo(() => {
    const values: number[] = [];
    if (visibleMetrics.movement) values.push(...getMetricData('movement'));
    if (visibleMetrics.stretch) values.push(...getMetricData('stretch'));
    if (visibleMetrics.drift) values.push(...getMetricData('drift'));
    if (visibleMetrics.bounce) values.push(...getMetricData('bounce'));
    if (visibleMetrics.fatigue) values.push(...getMetricData('fatigue'));
    if (visibleMetrics.crossover) values.push(...getMetricData('crossover'));
    if (metricViewMode === 'absolute') {
      values.push(...syntheticCosts);
    }
    return values;
  }, [visibleMetrics, metricViewMode, syntheticCosts, movementSums, stretchSums, driftSums, bounceSums, fatigueSums, crossoverSums, movementShares, stretchShares, driftShares, bounceShares, fatigueShares, crossoverShares]);

  const maxValue = Math.max(...allValues, 1);
  const minValue = Math.min(...allValues, 0);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Sub-toggle: Absolute vs Proportional */}
      <div className="flex-none p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMetricViewMode('absolute')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-sm)] transition-all ${
                metricViewMode === 'absolute'
                  ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                  : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Absolute (raw metric sums)
            </button>
            <button
              onClick={() => setMetricViewMode('proportional')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-sm)] transition-all ${
                metricViewMode === 'proportional'
                  ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                  : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Proportional (share of total)
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Chart and Controls */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chart */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chart */}
          <div className="flex-1 p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]">
            <AnnealingMetricsChart
              iterations={iterations}
              movementData={visibleMetrics.movement ? getMetricData('movement') : []}
              stretchData={visibleMetrics.stretch ? getMetricData('stretch') : []}
              driftData={visibleMetrics.drift ? getMetricData('drift') : []}
              bounceData={visibleMetrics.bounce ? getMetricData('bounce') : []}
              fatigueData={visibleMetrics.fatigue ? getMetricData('fatigue') : []}
              crossoverData={visibleMetrics.crossover ? getMetricData('crossover') : []}
              syntheticCosts={metricViewMode === 'absolute' && showSyntheticCost ? syntheticCosts : []}
              minValue={minValue}
              maxValue={maxValue}
              viewMode={metricViewMode}
              getMetricColor={getMetricColor}
            />
          </div>

          {/* Legend with toggles */}
          <div className="flex-none p-4 bg-[var(--bg-card)] border-b border-[var(--border-subtle)]">
            <div className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Metrics</div>
            <div className="flex flex-wrap gap-3">
              {(['movement', 'stretch', 'drift', 'bounce', 'fatigue', 'crossover'] as const).map(metric => (
                <label key={metric} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleMetrics[metric]}
                    onChange={(e) => setVisibleMetrics(prev => ({ ...prev, [metric]: e.target.checked }))}
                    className="w-4 h-4 rounded border-[var(--border-subtle)]"
                  />
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: getMetricColor(metric) }}
                    />
                    <span className="text-xs text-[var(--text-primary)] capitalize">{metric}</span>
                  </div>
                </label>
              ))}
              {metricViewMode === 'absolute' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSyntheticCost}
                    onChange={(e) => setShowSyntheticCost(e.target.checked)}
                    className="w-4 h-4 rounded border-[var(--border-subtle)]"
                  />
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded border-2 border-[var(--text-primary)] border-dashed" />
                    <span className="text-xs text-[var(--text-primary)]">Synthetic Cost</span>
                  </div>
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Right: Summary and Weight Sandbox */}
        <div className="w-96 flex-none bg-[var(--bg-panel)] border-l border-[var(--border-subtle)] flex flex-col overflow-y-auto">
          {/* Metric Summary */}
          <div className="flex-none p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-card)]">
            <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Metric Summary</h3>
            {finalSnapshot && (
              <div className="space-y-2 mb-4">
                <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Final Snapshot</div>
                {(['movement', 'stretch', 'drift', 'bounce', 'fatigue', 'crossover'] as const).map(metric => {
                  const sum = finalSnapshot[`${metric}Sum` as keyof AnnealingIterationSnapshot] as number;
                  const share = finalSnapshot[`${metric}Share` as keyof AnnealingIterationSnapshot] as number | undefined;
                  const totalSum = finalSnapshot.movementSum + finalSnapshot.stretchSum + finalSnapshot.driftSum + 
                                   finalSnapshot.bounceSum + finalSnapshot.fatigueSum + finalSnapshot.crossoverSum;
                  const computedShare = totalSum > 0 ? sum / totalSum : (share ?? 0);
                  return (
                    <div key={metric} className="text-xs">
                      <span className="text-[var(--text-secondary)] capitalize">{metric}:</span>{' '}
                      <span className="font-mono text-[var(--text-primary)]">{sum.toFixed(2)}</span>{' '}
                      <span className="text-[var(--text-tertiary)]">({(computedShare * 100).toFixed(1)}%)</span>
                    </div>
                  );
                })}
              </div>
            )}
            {bestSnapshot && bestSnapshot !== finalSnapshot && (
              <div className="space-y-2">
                <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Best Snapshot</div>
                {(['movement', 'stretch', 'drift', 'bounce', 'fatigue', 'crossover'] as const).map(metric => {
                  const sum = bestSnapshot[`${metric}Sum` as keyof AnnealingIterationSnapshot] as number;
                  const share = bestSnapshot[`${metric}Share` as keyof AnnealingIterationSnapshot] as number | undefined;
                  const totalSum = bestSnapshot.movementSum + bestSnapshot.stretchSum + bestSnapshot.driftSum + 
                                   bestSnapshot.bounceSum + bestSnapshot.fatigueSum + bestSnapshot.crossoverSum;
                  const computedShare = totalSum > 0 ? sum / totalSum : (share ?? 0);
                  return (
                    <div key={metric} className="text-xs">
                      <span className="text-[var(--text-secondary)] capitalize">{metric}:</span>{' '}
                      <span className="font-mono text-[var(--text-primary)]">{sum.toFixed(2)}</span>{' '}
                      <span className="text-[var(--text-tertiary)]">({(computedShare * 100).toFixed(1)}%)</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Weight Sandbox */}
          <div className="flex-1 p-4 bg-[var(--bg-card)]">
            <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Weight Sandbox (no re-run)</h3>
            <p className="text-[10px] text-[var(--text-tertiary)] mb-4 italic">
              Adjust weights to see how they would affect the cost trajectory. This does not re-run the solver.
            </p>
            <div className="space-y-4">
              {(['movement', 'stretch', 'drift', 'bounce', 'fatigue', 'crossover'] as const).map(metric => (
                <div key={metric} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-[var(--text-primary)] capitalize">{metric}</label>
                    <span className="text-xs font-mono text-[var(--text-secondary)]">{weights[metric].toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.1"
                    value={weights[metric]}
                    onChange={(e) => setWeights(prev => ({ ...prev, [metric]: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-[var(--bg-input)] rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, var(--finger-L2) 0%, var(--finger-L2) ${(weights[metric] / 5) * 100}%, var(--bg-input) ${(weights[metric] / 5) * 100}%, var(--bg-input) 100%)`
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Annealing Metrics Chart Component
// ============================================================================

interface AnnealingMetricsChartProps {
  iterations: number[];
  movementData: number[];
  stretchData: number[];
  driftData: number[];
  bounceData: number[];
  fatigueData: number[];
  crossoverData: number[];
  syntheticCosts: number[];
  minValue: number;
  maxValue: number;
  viewMode: MetricViewMode;
  getMetricColor: (metric: string) => string;
}

const AnnealingMetricsChart: React.FC<AnnealingMetricsChartProps> = ({
  iterations,
  movementData,
  stretchData,
  driftData,
  bounceData,
  fatigueData,
  crossoverData,
  syntheticCosts,
  minValue,
  maxValue,
  viewMode,
  getMetricColor,
}) => {
  const width = 800;
  const height = 400;
  const padding = { top: 30, right: 60, bottom: 40, left: 60 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxIter = Math.max(...iterations, 1);
  const valueRange = maxValue - minValue || 1;

  const scaleX = (iteration: number) => padding.left + (iteration / maxIter) * chartWidth;
  const scaleY = (value: number) => padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;

  const generatePath = (data: number[]) => {
    if (data.length === 0) return '';
    return data
      .map((value, i) => {
        const x = scaleX(iterations[i]);
        const y = scaleY(value);
        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
      })
      .join(' ');
  };

  const movementPath = generatePath(movementData);
  const stretchPath = generatePath(stretchData);
  const driftPath = generatePath(driftData);
  const bouncePath = generatePath(bounceData);
  const fatiguePath = generatePath(fatigueData);
  const crossoverPath = generatePath(crossoverData);
  const syntheticPath = generatePath(syntheticCosts);

  // Y-axis ticks
  const numYTicks = 5;
  const yTicks = Array.from({ length: numYTicks }, (_, i) => {
    const value = minValue + (valueRange / (numYTicks - 1)) * i;
    return value;
  });

  // X-axis ticks
  const numXTicks = 6;
  const xTicks = iterations.filter((_, i) => {
    const step = Math.floor(iterations.length / (numXTicks - 1));
    return i % step === 0 || i === iterations.length - 1;
  });

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} className="bg-[var(--bg-card)] rounded-[var(--radius-md)]">
        {/* Grid lines */}
        {yTicks.map(value => {
          const y = scaleY(value);
          return (
            <g key={value}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="var(--border-subtle)"
                strokeWidth="1"
                strokeDasharray="2,2"
                opacity="0.5"
              />
            </g>
          );
        })}

        {/* Y-axis labels */}
        {yTicks.map(value => {
          const y = scaleY(value);
          return (
            <g key={`y-label-${value}`}>
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="var(--text-tertiary)"
              >
                {value.toFixed(viewMode === 'proportional' ? 2 : 1)}
              </text>
            </g>
          );
        })}

        {/* X-axis labels */}
        {xTicks.map(iteration => {
          const x = scaleX(iteration);
          return (
            <g key={`x-label-${iteration}`}>
              <line
                x1={x}
                y1={padding.top + chartHeight}
                x2={x}
                y2={padding.top + chartHeight + 5}
                stroke="var(--border-subtle)"
                strokeWidth="1"
              />
              <text
                x={x}
                y={height - padding.bottom + 15}
                textAnchor="middle"
                fontSize="10"
                fill="var(--text-tertiary)"
              >
                {iteration}
              </text>
            </g>
          );
        })}

        {/* Metric lines */}
        {movementData.length > 0 && (
          <path
            d={movementPath}
            fill="none"
            stroke={getMetricColor('movement')}
            strokeWidth="2"
            opacity="0.8"
          />
        )}
        {stretchData.length > 0 && (
          <path
            d={stretchPath}
            fill="none"
            stroke={getMetricColor('stretch')}
            strokeWidth="2"
            opacity="0.8"
          />
        )}
        {driftData.length > 0 && (
          <path
            d={driftPath}
            fill="none"
            stroke={getMetricColor('drift')}
            strokeWidth="2"
            opacity="0.8"
          />
        )}
        {bounceData.length > 0 && (
          <path
            d={bouncePath}
            fill="none"
            stroke={getMetricColor('bounce')}
            strokeWidth="2"
            opacity="0.8"
          />
        )}
        {fatigueData.length > 0 && (
          <path
            d={fatiguePath}
            fill="none"
            stroke={getMetricColor('fatigue')}
            strokeWidth="2"
            opacity="0.8"
          />
        )}
        {crossoverData.length > 0 && (
          <path
            d={crossoverPath}
            fill="none"
            stroke={getMetricColor('crossover')}
            strokeWidth="2"
            opacity="0.8"
          />
        )}

        {/* Synthetic cost line (dashed) */}
        {syntheticCosts.length > 0 && (
          <path
            d={syntheticPath}
            fill="none"
            stroke="var(--text-primary)"
            strokeWidth="2"
            strokeDasharray="4,4"
            opacity="0.6"
          />
        )}

        {/* Axis labels */}
        <text
          x={width / 2}
          y={height - 10}
          textAnchor="middle"
          fontSize="11"
          fill="var(--text-secondary)"
          fontWeight="500"
        >
          Iteration
        </text>
        <text
          x={20}
          y={height / 2}
          textAnchor="middle"
          fontSize="11"
          fill="var(--text-secondary)"
          fontWeight="500"
          transform={`rotate(-90, 20, ${height / 2})`}
        >
          {viewMode === 'absolute' ? 'Metric Sum' : 'Share of Total'}
        </text>
      </svg>
    </div>
  );
};

