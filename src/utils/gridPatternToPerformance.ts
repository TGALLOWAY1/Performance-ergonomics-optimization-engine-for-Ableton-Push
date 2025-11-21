import { GridPattern } from '../types/gridPattern';
import { Performance, NoteEvent } from '../types/performance';
import { InstrumentConfig } from '../types/performance';
import { GridMapService } from '../engine/gridMapService';

/**
 * Converts a GridPattern (step sequencer data) into a linear Performance object (MIDI events).
 * Assumes 16th note steps.
 * 
 * @param pattern The source grid pattern
 * @param config The instrument configuration for note mapping
 * @param tempo The project tempo in BPM
 * @returns A Performance object containing the generated note events
 */
export const gridPatternToPerformance = (
  pattern: GridPattern,
  config: InstrumentConfig,
  tempo: number
): Performance => {
  const events: NoteEvent[] = [];
  
  // Calculate duration of a 16th note in seconds
  // 60 seconds / BPM = seconds per beat (quarter note)
  // seconds per beat / 4 = seconds per 16th note
  const stepDuration = (60 / tempo) / 4;

  // Iterate through each step
  for (let stepIndex = 0; stepIndex < pattern.length; stepIndex++) {
    const stepGrid = pattern.steps[stepIndex];
    const startTime = stepIndex * stepDuration;

    // Iterate through the 8x8 grid
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        // If pad is active
        if (stepGrid[row][col]) {
          const noteNumber = GridMapService.getNoteForPosition(row, col, config);
          
          // W5: NoteEvent simplified - no duration field
          events.push({
            noteNumber,
            startTime,
          });
        }
      }
    }
  }

  // Sort events by startTime (though they should already be sorted by nature of the loop)
  events.sort((a, b) => a.startTime - b.startTime);

  return {
    events,
    tempo,
    name: 'Generated Performance'
  };
};

/**
 * W5: Converts a Performance object (MIDI events) into a GridPattern (step sequencer data).
 * Uses the active InstrumentConfig to map notes to grid positions.
 * 
 * @param performance The source performance with note events
 * @param config The instrument configuration for note mapping
 * @param tempo The project tempo in BPM
 * @param minSteps Minimum number of steps in the pattern (default: 64)
 * @returns A GridPattern object containing the step sequencer data
 */
export const performanceToGridPattern = (
  performance: Performance,
  config: InstrumentConfig,
  tempo: number,
  minSteps: number = 64
): GridPattern => {
  // Calculate duration of a 16th note in seconds
  const stepDuration = (60 / tempo) / 4;
  
  // Calculate required pattern length from latest event
  const latestEvent = performance.events.length > 0
    ? performance.events.reduce((latest, event) => 
        event.startTime > latest.startTime ? event : latest
      )
    : null;
  
  const maxStep = latestEvent
    ? Math.ceil(latestEvent.startTime / stepDuration)
    : 0;
  
  const patternLength = Math.max(minSteps, Math.ceil(maxStep / 16) * 16); // Round up to nearest measure
  
  // Initialize empty pattern
  const steps: boolean[][][] = [];
  for (let stepIndex = 0; stepIndex < patternLength; stepIndex++) {
    const stepGrid: boolean[][] = [];
    for (let row = 0; row < 8; row++) {
      stepGrid[row] = new Array(8).fill(false);
    }
    steps.push(stepGrid);
  }
  
  // Map each event to a grid position and step
  performance.events.forEach(event => {
    const stepIndex = Math.round(event.startTime / stepDuration);
    if (stepIndex >= 0 && stepIndex < patternLength) {
      const pos = GridMapService.noteToGrid(event.noteNumber, config);
      if (pos) {
        const [row, col] = pos;
        steps[stepIndex][row][col] = true;
      }
    }
  });
  
  return {
    steps,
    length: patternLength
  };
};

