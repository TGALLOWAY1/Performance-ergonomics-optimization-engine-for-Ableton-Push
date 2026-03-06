import { useState, useEffect, useRef } from 'react';
import { useProject } from '../context/ProjectContext';
import { songService } from '../services/SongService';
import { DEFAULT_TEST_SONG_ID } from '../data/testData';

export interface UseSongStateHydrationResult {
    hasLoadedSong: boolean;
    songName: string | null;
}

/**
 * A shared hook for hydrating the ProjectContext from a given songId.
 * Ensures consistent loading logic across all routed pages (Workbench, Timeline, Event Analysis).
 */
export function useSongStateHydration(songId: string | null): UseSongStateHydrationResult {
    const { projectState, setProjectState } = useProject();
    const [hasLoadedSong, setHasLoadedSong] = useState(false);
    const [songName, setSongName] = useState<string | null>(null);

    // Track if we've already attempted to load this session to prevent double-loading
    const hasAttemptedLoadRef = useRef(false);
    const loadedSongIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!songId) {
            setHasLoadedSong(false);
            return;
        }

        // Prevent double-loading the same song in the same session
        if (hasAttemptedLoadRef.current && loadedSongIdRef.current === songId) {
            console.log(`[useSongStateHydration] Already loaded song ${songId} in session, skipping.`);
            return;
        }

        let cancelled = false;

        const run = async () => {
            // Ensure default test song is seeded when requested (e.g. direct nav to workbench)
            if (songId === DEFAULT_TEST_SONG_ID) {
                await songService.seedDefaultTestSong();
            }
            if (cancelled) return;

            // Get song metadata for display
            const song = songService.getSong(songId);
            if (song) {
                setSongName(song.metadata.title);
            }

            // Check which song was last loaded (persists across page refresh)
            const lastLoadedSongId = localStorage.getItem('push_perf_current_song_id');
            const isSameSong = lastLoadedSongId === songId;

            // Check if the current projectState has MEANINGFUL data
            const hasPerformanceEvents = projectState.layouts.some(l => l.performance?.events?.length > 0);
            const hasVoices = projectState.parkedSounds.length > 0;
            const hasMappingCells = projectState.mappings.some(m => Object.keys(m.cells).length > 0);
            const hasRealData = hasPerformanceEvents || hasVoices || hasMappingCells;

            // Load from storage when:
            // 1. Different song than last time (user switched songs), OR
            // 2. Same song but no real data in context (page refresh / initial load)
            const shouldLoad = !isSameSong || !hasRealData;

            console.log('[useSongStateHydration] Song load check:', {
                songId,
                lastLoadedSongId,
                isSameSong,
                hasRealData,
                shouldLoad,
            });

            hasAttemptedLoadRef.current = true;
            loadedSongIdRef.current = songId;

            if (shouldLoad) {
                console.log(`[useSongStateHydration] Loading song state for: ${songId}`);
                localStorage.setItem('push_perf_current_song_id', songId);

                const savedState = songService.loadSongState(songId);
                if (cancelled) return;
                if (savedState) {
                    // Set active mapping if available
                    if (savedState.mappings.length > 0 && !savedState.activeMappingId) {
                        savedState.activeMappingId = savedState.mappings[0].id;
                    }
                    setProjectState(savedState, true); // Skip history for initial load
                } else {
                    console.log(`[useSongStateHydration] No saved state found for song: ${songId}`);
                }
            } else {
                console.log('[useSongStateHydration] Using existing data in context');
                // Even if we use existing data, ensure the current song ID is tracked
                localStorage.setItem('push_perf_current_song_id', songId);
            }

            setHasLoadedSong(true);
        };

        run();
        return () => { cancelled = true; };
    }, [songId, setProjectState, projectState]);

    return { hasLoadedSong, songName };
}
