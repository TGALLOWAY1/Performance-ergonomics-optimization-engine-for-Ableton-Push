import { Midi } from '@tonejs/midi';
import { Performance, NoteEvent } from '../types/performance';
import { InstrumentConfig } from '../data/models';
import { GridMapService } from '../engine/gridMapService';
import { SoundAsset } from '../types/layout';
import { generateId } from './performanceUtils';

/**
 * Result type for MIDI import with unmapped Voice count.
 * 
 * TERMINOLOGY (see TERMINOLOGY.md):
 * - Voice: A unique MIDI pitch (e.g., MIDI Note 36)
 * - Cell: A slot in the 128 Drum Rack (Index 0-127)
 * - Pad: A specific x/y coordinate on the 8x8 grid
 */
export interface MidiImportResult {
  performance: Performance;
  unmappedNoteCount: number;
  /** Minimum Voice (Cell/MIDI note number) found in the MIDI file (for intelligent root note logic) */
  minNoteNumber: number | null;
}

/**
 * Parses a MIDI file and converts it into a Performance object.
 * 
 * Also analyzes Voices (MIDI pitches) to check if they can be mapped to Pads via the Voice-to-Pad Assignment.
 * 
 * @param file The MIDI file to parse
 * @param config The instrument configuration defining the Voice-to-Pad Assignment mapping
 * @returns A Promise resolving to the parsed Performance object and unmapped Voice count
 */
export const parseMidiFile = async (
  file: File,
  config: InstrumentConfig
): Promise<MidiImportResult> => {
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
            
        // Check if Voice (Cell/MIDI note) can be mapped to a Pad via Voice-to-Pad Assignment
        const position = GridMapService.noteToGrid(noteNumber, config);
        if (!position) {
          outOfBoundsCount++;
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

        // Determine tempo (use the first tempo event or default to 120)
        const tempo = midiData.header.tempos.length > 0 
          ? Math.round(midiData.header.tempos[0].bpm) 
          : 120;

        // Find minimum note number for intelligent root note logic
        const minNote = events.length > 0 
          ? Math.min(...events.map(e => e.noteNumber))
          : null;

        // W3: Return performance with unmapped note count
        resolve({
          performance: {
            events,
            tempo,
            name: file.name.replace(/\.[^/.]+$/, "") // Remove extension
          },
          unmappedNoteCount: outOfBoundsCount,
          minNoteNumber: minNote
        });

      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Processes multiple MIDI files and extracts unique Voices (one per unique MIDI pitch).
 * 
 * Applies smart naming heuristics based on the number of unique Voices found.
 * Each Voice is stored as a SoundAsset (deprecated alias for Voice).
 * 
 * TERMINOLOGY (see TERMINOLOGY.md):
 * - Voice: A unique MIDI pitch (e.g., MIDI Note 36) - stored as SoundAsset
 * 
 * @param files Array of MIDI files to process
 * @returns Promise resolving to a flat array of Voice objects (as SoundAsset)
 */
export const processMidiFiles = async (files: File[]): Promise<SoundAsset[]> => {
  const allAssets: SoundAsset[] = [];

  // Process each file
  for (const file of files) {
    try {
      // Read and parse MIDI file
      const midiData = await new Promise<Midi>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            if (!e.target?.result) {
              throw new Error('Failed to read file');
            }
            const midi = new Midi(e.target.result as ArrayBuffer);
            resolve(midi);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
      });

      // Extract all unique Voices (MIDI pitch values) from all tracks
      const uniquePitches = new Set<number>();
      midiData.tracks.forEach((track) => {
        track.notes.forEach((note) => {
          uniquePitches.add(note.midi);
        });
      });

      const uniquePitchesArray = Array.from(uniquePitches).sort((a, b) => a - b);
      const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension

      // Apply naming heuristic
      if (uniquePitchesArray.length === 1) {
        // Single Voice: use filename
        const asset: SoundAsset = {
          id: generateId('sound'),
          name: fileName,
          sourceType: 'midi_track',
          sourceFile: file.name,
          originalMidiNote: uniquePitchesArray[0],
          color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
        };
        allAssets.push(asset);
      } else if (uniquePitchesArray.length > 1) {
        // Multiple Voices: use filename with index
        uniquePitchesArray.forEach((pitch, index) => {
          const asset: SoundAsset = {
            id: generateId('sound'),
            name: `${fileName} ${index + 1}`,
            sourceType: 'midi_track',
            sourceFile: file.name,
            originalMidiNote: pitch,
            color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
          };
          allAssets.push(asset);
        });
      }
      // If no pitches found, skip this file (empty MIDI file)
      // If no pitches found, skip this file (empty MIDI file)
    } catch (err) {
      console.error(`Failed to process file ${file.name}:`, err);
      // Continue processing other files even if one fails
    }
  }

  return allAssets;
};

