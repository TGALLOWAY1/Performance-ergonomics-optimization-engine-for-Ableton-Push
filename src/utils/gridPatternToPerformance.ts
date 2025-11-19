import { GridPattern } from '../types/gridPattern';
import { InstrumentConfig, Performance, NoteEvent } from '../types/performance';
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
          
          events.push({
            noteNumber,
            startTime,
            duration: stepDuration, // Default duration is one step
            velocity: 100, // Default velocity
            channel: 1
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

