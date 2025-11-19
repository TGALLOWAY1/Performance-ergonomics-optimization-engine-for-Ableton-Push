import { Midi } from '@tonejs/midi';
import { Performance, NoteEvent, InstrumentConfig } from '../types/performance';
import { GridMapService } from '../engine/gridMapService';

/**
 * Parses a MIDI file and converts it into a Performance object.
 * Also analyzes notes to check if they fall within the 8x8 grid view.
 * 
 * @param file The MIDI file to parse
 * @param config The instrument configuration to check against (for out-of-bounds detection)
 * @returns A Promise resolving to the parsed Performance object
 */
export const parseMidiFile = async (
  file: File,
  config: InstrumentConfig
): Promise<Performance> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        if (!e.target?.result) {
          throw new Error('Failed to read file');
        }

        const midiData = new Midi(e.target.result as ArrayBuffer);
        const events: NoteEvent[] = [];
        let outOfBoundsCount = 0;

        // Iterate through all tracks
        midiData.tracks.forEach((track) => {
          track.notes.forEach((note) => {
            const noteNumber = note.midi;
            
            // Check if note is within the 8x8 grid
            const position = GridMapService.getPositionForNote(noteNumber, config);
            if (!position) {
              outOfBoundsCount++;
              console.warn(`Note ${noteNumber} (${note.name}) is out of bounds for current config.`);
            }

            events.push({
              noteNumber: noteNumber,
              startTime: note.time,
              duration: note.duration,
              velocity: Math.round(note.velocity * 127), // Convert 0-1 to 0-127
              channel: track.channel + 1 // Convert 0-15 to 1-16
            });
          });
        });

        // Sort events by start time
        events.sort((a, b) => a.startTime - b.startTime);

        if (outOfBoundsCount > 0) {
          console.warn(`Imported MIDI contains ${outOfBoundsCount} notes outside the 8x8 grid view.`);
        }

        // Determine tempo (use the first tempo event or default to 120)
        const tempo = midiData.header.tempos.length > 0 
          ? Math.round(midiData.header.tempos[0].bpm) 
          : 120;

        resolve({
          events,
          tempo,
          name: file.name.replace(/\.[^/.]+$/, "") // Remove extension
        });

      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

