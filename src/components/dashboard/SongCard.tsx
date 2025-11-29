import React, { useState, useEffect } from 'react';
import { SongMetadata } from '../../types/song';
import { useNavigate } from 'react-router-dom';

interface SongCardProps {
    song: SongMetadata;
    onDelete?: (id: string, title: string) => void;
    onLinkMidi?: (id: string) => void;
    onUpdate?: (id: string, updates: Partial<SongMetadata>) => void;
    hasMidiLinked?: boolean;
}

export const SongCard: React.FC<SongCardProps> = ({ song, onDelete, onLinkMidi, onUpdate, hasMidiLinked }) => {
    const navigate = useNavigate();
    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState(song.title);
    const [editedBpm, setEditedBpm] = useState(song.bpm);

    // Sync edited values when song prop changes (but not while editing)
    useEffect(() => {
        if (!isEditing) {
            setEditedTitle(song.title);
            setEditedBpm(song.bpm);
        }
    }, [song.title, song.bpm, isEditing]);

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click navigation
        if (onDelete) {
            onDelete(song.id, song.title);
        }
    };

    const handleLinkMidiClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click navigation
        if (onLinkMidi) {
            onLinkMidi(song.id);
        }
    };

    const handleWorkbenchClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click navigation
        navigate(`/workbench?songId=${song.id}`);
    };

    const handleAnalyzeEventsClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click navigation
        navigate(`/event-analysis?songId=${song.id}`);
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent any parent click handlers
        setIsEditing(true);
    };

    const handleSaveEdit = () => {
        const trimmedTitle = editedTitle.trim();
        const bpmValue = Math.max(1, Math.min(999, editedBpm)); // Clamp BPM between 1-999
        
        // Only update if values changed
        if (trimmedTitle !== song.title || bpmValue !== song.bpm) {
            if (onUpdate) {
                onUpdate(song.id, {
                    title: trimmedTitle,
                    bpm: bpmValue,
                });
            }
        }
        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setEditedTitle(song.title);
        setEditedBpm(song.bpm);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSaveEdit();
        } else if (e.key === 'Escape') {
            handleCancelEdit();
        }
    };

    return (
        <div
            className="group relative bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-xl p-4 transition-all hover:shadow-xl hover:shadow-blue-900/10 hover:-translate-y-1"
        >
            {/* Status Badge, Delete Button & Link MIDI */}
            <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                    {song.lastPracticed > Date.now() - 86400000 * 3 ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-200 bg-blue-600 rounded-full shadow-lg shadow-blue-900/50">
                            In Progress
                        </span>
                    ) : song.performanceRating > 90 ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200 bg-emerald-600 rounded-full shadow-lg shadow-emerald-900/50">
                            Mastered
                        </span>
                    ) : null}
                    {onDelete && (
                        <button
                            onClick={handleDeleteClick}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Delete song"
                            aria-label={`Delete ${song.title}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    )}
                </div>
                {/* Link/Re-link MIDI button - positioned below status badge */}
                {onLinkMidi && (
                    <button 
                        onClick={handleLinkMidiClick}
                        className={`px-2.5 py-1 text-xs rounded-full font-medium shadow-lg transition-colors flex items-center gap-1 shrink-0 ${
                            hasMidiLinked 
                                ? 'bg-slate-600 hover:bg-slate-500 text-white shadow-slate-900/30' 
                                : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30'
                        }`}
                        title={hasMidiLinked ? "Re-link MIDI file" : "Link MIDI file"}
                    >
                        {hasMidiLinked ? (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span className="whitespace-nowrap">Re-link</span>
                            </>
                        ) : (
                            'Link MIDI'
                        )}
                    </button>
                )}
            </div>

            {/* Icon / Cover Art Placeholder */}
            <div 
                onDoubleClick={handleDoubleClick}
                className="relative w-16 h-16 mb-4 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center shadow-inner border border-white/5 group-hover:scale-105 transition-transform cursor-pointer"
                title="Double-click to edit"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-500 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                {/* MIDI Link Indicator */}
                {hasMidiLinked && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-600 border-2 border-slate-800 flex items-center justify-center" title="MIDI linked">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    </div>
                )}
            </div>

            {/* Title & BPM */}
            {isEditing ? (
                <div className="mb-4 space-y-2">
                    <input
                        type="text"
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={(e) => {
                            // Only save on blur if clicking outside the edit area
                            const relatedTarget = e.relatedTarget as HTMLElement;
                            if (!relatedTarget || !e.currentTarget.parentElement?.contains(relatedTarget)) {
                                handleSaveEdit();
                            }
                        }}
                        className="w-full px-2 py-1 text-lg font-bold bg-slate-700 text-slate-200 rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
                        autoFocus
                        placeholder="Song title"
                    />
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-400">BPM:</label>
                        <input
                            type="number"
                            value={editedBpm}
                            onChange={(e) => setEditedBpm(parseInt(e.target.value) || 0)}
                            onKeyDown={handleKeyDown}
                            onBlur={(e) => {
                                const relatedTarget = e.relatedTarget as HTMLElement;
                                if (!relatedTarget || !e.currentTarget.parentElement?.parentElement?.contains(relatedTarget)) {
                                    handleSaveEdit();
                                }
                            }}
                            className="w-20 px-2 py-1 text-sm font-mono bg-slate-700 text-slate-200 rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
                            min={1}
                            max={999}
                            placeholder="120"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleSaveEdit}
                            className="px-2 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded"
                        >
                            Save
                        </button>
                        <button
                            onClick={handleCancelEdit}
                            className="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 text-white rounded"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <h3 
                    onDoubleClick={handleDoubleClick}
                    className="text-lg font-bold text-slate-200 mb-4 truncate group-hover:text-white transition-colors cursor-pointer"
                    title="Double-click to edit"
                >
                    {song.title}
                </h3>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-y-2 gap-x-3 text-xs mb-4">
                <div>
                    <div className="text-slate-500 mb-0.5">BPM</div>
                    <div className="font-mono font-medium text-slate-300">
                        {song.bpm}
                    </div>
                </div>
                <div>
                    <div className="text-slate-500 mb-0.5">Rating</div>
                    <div className="font-mono font-medium text-slate-300">
                        {song.performanceRating}<span className="text-slate-600">/100</span>
                    </div>
                </div>
                <div>
                    <div className="text-slate-500 mb-0.5">Practiced</div>
                    <div className="font-medium text-slate-300">
                        {Math.round(song.totalPracticeTime / 60)}h {song.totalPracticeTime % 60}m
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-2 pt-3 border-t border-slate-700/50">
                <button 
                    onClick={handleWorkbenchClick}
                    className="px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-full font-medium shadow-lg shadow-blue-900/30 flex items-center gap-1 transition-colors"
                    title="Open in Editor"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Editor
                </button>
                <button 
                    onClick={handleAnalyzeEventsClick}
                    className="px-2.5 py-1 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded-full font-medium shadow-lg shadow-purple-900/30 flex items-center gap-1 transition-colors"
                    title="Analyze Events"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Analyze
                </button>
                <button className="px-2.5 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded-full font-medium shadow-lg shadow-green-900/30 flex items-center gap-1 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Practice
                </button>
            </div>
        </div>
    );
};
