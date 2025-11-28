import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { Timeline } from '../workbench/Timeline';
import { Voice } from '../types/layout';

export const TimelinePage: React.FC = () => {
    const { projectState, engineResult } = useProject();
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [zoom, setZoom] = useState(100); // pixels per second
    const lastFrameTimeRef = useRef<number>(0);
    const requestRef = useRef<number>();

    const activeLayout = useMemo(() =>
        projectState.layouts.find(l => l.id === projectState.activeLayoutId) || null,
        [projectState.layouts, projectState.activeLayoutId]
    );

    // Get active mapping to determine voices
    const activeMapping = useMemo(() =>
        projectState.mappings.find(m => m.id === (projectState.activeLayoutId ? projectState.mappings[0]?.id : null)) || projectState.mappings[0] || null,
        [projectState.mappings, projectState.activeLayoutId]
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

    // Playback loop
    const animate = (time: number) => {
        if (lastFrameTimeRef.current !== undefined) {
            const deltaTime = (time - lastFrameTimeRef.current) / 1000;
            setCurrentTime(prev => {
                const newTime = prev + deltaTime;
                // Loop or stop at end? Let's stop at end + padding
                // For now just run
                return newTime;
            });
        }
        lastFrameTimeRef.current = time;
        if (isPlaying) {
            requestRef.current = requestAnimationFrame(animate);
        }
    };

    useEffect(() => {
        if (isPlaying) {
            lastFrameTimeRef.current = performance.now();
            requestRef.current = requestAnimationFrame(animate);
        } else {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
        }
        return () => {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
        };
    }, [isPlaying]);

    const togglePlay = () => {
        setIsPlaying(!isPlaying);
    };

    const handleStop = () => {
        setIsPlaying(false);
        setCurrentTime(0);
    };

    const handleSeek = (time: number) => {
        setCurrentTime(time);
    };

    if (!activeLayout) {
        return (
            <div className="h-screen w-screen flex flex-col bg-slate-900 text-white items-center justify-center">
                <p className="text-slate-500 mb-4">No active layout found.</p>
                <Link to="/" className="text-blue-400 hover:text-blue-300">Return to Workbench</Link>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen flex flex-col bg-slate-900 text-white overflow-hidden">
            {/* Header */}
            <div className="flex-none h-16 glass-panel-strong border-b border-slate-700/50 flex items-center justify-between px-6 z-20 relative">
                <div className="flex items-center gap-4">
                    <Link to="/" className="text-slate-400 hover:text-white transition-colors flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                        Back
                    </Link>
                    <div className="h-6 w-px bg-slate-700/50 mx-2" />
                    <h1 className="text-lg font-bold text-slate-100">{activeLayout.name}</h1>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-4">
                    {/* Practice Mode Toggle */}
                    <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-1.5 border border-slate-700/50">
                        <span className="text-xs text-slate-400 font-medium">Practice Mode</span>
                        <button
                            className="w-8 h-4 bg-slate-700 rounded-full relative transition-colors hover:bg-slate-600"
                            title="Toggle Practice Mode (Visual only for MVP)"
                        >
                            <div className="absolute top-0.5 left-0.5 w-3 h-3 bg-slate-400 rounded-full shadow-sm" />
                        </button>
                    </div>

                    {/* Scroll Speed */}
                    <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-1.5 border border-slate-700/50">
                        <span className="text-xs text-slate-400 font-medium">Scroll Speed</span>
                        <select
                            className="bg-transparent text-xs font-bold text-blue-400 outline-none cursor-pointer"
                            defaultValue="1x"
                        >
                            <option value="0.5x">0.5×</option>
                            <option value="1x">1×</option>
                            <option value="1.5x">1.5×</option>
                            <option value="2x">2×</option>
                        </select>
                    </div>

                    <div className="h-6 w-px bg-slate-700/50 mx-2" />

                    {/* Playback Controls */}
                    <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700 shadow-sm">
                        <button
                            onClick={togglePlay}
                            className={`p-2 rounded transition-all ${isPlaying ? 'bg-yellow-500/10 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.2)]' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}
                        >
                            {isPlaying ? (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                            ) : (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z" /></svg>
                            )}
                        </button>
                        <button
                            onClick={handleStop}
                            className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" /></svg>
                        </button>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-1.5 border border-slate-700 shadow-inner">
                        <span className="text-xs text-slate-500 font-mono">TIME</span>
                        <span className="text-sm font-mono text-cyan-400 w-16 text-right">{currentTime.toFixed(2)}s</span>
                    </div>

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
                    isPlaying={isPlaying}
                    onSeek={handleSeek}
                />
            </div>
        </div>
    );
};
