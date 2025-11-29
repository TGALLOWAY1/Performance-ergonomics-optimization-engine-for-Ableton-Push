/**
 * Event Analysis Page
 * 
 * Dedicated full-screen page for detailed event-by-event analysis with
 * timeline, onion skin visualization, and transition metrics.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { EventAnalysisPanel } from '../workbench/EventAnalysisPanel';
import { getActivePerformance } from '../utils/performanceSelectors';
import { songService } from '../services/SongService';
import { BiomechanicalSolver } from '../engine/core';
import { FingerType } from '../engine/models';

export const EventAnalysisPage: React.FC = () => {
  const {
    projectState,
    setProjectState,
    engineResult,
    setEngineResult,
  } = useProject();

  const [searchParams] = useSearchParams();
  const songId = searchParams.get('songId');
  const [songName, setSongName] = useState<string | null>(null);
  const [hasLoadedSong, setHasLoadedSong] = useState(false);

  // Get active layout and performance
  const activeLayout = useMemo(() =>
    projectState.layouts.find(l => l.id === projectState.activeLayoutId) || null,
    [projectState.layouts, projectState.activeLayoutId]
  );

  const performance = useMemo(() => getActivePerformance(projectState), [projectState]);

  // Get active mapping for engine
  const activeMapping = useMemo(() =>
    projectState.mappings.length > 0 ? projectState.mappings[0] : null,
    [projectState.mappings]
  );

  // Load song state when navigating with songId (same logic as Workbench/Timeline)
  useEffect(() => {
    if (!songId) {
      setHasLoadedSong(true);
      return;
    }

    // Get song metadata for display
    const song = songService.getSong(songId);
    if (song) {
      setSongName(song.metadata.title);
    }

    // Check if the current projectState has MEANINGFUL data (not just the default initial state)
    const hasVoices = projectState.parkedSounds.length > 0;
    const hasMappingCells = projectState.mappings.some(m => Object.keys(m.cells).length > 0);
    const hasRealData = hasVoices || hasMappingCells;

    // Load from storage if no real data (page refresh scenario)
    if (!hasRealData) {
      console.log('[EventAnalysisPage] No data in context, loading from storage for song:', songId);

      const savedState = songService.loadSongState(songId);
      if (savedState) {
        console.log('[EventAnalysisPage] Loaded saved project state:', {
          layoutsCount: savedState.layouts.length,
          parkedSoundsCount: savedState.parkedSounds.length,
          mappingsCount: savedState.mappings.length,
          voiceNames: savedState.parkedSounds.map(v => v.name),
        });
        setProjectState(savedState, true); // Skip history on load
      } else {
        console.log('[EventAnalysisPage] No saved state found for song:', songId);
      }
    } else {
      console.log('[EventAnalysisPage] Using existing data in context');
    }

    setHasLoadedSong(true);
  }, [songId, setProjectState]);

  // Run engine when layout/mapping changes (similar to Workbench)
  useEffect(() => {
    if (!performance || !activeMapping || !hasLoadedSong) {
      return;
    }

    // Debounce engine execution (300ms)
    const timer = setTimeout(() => {
      try {
        // Get manual assignments for current layout
        const currentLayoutId = projectState.activeLayoutId;
        const manualAssignments = currentLayoutId && projectState.manualAssignments
          ? projectState.manualAssignments[currentLayoutId]
          : undefined;

        // Convert string keys to numbers for the engine
        const parsedAssignments: Record<number, { hand: 'left' | 'right', finger: FingerType }> = {};
        if (manualAssignments) {
          Object.entries(manualAssignments).forEach(([key, value]) => {
            parsedAssignments[parseInt(key, 10)] = value;
          });
        }

        const solver = new BiomechanicalSolver(projectState.instrumentConfig, activeMapping);
        const result = solver.solve(performance, parsedAssignments);

        console.log('[EventAnalysisPage] Engine result generated:', {
          score: result.score,
          hardCount: result.hardCount,
          unplayableCount: result.unplayableCount,
          debugEventsCount: result.debugEvents.length,
        });

        setEngineResult(result);
      } catch (err) {
        console.error('[EventAnalysisPage] Engine execution failed:', err);
        setEngineResult(null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [
    activeMapping?.id,
    activeMapping?.cells,
    performance?.events,
    projectState.instrumentConfig,
    projectState.ignoredNoteNumbers,
    projectState,
    hasLoadedSong,
    setEngineResult,
  ]);

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

  // Empty state: no data available
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
        />
      </div>
    </div>
  );
};

