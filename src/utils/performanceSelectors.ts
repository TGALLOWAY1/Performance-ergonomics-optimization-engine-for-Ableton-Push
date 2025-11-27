/**
 * Performance selector utilities for filtering and processing Performance data.
 */

import { ProjectState, LayoutSnapshot } from '../types/projectState';
import { Performance } from '../types/performance';

/**
 * Selector: Returns the active Performance with ignored notes filtered out.
 * 
 * @param state - The current ProjectState
 * @returns A new Performance object containing only NoteEvents whose noteNumber is NOT in ignoredNoteNumbers,
 *          or null if no active layout exists
 */
export function getActivePerformance(state: ProjectState): Performance | null {
  const activeLayout = state.layouts.find(l => l.id === state.activeLayoutId);
  
  if (!activeLayout || !activeLayout.performance) {
    return null;
  }

  // Safety Check: Default ignoredNoteNumbers to empty array if undefined
  const ignoredNoteNumbers = state.ignoredNoteNumbers || [];

  // Filter Logic: Return only events whose noteNumber is NOT in ignoredNoteNumbers
  const filteredEvents = activeLayout.performance.events.filter(
    e => !ignoredNoteNumbers.includes(e.noteNumber)
  );

  return {
    ...activeLayout.performance,
    events: filteredEvents,
  };
}

/**
 * Gets the raw (unfiltered) active Performance.
 * Useful for operations that need to see all notes regardless of visibility.
 * 
 * @param state - The current ProjectState
 * @returns The raw Performance object from the active layout, or null if no active layout exists
 */
export function getRawActivePerformance(state: ProjectState): Performance | null {
  const activeLayout = state.layouts.find(l => l.id === state.activeLayoutId);
  
  // DEBUG: Log selector state
  if (!activeLayout) {
    console.warn('[getRawActivePerformance] No active layout found:', {
      activeLayoutId: state.activeLayoutId,
      availableLayoutIds: state.layouts.map(l => l.id),
    });
    return null;
  }
  
  if (!activeLayout.performance) {
    console.warn('[getRawActivePerformance] Active layout has no performance:', {
      layoutId: activeLayout.id,
      layoutName: activeLayout.name,
    });
    return null;
  }

  // DEBUG: Log performance events count
  const eventsCount = activeLayout.performance.events?.length || 0;
  console.log('[getRawActivePerformance] Found performance:', {
    layoutId: activeLayout.id,
    layoutName: activeLayout.name,
    eventsCount: eventsCount,
    hasEvents: eventsCount > 0,
    performanceId: activeLayout.performance.id,
    performanceName: activeLayout.performance.name,
  });

  return activeLayout.performance;
}

