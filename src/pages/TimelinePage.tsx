import React, { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { Timeline } from '../workbench/Timeline';
import { useSongStateHydration } from '../hooks/useSongStateHydration';
import { Voice } from '../types/layout';

export const TimelinePage: React.FC = () => {
    const { projectState, engineResult } = useProject();
    const [searchParams] = useSearchParams();
    const songId = searchParams.get('songId');

    // Build the workbench link with songId if present
    const workbenchLink = songId ? `/workbench?songId=${songId}` : '/workbench';
    const dashboardLink = '/';
    const [currentTime, setCurrentTime] = useState(0);
    const [zoom, setZoom] = useState(100); // pixels per second

    // Use the shared hydration hook to load the song state
    const { hasLoadedSong, songName } = useSongStateHydration(songId);

    const activeLayout = useMemo(() =>
        projectState.layouts.find(l => l.id === projectState.activeLayoutId) || null,
        [projectState.layouts, projectState.activeLayoutId]
    );

    // Resolve active mapping via activeMappingId (route-consistent with Workbench)
    const activeMapping = useMemo(() =>
        projectState.mappings.find(m => m.id === projectState.activeMappingId) ?? projectState.mappings[0] ?? null,
        [projectState.mappings, projectState.activeMappingId]
    );

    // Extract unique voices from mapping
    const voices = useMemo(() => {
        if (!activeMapping) return [];
        const uniqueVoices = new Map<string, Voice>();
        Object.values(activeMapping.cells).forEach(voice => {
            uniqueVoices.set(voice.id, voice);
        });
        return Array.from(uniqueVoices.values());
    }, [activeMapping]);

    // Generate finger assignments array
    const fingerAssignments = useMemo(() => {
        if (!engineResult || !activeLayout?.performance.events) return [];

        const assignments: string[] = [];
        const lastFingerForVoice: Record<string, string> = {};

        // Assume engineResult.debugEvents aligns with performance.events
        activeLayout.performance.events.forEach((event, i) => {
            const debugEvent = engineResult.debugEvents[i];
            if (!debugEvent) {
                assignments.push('');
                return;
            }

            const finger = debugEvent.finger;
            const hand = debugEvent.assignedHand;

            if (!finger || hand === 'Unplayable') {
                assignments.push('');
                return;
            }

            // Format: L1, R2, etc.
            // Map finger name to number: thumb=1, index=2, middle=3, ring=4, pinky=5
            const fingerMap: Record<string, string> = {
                'thumb': '1',
                'index': '2',
                'middle': '3',
                'ring': '4',
                'pinky': '5'
            };

            const fingerNum = fingerMap[finger] || '?';
            const label = (hand === 'left' ? 'L' : 'R') + fingerNum;

            // Find voice for this note
            // We need to know which voice this note belongs to to track "last finger for voice"
            // But here we just track by note number or voice ID?
            // The requirement says "if the voice doesn't change assignments".
            // So we need to track per voice.
            // We can find the voice by note number from the `voices` list.
            const voice = voices.find(v => v.originalMidiNote === event.noteNumber);
            const voiceId = voice ? voice.id : `note-${event.noteNumber}`;

            if (lastFingerForVoice[voiceId] !== label) {
                assignments.push(label);
                lastFingerForVoice[voiceId] = label;
            } else {
                assignments.push('');
            }
        });

        return assignments;
    }, [engineResult, activeLayout, voices]);
    const handleSeek = (time: number) => {
        setCurrentTime(time);
    };

    // Show loading state while loading song
    if (songId && !hasLoadedSong) {
        return (
            <div className="h-screen w-screen flex flex-col bg-slate-900 text-white items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mb-4" />
                <p className="text-slate-400">Loading song data...</p>
            </div>
        );
    }

    // No song selected
    if (!songId) {
        return (
            <div className="h-screen w-screen flex flex-col bg-slate-900 text-white items-center justify-center">
                <div className="text-center p-8 max-w-md">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-200 mb-2">No Song Selected</h3>
                    <p className="text-sm text-slate-400 mb-4">
                        Select a song from the Dashboard to view the timeline.
                    </p>
                    <Link
                        to={dashboardLink}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        Go to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    // Song has no MIDI data
    if (!activeLayout || projectState.parkedSounds.length === 0) {
        return (
            <div className="h-screen w-screen flex flex-col bg-slate-900 text-white items-center justify-center">
                <div className="text-center p-8 max-w-md">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-900/30 border-2 border-amber-600/50 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-200 mb-2">No MIDI Data</h3>
                    <p className="text-sm text-slate-400 mb-4">
                        {songName ? `"${songName}" doesn't have any MIDI data linked yet.` : "This song doesn't have any MIDI data linked yet."}
                        Go back to the Dashboard and use the "Link MIDI" button to add a MIDI file.
                    </p>
                    <Link
                        to={dashboardLink}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                        </svg>
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen flex flex-col bg-slate-900 text-white overflow-hidden">
            {/* Header */}
            <div className="flex-none h-16 glass-panel-strong border-b border-slate-700/50 flex items-center justify-between px-6 z-20 relative">
                <div className="flex items-center gap-4">
                    <Link to={workbenchLink} className="text-slate-400 hover:text-white transition-colors flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                        Back to Grid Editor
                    </Link>
                    <div className="h-6 w-px bg-slate-700/50 mx-2" />
                    <h1 className="text-lg font-bold text-slate-100">Timeline View</h1>
                    {songName && (
                        <>
                            <div className="h-6 w-px bg-slate-700/50 mx-2" />
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-900/30 border border-emerald-700/50 rounded-lg">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="text-xs font-medium text-emerald-300">{songName}</span>
                            </div>
                        </>
                    )}
                </div>

                {/* Controls */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Zoom</span>
                        <input
                            type="range"
                            min="10"
                            max="500"
                            value={zoom}
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className="w-24 accent-cyan-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            {/* Timeline View */}
            <div className="flex-1 overflow-hidden relative">
                <Timeline
                    performance={activeLayout.performance}
                    voices={voices}
                    fingerAssignments={fingerAssignments}
                    currentTime={currentTime}
                    zoom={zoom}
                    isPlaying={false}
                    onSeek={handleSeek}
                />
            </div>
        </div>
    );
};
