import { Midi } from '@tonejs/midi';
import { Performance, NoteEvent, InstrumentConfig } from '../types/performance';
import { GridMapService } from '../engine/gridMapService';
import { Voice, GridMapping } from '../types/layout';
import { generateId } from './performanceUtils';
import { cellKey } from '../types/layout';

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
 * Complete project data structure returned from parseMidiProject.
 * Contains all consolidated types needed to initialize a project.
 */
export interface MidiProjectData {
  /** The parsed performance with all note events */
  performance: Performance;
  /** Unique voices extracted from the MIDI file */
  voices: Voice[];
  /** Instrument configuration with intelligent root note adjustment */
  instrumentConfig: InstrumentConfig;

  /** Initial grid mapping with voice assignments */
  gridMapping: GridMapping;
  /** Minimum note number found (for root note adjustment) */
  minNoteNumber: number | null;
  /** Count of notes that were out of bounds before root note adjustment */
  unmappedNoteCount: number;
}

/**
 * Parses a MIDI file from ArrayBuffer and creates a complete project structure.
 * This is the unified entry point for MIDI import that returns all consolidated types.
 * 
 * @param arrayBuffer - The MIDI file as ArrayBuffer
 * @param fileName - Optional file name for naming
 * @param existingConfig - Optional existing instrument config to use as base
 * @returns Complete project data structure
 */
export async function parseMidiProject(
  arrayBuffer: ArrayBuffer,
  fileName?: string,
  existingConfig?: InstrumentConfig
): Promise<MidiProjectData> {
  const midiData = new Midi(arrayBuffer);
  const events: NoteEvent[] = [];
  let unmappedNoteCount = 0;

  // DEBUG: Log MIDI file structure
  console.log('[parseMidiProject] MIDI file loaded:', {
    tracks: midiData.tracks.length,
    fileName: fileName || 'unknown',
  });

  // Extract all note events
  midiData.tracks.forEach((track, trackIndex) => {
    console.log(`[parseMidiProject] Track ${trackIndex}: ${track.notes.length} notes`);
    track.notes.forEach((note) => {
      const noteNumber = note.midi;
      events.push({
        noteNumber: noteNumber,
        startTime: note.time,
        duration: note.duration,
        velocity: Math.round(note.velocity * 127),
        channel: track.channel + 1
      });
    });
  });

  // DEBUG: Log total events extracted
  console.log('[parseMidiProject] Total events extracted:', events.length);

  // Sort events by start time
  events.sort((a, b) => a.startTime - b.startTime);

  // Determine tempo
  const tempo = midiData.header.tempos.length > 0
    ? Math.round(midiData.header.tempos[0].bpm)
    : 120;

  // Find minimum note number for intelligent root note logic
  const minNote = events.length > 0
    ? Math.min(...events.map(e => e.noteNumber))
    : null;

  // Create or update instrument config with intelligent root note
  const baseConfig: InstrumentConfig = existingConfig || {
    id: generateId('inst'),
    name: 'Imported Kit',
    rows: 8,
    cols: 8,
    bottomLeftNote: 36,
    layoutMode: 'drum_64'
  };

  const instrumentConfig: InstrumentConfig = {
    ...baseConfig,
    bottomLeftNote: minNote !== null ? minNote : baseConfig.bottomLeftNote,
  };

  // Check unmapped notes with the adjusted config
  const outOfBoundsNotes = new Set<number>();
  events.forEach(event => {
    const position = GridMapService.noteToGrid(event.noteNumber, instrumentConfig);
    if (!position) {
      unmappedNoteCount++;
      outOfBoundsNotes.add(event.noteNumber);
    }
  });

  // Create performance
  const performance: Performance = {
    events,
    tempo,
    name: fileName ? fileName.replace(/\.[^/.]+$/, "") : 'Imported Performance'
  };

  // DEBUG: Log performance creation
  console.log('[parseMidiProject] Created performance:', {
    name: performance.name,
    eventsCount: performance.events.length,
    tempo: performance.tempo,
  });

  // Extract unique voices
  const uniqueNotes = new Set<number>();
  events.forEach(event => {
    uniqueNotes.add(event.noteNumber);
  });

  // DEBUG: Log unique notes found
  console.log('[parseMidiProject] Total events:', events.length);
  console.log('[parseMidiProject] Unique note numbers found:', Array.from(uniqueNotes).sort((a, b) => a - b));

  // Generate note names
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const getNoteName = (midiNote: number): string => {
    const note = noteNames[midiNote % 12];
    const octave = Math.floor(midiNote / 12) - 2;
    return `${note}${octave}`;
  };

  // Generate colors for voices
  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
    '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
    '#a855f7', '#d946ef', '#ec4899', '#f43f5e'
  ];

  // Create voices - sort by note number for consistent ordering
  const sortedUniqueNotes = Array.from(uniqueNotes).sort((a, b) => a - b);
  const voices: Voice[] = sortedUniqueNotes.map((noteNumber, index) => {
    const noteName = getNoteName(noteNumber);
    return {
      id: generateId('sound'),
      name: `${noteName} (${noteNumber})`,
      sourceType: 'midi_track',
      sourceFile: fileName || 'imported.mid',
      originalMidiNote: noteNumber,
      color: colors[index % colors.length],
    };
  });

  // DEBUG: Log voices created
  console.log('[parseMidiProject] Voices created:', voices.length);
  voices.forEach(v => console.log(`  - ${v.name} (MIDI ${v.originalMidiNote})`));



  // Create initial grid mapping with voice assignments
  // IMPORTANT: Only map voices that don't conflict (first voice wins if multiple map to same cell)
  const cells: Record<string, Voice> = {};
  const usedCells = new Set<string>();
  let mappedCount = 0;
  let unmappedCount = 0;
  let conflictCount = 0;

  voices.forEach(voice => {
    if (voice.originalMidiNote !== null) {
      const position = GridMapService.noteToGrid(voice.originalMidiNote, instrumentConfig);
      if (position) {
        // position is [row, col] tuple, not an object
        const [row, col] = position;
        const cellKeyStr = cellKey(row, col);
        // Check if this cell is already occupied
        if (usedCells.has(cellKeyStr)) {
          console.warn(`[parseMidiProject] Cell ${cellKeyStr} (row ${row}, col ${col}) already occupied! Skipping ${voice.name} (MIDI ${voice.originalMidiNote}) - will be in parkedSounds only`);
          conflictCount++;
          // Don't overwrite - voice will remain in parkedSounds but not on grid
        } else {
          cells[cellKeyStr] = voice;
          usedCells.add(cellKeyStr);
          mappedCount++;
          console.log(`[parseMidiProject] Mapped ${voice.name} (MIDI ${voice.originalMidiNote}) to cell ${cellKeyStr} (row ${row}, col ${col})`);
        }
      } else {
        console.warn(`[parseMidiProject] Voice ${voice.name} (MIDI ${voice.originalMidiNote}) is outside grid bounds (bottomLeftNote: ${instrumentConfig.bottomLeftNote})`);
        unmappedCount++;
      }
    }
  });

  // DEBUG: Log grid mapping results
  console.log(`[parseMidiProject] Grid mapping: ${mappedCount} voices mapped to grid, ${unmappedCount} voices unmapped, ${conflictCount} conflicts (will be in parkedSounds only)`);
  console.log(`[parseMidiProject] Total cells in mapping: ${Object.keys(cells).length}`);
  console.log(`[parseMidiProject] Total voices (all will be in parkedSounds): ${voices.length}`);

  const gridMapping: GridMapping = {
    id: generateId('mapping'),
    name: `${performance.name} Layout`,
    cells,
    fingerConstraints: {},
    scoreCache: null,
    notes: `Auto-generated from ${fileName || 'MIDI import'}`,
  };

  // DEBUG: Final verification before return
  console.log('[parseMidiProject] Returning MidiProjectData:', {
    performanceEvents: performance.events.length,
    voicesCount: voices.length,
    voices: voices.map(v => `${v.name} (${v.originalMidiNote})`),
    gridMappingCells: Object.keys(gridMapping.cells).length,
  });

  return {
    performance,
    voices, // This should contain ALL unique voices
    instrumentConfig,

    gridMapping,
    minNoteNumber: minNote,
    unmappedNoteCount,
  };
}

