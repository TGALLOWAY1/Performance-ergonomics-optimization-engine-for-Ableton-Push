import { Song, SongMetadata } from '../types/song';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'push_perf_songs';

import { parseMidiFileToProject, MidiProjectData } from '../utils/midiImport';
import { saveProjectStateToStorage, loadProjectStateFromStorage, deleteProjectStateFromStorage } from '../utils/projectPersistence';
import { ProjectState, createInitialProjectState } from '../types/projectState';
import { generateId } from '../utils/performanceUtils';

class SongService {
    private getSongsMap(): Record<string, Song> {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    }

    private saveSongsMap(songs: Record<string, Song>): void {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
    }

    getAllSongs(): SongMetadata[] {
        const songs = this.getSongsMap();
        return Object.values(songs).map(song => song.metadata);
    }

    getSong(id: string): Song | null {
        const songs = this.getSongsMap();
        return songs[id] || null;
    }

    createSong(title: string, artist: string, bpm: number, key: string): Song {
        const id = uuidv4();
        const newSong: Song = {
            projectStateId: uuidv4(), // Placeholder for now
            metadata: {
                id,
                title,
                artist,
                bpm,
                key,
                duration: 0,
                lastPracticed: Date.now(),
                totalPracticeTime: 0,
                performanceRating: 0,
                difficulty: 'Medium',
                isFavorite: false,
                tags: []
            },
            sections: []
        };

        const songs = this.getSongsMap();
        songs[id] = newSong;
        this.saveSongsMap(songs);
        return newSong;
    }

    /**
     * Converts a File to base64 string for persistent storage.
     */
    private async fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                // Remove the data URL prefix (e.g., "data:audio/midi;base64,")
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Converts base64 string back to ArrayBuffer for parsing.
     */
    private base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * Creates a ProjectState from parsed MIDI data.
     * 
     * EXPLICIT LAYOUT MODEL: The grid starts empty.
     * All voices go to parkedSounds (staging area).
     * Users must explicitly assign sounds via drag & drop or layout control buttons.
     */
    private createProjectStateFromMidi(projectData: MidiProjectData): ProjectState {
        const layoutId = generateId('layout');
        
        // Ensure the gridMapping has layoutMode set to 'none' (explicit empty grid)
        const gridMappingWithMode = {
            ...projectData.gridMapping,
            layoutMode: 'none' as const,
        };
        
        const state: ProjectState = {
            layouts: [{
                id: layoutId,
                name: projectData.performance.name || 'Imported Layout',
                createdAt: new Date().toISOString(),
                performance: projectData.performance,
            }],
            instrumentConfigs: [projectData.instrumentConfig],
            sectionMaps: projectData.sectionMaps || [],
            instrumentConfig: projectData.instrumentConfig,
            activeLayoutId: layoutId,
            projectTempo: projectData.performance.tempo || 120,
            parkedSounds: projectData.voices, // All voices in staging area
            mappings: [gridMappingWithMode], // Empty grid with layoutMode: 'none'
            ignoredNoteNumbers: [],
            manualAssignments: {},
        };

        return state;
    }

    /**
     * Imports a song from a MIDI file.
     * Parses the MIDI to extract metadata (tempo, duration, key inference) and creates a new Song.
     * Also stores the MIDI data and creates initial project state for later loading.
     */
    async importSongFromMidi(file: File): Promise<Song> {
        try {
            // Store MIDI file as base64
            const midiData = await this.fileToBase64(file);
            
            const projectData = await parseMidiFileToProject(file);
            const { performance, minNoteNumber } = projectData;

            // Infer key from minNoteNumber (very basic heuristic)
            // TODO: Improve key detection logic
            const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const rootNote = minNoteNumber !== null ? noteNames[minNoteNumber % 12] : 'C';
            const inferredKey = `${rootNote} Major`; // Default to Major for now

            // Calculate duration from last event
            const lastEvent = performance.events[performance.events.length - 1];
            const duration = lastEvent ? Math.ceil(lastEvent.startTime + (lastEvent.duration || 0)) : 0;

            const id = uuidv4();
            const projectStateId = uuidv4();
            const newSong: Song = {
                projectStateId,
                midiData,
                midiFileName: file.name,
                metadata: {
                    id,
                    title: performance.name || file.name.replace(/\.[^/.]+$/, ""),
                    artist: 'Unknown Artist', // MIDI doesn't usually have artist info
                    bpm: performance.tempo || 120,
                    key: inferredKey,
                    duration,
                    lastPracticed: Date.now(),
                    totalPracticeTime: 0,
                    performanceRating: 0,
                    difficulty: 'Medium', // Default
                    isFavorite: false,
                    tags: ['Imported']
                },
                sections: []
            };

            // Create and save initial project state
            const initialState = this.createProjectStateFromMidi(projectData);
            saveProjectStateToStorage(projectStateId, initialState);

            const songs = this.getSongsMap();
            songs[id] = newSong;
            this.saveSongsMap(songs);
            return newSong;

        } catch (error) {
            console.error('Failed to import song from MIDI:', error);
            throw error;
        }
    }