/**
 * Fetches a MIDI file from a URL and parses it into a Performance object.
 * 
 * Used for automatically loading test MIDI files during development.
 * 
 * @param url The URL or path to the MIDI file
 * @param config The instrument configuration defining the Voice-to-Pad Assignment mapping
 * @returns A Promise resolving to the parsed Performance object and unmapped Voice count
 */
export const fetchAndParseMidiFile = async (
  url: string,
  config: InstrumentConfig
): Promise<MidiImportResult> => {
  try {
    // Try multiple possible paths for the test MIDI file
    // Note: In Vite, static files must be in the public folder to be served
    // The TEST DATA folder should be copied to public/TEST DATA
    const possiblePaths = [
      `/TEST DATA/Scenario 1 Tests/${url}`, // Public folder path (most likely)
      `/${url}`, // Root path (public folder in Vite)
      url, // Direct path
      `./TEST DATA/Scenario 1 Tests/${url}`, // Relative path (fallback)
    ];

    let response: Response | null = null;
    let lastError: Error | null = null;

    // Try each path until one works
    for (const path of possiblePaths) {
      try {
        response = await fetch(path);
        if (response.ok) {
          break;
        }
      } catch (err) {
        lastError = err as Error;
        continue;
      }
    }

    if (!response || !response.ok) {
      throw new Error(`Failed to fetch MIDI file: ${url}. Tried paths: ${possiblePaths.join(', ')}. ${lastError?.message || ''}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const midiData = new Midi(arrayBuffer);
    const events: NoteEvent[] = [];
    let unmappedNoteCount = 0;

    // Track unique out-of-bounds notes to avoid spam
    const outOfBoundsNotes = new Set<number>();
    
    // Iterate through all tracks
    midiData.tracks.forEach((track) => {
      track.notes.forEach((note) => {
        const noteNumber = note.midi;

        // Check if note is within the 8x8 grid
        const position = GridMapService.noteToGrid(noteNumber, config);
        if (!position) {
          unmappedNoteCount++;
          outOfBoundsNotes.add(noteNumber);
        }

        events.push({
          noteNumber: noteNumber,
          startTime: note.time,
        });
      });
    });

    // Log out-of-bounds notes once (batch warning)
    if (outOfBoundsNotes.size > 0) {
      const notesList = Array.from(outOfBoundsNotes).sort((a, b) => a - b).join(', ');
      console.warn(
        `${unmappedNoteCount} note event(s) are out of bounds for current config (bottomLeftNote: ${config.bottomLeftNote}). ` +
        `Unmapped note numbers: ${notesList}`
      );
    }

    // Sort events by start time
    events.sort((a, b) => a.startTime - b.startTime);

    // Determine tempo (use the first tempo event or default to 120)
    const tempo = midiData.header.tempos.length > 0
      ? Math.round(midiData.header.tempos[0].bpm)
      : 120;

    // Find minimum note number for intelligent root note logic
    const minNote = events.length > 0 
      ? Math.min(...events.map(e => e.noteNumber))
      : null;

    return {
      performance: {
        events,
        tempo,
        name: url.replace(/\.[^/.]+$/, "") // Remove extension
      },
      unmappedNoteCount,
      minNoteNumber: minNote
    };
  } catch (err) {
    console.error(`Failed to fetch and parse MIDI file from ${url}:`, err);
    throw err;
  }
};