/**
 * Fetches a MIDI file from a URL and parses it into a complete project structure.
 * 
 * @param url - The URL or path to the MIDI file
 * @param existingConfig - Optional existing instrument config to use as base
 * @returns Complete project data structure
 */
export async function fetchMidiProject(
  url: string,
  existingConfig?: InstrumentConfig
): Promise<MidiProjectData> {
  // Try multiple possible paths for the test MIDI file
  const possiblePaths = [
    `/TEST DATA/Scenario 1 Tests/${url}`,
    `/${url}`,
    url,
    `./TEST DATA/Scenario 1 Tests/${url}`,
  ];

  let response: Response | null = null;
  let lastError: Error | null = null;

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
  return parseMidiProject(arrayBuffer, url, existingConfig);
}

/**
 * Parses a MIDI file from a File object and creates a complete project structure.
 * 
 * @param file - The MIDI file
 * @param existingConfig - Optional existing instrument config to use as base
 * @returns Complete project data structure
 */
export async function parseMidiFileToProject(
  file: File,
  existingConfig?: InstrumentConfig
): Promise<MidiProjectData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        if (!e.target?.result) {
          throw new Error('Failed to read file');
        }
        const result = await parseMidiProject(e.target.result as ArrayBuffer, file.name, existingConfig);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

// Legacy exports for backward compatibility
export const parseMidiFile = async (
  file: File,
  config: InstrumentConfig
): Promise<MidiImportResult> => {
  const projectData = await parseMidiFileToProject(file, config);
  return {
    performance: projectData.performance,
    unmappedNoteCount: projectData.unmappedNoteCount,
    minNoteNumber: projectData.minNoteNumber,
  };
};

export const fetchAndParseMidiFile = async (
  url: string,
  config: InstrumentConfig
): Promise<MidiImportResult> => {
  const projectData = await fetchMidiProject(url, config);
  return {
    performance: projectData.performance,
    unmappedNoteCount: projectData.unmappedNoteCount,
    minNoteNumber: projectData.minNoteNumber,
  };
};

/**
 * Processes multiple MIDI files and extracts unique Voices (one per unique MIDI pitch).
 * 
 * @param files Array of MIDI files to process
 * @returns Promise resolving to a flat array of Voice objects
 */
export const processMidiFiles = async (files: File[]): Promise<Voice[]> => {
  const allAssets: Voice[] = [];

  for (const file of files) {
    try {
      const projectData = await parseMidiFileToProject(file);
      // Merge voices, avoiding duplicates by originalMidiNote
      projectData.voices.forEach(voice => {
        if (!allAssets.find(v => v.originalMidiNote === voice.originalMidiNote)) {
          allAssets.push(voice);
        }
      });
    } catch (err) {
      console.error(`Failed to process file ${file.name}:`, err);
    }
  }

  return allAssets;
};
