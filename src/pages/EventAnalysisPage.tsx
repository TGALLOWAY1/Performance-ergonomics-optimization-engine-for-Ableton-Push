/**
 * Event Analysis Page
 *
 * Dedicated full-screen page for detailed event-by-event analysis with
 * timeline, onion skin visualization, and transition metrics.
 * Uses shared useSongStateHydration for single-path hydration (no page-specific load).
 */

import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { EventAnalysisPanel } from '../workbench/EventAnalysisPanel';
import { getActivePerformance } from '../utils/performanceSelectors';
import { useSongStateHydration } from '../hooks/useSongStateHydration';
import { FingerType } from '../engine/models';

export const EventAnalysisPage: React.FC = () => {
  const {
    projectState,
    engineResult,
    setProjectState,
  } = useProject();

  const [searchParams] = useSearchParams();
  const songId = searchParams.get('songId');

  const { hasLoadedSong } = useSongStateHydration(songId);

  const activeLayout = useMemo(() =>
    projectState.layouts.find(l => l.id === projectState.activeLayoutId) || null,
    [projectState.layouts, projectState.activeLayoutId]
  );

  const performance = useMemo(() => getActivePerformance(projectState), [projectState]);



  // Handler for manual assignment changes (from Event Log)
  const handleAssignmentChange = React.useCallback((eventKey: string, hand: 'left' | 'right', finger: FingerType) => {
    if (!projectState.activeLayoutId) return;

    setProjectState(prev => {
      const currentLayoutId = prev.activeLayoutId!;
      const existingAssignments = prev.manualAssignments?.[currentLayoutId] || {};

      return {
        ...prev,
        manualAssignments: {
          ...prev.manualAssignments,
          [currentLayoutId]: {
            ...existingAssignments,
            [eventKey]: { hand, finger }
          }
        }
      };
    });
  }, [projectState.activeLayoutId, setProjectState]);

  // Build workbench link with songId if present
  const workbenchLink = songId ? `/workbench?songId=${songId}` : '/workbench';
  const dashboardLink = '/';

  // Calculate difficulty summary for header
  const difficultySummary = useMemo(() => {
    if (!engineResult) return null;
    const totalEvents = engineResult.debugEvents.length;
    const playableEvents = totalEvents - engineResult.unplayableCount;
    const hardPercent = totalEvents > 0 ? Math.round((engineResult.hardCount / totalEvents) * 100) : 0;
    const unplayablePercent = totalEvents > 0 ? Math.round((engineResult.unplayableCount / totalEvents) * 100) : 0;
    return {
      totalEvents,
      playableEvents,
      hardCount: engineResult.hardCount,
      unplayableCount: engineResult.unplayableCount,
      hardPercent,
      unplayablePercent,
      score: engineResult.score,
    };
  }, [engineResult]);

  // Loading: wait for shared hydration when songId is in URL
  if (songId && !hasLoadedSong) {
    return (
      <div className="h-screen w-screen flex flex-col bg-[var(--bg-app)] text-[var(--text-primary)] items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mb-4" />
        <p className="text-[var(--text-secondary)]">Loading song data...</p>
      </div>
    );
  }

  // Empty state: no data available (after hydration)
  if (!engineResult || !performance || performance.events.length === 0) {
    return (
      <div className="h-screen w-screen flex flex-col bg-[var(--bg-app)] text-[var(--text-primary)] items-center justify-center">
        <div className="max-w-md text-center space-y-4 p-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Event Analysis</h1>
          <p className="text-[var(--text-secondary)]">
            {!performance || performance.events.length === 0
              ? 'No performance data available. Open a song in the Workbench and import MIDI data.'
              : !engineResult
                ? 'Engine analysis not available. The solver needs to run first.'
                : 'No events to analyze.'}
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
            <h1 className="text-xl font-bold tracking-tight">Event Analysis</h1>
            <div className="flex items-center gap-2">
              {performance?.name && (
                <span className="text-[10px] text-[var(--text-secondary)] font-medium tracking-wider uppercase">
                  {performance.name}
                </span>
              )}
              {difficultySummary && (
                <>
                  {performance?.name && <span className="text-[var(--text-tertiary)]">•</span>}
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    Score: <span className={`font-semibold ${difficultySummary.score >= 80 ? 'text-emerald-400' : difficultySummary.score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{difficultySummary.score}</span>
                    {difficultySummary.hardCount > 0 && (
                      <span className="ml-2 text-amber-400">{difficultySummary.hardCount} hard</span>
                    )}
                    {difficultySummary.unplayableCount > 0 && (
                      <span className="ml-2 text-red-400">{difficultySummary.unplayableCount} unplayable</span>
                    )}
                  </span>
                </>
              )}
            </div>
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
        </div>
      </div>

      {/* Main Content: EventAnalysisPanel takes full screen */}
      <div className="flex-1 overflow-hidden">
        <EventAnalysisPanel
          engineResult={engineResult}
          performance={performance}
          onAssignmentChange={handleAssignmentChange}
        />
      </div>
    </div>
  );
};

