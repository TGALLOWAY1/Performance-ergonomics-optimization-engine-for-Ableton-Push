/**
 * Event Export Utilities
 * 
 * Functions to export event analysis data to JSON format for download.
 * Supports exporting all events, hard transitions, and practice loop settings.
 */

import type { AnalyzedEvent, Transition } from '../types/eventAnalysis';

/**
 * Export all analyzed events and transitions to JSON
 * 
 * @param events - Array of analyzed events
 * @param transitions - Array of transitions between events
 * @returns JSON string ready for download
 */
export function exportAllEventsToJson(
  events: AnalyzedEvent[],
  transitions: Transition[]
): string {
  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    metadata: {
      totalEvents: events.length,
      totalTransitions: transitions.length,
    },
    events: events.map(event => ({
      index: event.eventIndex,
      timestamp: event.timestamp,
      polyphony: event.eventMetrics?.polyphony || event.notes.length,
      pads: event.pads,
      notes: event.notes.map(note => ({
        noteNumber: note.debugEvent.noteNumber,
        startTime: note.debugEvent.startTime,
        assignedHand: note.debugEvent.assignedHand,
        finger: note.debugEvent.finger,
        row: note.debugEvent.row,
        col: note.debugEvent.col,
        pad: note.pad,
        cost: note.debugEvent.cost,
        difficulty: note.debugEvent.difficulty,
        costBreakdown: note.debugEvent.costBreakdown,
      })),
      eventMetrics: event.eventMetrics,
    })),
    transitions: transitions.map(transition => ({
      fromIndex: transition.fromIndex,
      toIndex: transition.toIndex,
      metrics: {
        timeDeltaMs: transition.metrics.timeDeltaMs,
        gridDistance: transition.metrics.gridDistance,
        handSwitch: transition.metrics.handSwitch,
        fingerChange: transition.metrics.fingerChange,
        speedPressure: transition.metrics.speedPressure,
        anatomicalStretchScore: transition.metrics.anatomicalStretchScore,
        compositeDifficultyScore: transition.metrics.compositeDifficultyScore,
      },
      fromEventIndex: transition.fromEvent.eventIndex,
      toEventIndex: transition.toEvent.eventIndex,
      fromEventPolyphony: transition.fromEvent.eventMetrics?.polyphony || transition.fromEvent.notes.length,
      toEventPolyphony: transition.toEvent.eventMetrics?.polyphony || transition.toEvent.notes.length,
    })),
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Export hard transitions (above difficulty threshold) to JSON
 * 
 * @param transitions - Array of transitions
 * @param threshold - Difficulty threshold (0-1), defaults to 0.7
 * @returns JSON string ready for download
 */
export function exportHardTransitionsToJson(
  transitions: Transition[],
  threshold = 0.7
): string {
  const hardTransitions = transitions.filter(
    t => t.metrics.compositeDifficultyScore >= threshold
  );

  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    metadata: {
      threshold,
      totalTransitions: transitions.length,
      hardTransitionsCount: hardTransitions.length,
    },
    hardTransitions: hardTransitions.map(transition => ({
      fromIndex: transition.fromIndex,
      toIndex: transition.toIndex,
      difficultyScore: transition.metrics.compositeDifficultyScore,
      metrics: {
        timeDeltaMs: transition.metrics.timeDeltaMs,
        gridDistance: transition.metrics.gridDistance,
        handSwitch: transition.metrics.handSwitch,
        fingerChange: transition.metrics.fingerChange,
        speedPressure: transition.metrics.speedPressure,
        anatomicalStretchScore: transition.metrics.anatomicalStretchScore,
      },
      fromEvent: {
        eventIndex: transition.fromEvent.eventIndex,
        timestamp: transition.fromEvent.timestamp,
        polyphony: transition.fromEvent.eventMetrics?.polyphony || transition.fromEvent.notes.length,
        pads: transition.fromEvent.pads,
        notes: transition.fromEvent.notes.map(note => ({
          noteNumber: note.debugEvent.noteNumber,
          pad: note.pad,
          hand: note.debugEvent.assignedHand,
          finger: note.debugEvent.finger,
        })),
      },
      toEvent: {
        eventIndex: transition.toEvent.eventIndex,
        timestamp: transition.toEvent.timestamp,
        polyphony: transition.toEvent.eventMetrics?.polyphony || transition.toEvent.notes.length,
        pads: transition.toEvent.pads,
        notes: transition.toEvent.notes.map(note => ({
          noteNumber: note.debugEvent.noteNumber,
          pad: note.pad,
          hand: note.debugEvent.assignedHand,
          finger: note.debugEvent.finger,
        })),
      },
    })),
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Export practice loop settings to JSON
 * 
 * @param selectedEventIndex - Currently selected event index
 * @param speeds - Array of available speed options
 * @returns JSON string ready for download
 */
export function exportPracticeLoopSettingsToJson(
  selectedEventIndex: number | null,
  speeds: number[]
): string {
  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    practiceLoopSettings: {
      selectedEventIndex,
      availableSpeeds: speeds,
      defaultSpeed: 1.0,
    },
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Helper function to trigger a file download
 * 
 * @param content - File content (string)
 * @param filename - Filename for download
 */
export function downloadJsonFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