    /**
     * Links a MIDI file to an existing song.
     * This stores the MIDI data and creates the initial project state.
     */
    async linkMidiToSong(songId: string, file: File): Promise<Song | null> {
        try {
            const song = this.getSong(songId);
            if (!song) {
                console.error('Song not found:', songId);
                return null;
            }

            // Store MIDI file as base64
            const midiData = await this.fileToBase64(file);
            
            const projectData = await parseMidiFileToProject(file);
            const { performance, minNoteNumber } = projectData;

            // Calculate duration from last event
            const lastEvent = performance.events[performance.events.length - 1];
            const duration = lastEvent ? Math.ceil(lastEvent.startTime + (lastEvent.duration || 0)) : 0;

            // Infer key
            const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const rootNote = minNoteNumber !== null ? noteNames[minNoteNumber % 12] : 'C';
            const inferredKey = `${rootNote} Major`;

            // Update song with MIDI data
            song.midiData = midiData;
            song.midiFileName = file.name;
            song.metadata.bpm = performance.tempo || song.metadata.bpm;
            song.metadata.duration = duration || song.metadata.duration;
            song.metadata.key = inferredKey;
            song.metadata.lastPracticed = Date.now();
            if (!song.metadata.tags.includes('Imported')) {
                song.metadata.tags.push('Imported');
            }

            // Create and save project state
            const projectState = this.createProjectStateFromMidi(projectData);
            saveProjectStateToStorage(song.projectStateId, projectState);

            // Save updated song
            const songs = this.getSongsMap();
            songs[songId] = song;
            this.saveSongsMap(songs);

            return song;

        } catch (error) {
            console.error('Failed to link MIDI to song:', error);
            throw error;
        }
    }

    /**
     * Checks if a song has linked MIDI data.
     */
    hasMidiData(songId: string): boolean {
        const song = this.getSong(songId);
        return !!song?.midiData;
    }

    /**
     * Gets the MIDI ArrayBuffer for a song (for re-parsing if needed).
     */
    getMidiArrayBuffer(songId: string): ArrayBuffer | null {
        const song = this.getSong(songId);
        if (song?.midiData) {
            return this.base64ToArrayBuffer(song.midiData);
        }
        return null;
    }

    updateSongMetadata(id: string, updates: Partial<SongMetadata>): void {
        const songs = this.getSongsMap();
        if (songs[id]) {
            songs[id].metadata = { ...songs[id].metadata, ...updates };
            this.saveSongsMap(songs);
        }
    }

    deleteSong(id: string): void {
        const songs = this.getSongsMap();
        const song = songs[id];
        if (song) {
            // Also delete the associated project state
            deleteProjectStateFromStorage(song.projectStateId);
            delete songs[id];
            this.saveSongsMap(songs);
        }
    }

    /**
     * Saves the full project state for a song.
     */
    saveSongState(songId: string, state: ProjectState): void {
        const song = this.getSong(songId);
        if (song) {
            saveProjectStateToStorage(song.projectStateId, state);
            // Update last practiced time
            this.updateSongMetadata(songId, { lastPracticed: Date.now() });
        }
    }

    /**
     * Loads the full project state for a song.
     */
    loadSongState(songId: string): ProjectState | null {
        const song = this.getSong(songId);
        if (song) {
            return loadProjectStateFromStorage(song.projectStateId);
        }
        return null;
    }

    // Helper to seed mock data if empty
    seedMockData(): void {
        if (this.getAllSongs().length === 0) {
            const MOCK_SONGS: SongMetadata[] = [
                {
                    id: '1',
                    title: 'Midnight Pulse',
                    artist: 'SunTzu',
                    bpm: 128,
                    key: 'F# Minor',
                    duration: 245,
                    lastPracticed: Date.now(),
                    totalPracticeTime: 47,
                    performanceRating: 88,
                    difficulty: 'Medium',
                    isFavorite: true,
                    tags: ['Techno', 'Live']
                },
                {
                    id: '2',
                    title: 'Drumline 2025',
                    artist: 'Drumline 2025',
                    bpm: 140,
                    key: 'C Major',
                    duration: 180,
                    lastPracticed: Date.now() - 86400000 * 2,
                    totalPracticeTime: 120,
                    performanceRating: 86,
                    difficulty: 'Hard',
                    isFavorite: false,
                    tags: ['Drum & Bass']
                },
                {
                    id: '3',
                    title: 'Echo Patterns',
                    artist: 'Echo Patterns',
                    bpm: 120,
                    key: 'A Minor',
                    duration: 300,
                    lastPracticed: Date.now() - 86400000 * 5,
                    totalPracticeTime: 200,
                    performanceRating: 95,
                    difficulty: 'Easy',
                    isFavorite: true,
                    tags: ['House']
                },
                {
                    id: '4',
                    title: 'Rhythmic Shift',
                    artist: 'Kims',
                    bpm: 130,
                    key: 'D Minor',
                    duration: 210,
                    lastPracticed: Date.now() - 86400000 * 1,
                    totalPracticeTime: 15,
                    performanceRating: 72,
                    difficulty: 'Medium',
                    isFavorite: false,
                    tags: ['Experimental']
                }
            ];

            const songs = this.getSongsMap();
            MOCK_SONGS.forEach(meta => {
                songs[meta.id] = {
                    projectStateId: uuidv4(),
                    metadata: meta,
                    sections: []
                };
            });
            this.saveSongsMap(songs);
        }
    }
}

export const songService = new SongService();
