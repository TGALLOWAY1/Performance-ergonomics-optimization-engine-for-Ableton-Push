export interface SongMetadata {
    id: string;
    title: string;
    artist: string;
    bpm: number;
    key: string;
    duration: number; // in seconds
    lastPracticed: number; // timestamp
    totalPracticeTime: number; // in minutes
    performanceRating: number; // 0-100
    difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert';
    coverArtUrl?: string; // Optional URL for cover art
    isFavorite: boolean;
    tags: string[];
}

export interface SongSection {
    id: string;
    name: string; // e.g., "Intro", "Drop A"
    startTime: number;
    endTime: number;
    color: string;
    // Metrics for this specific section
    masteryScore: number; // 0-100
    stabilityScore: number; // 0-100
}

export interface Song {
    metadata: SongMetadata;
    sections: SongSection[];
    // We will link the actual ProjectState (mappings, etc.) via ID later
    // or embed it if we want a monolithic file structure.
    // For now, let's keep it lightweight for the dashboard.
    projectStateId: string;
    /** 
     * Base64-encoded MIDI file data for persistent storage.
     * When present, the song can be loaded with its MIDI data without re-importing.
     */
    midiData?: string;
    /** 
     * Original MIDI filename for display purposes.
     */
    midiFileName?: string;
}
