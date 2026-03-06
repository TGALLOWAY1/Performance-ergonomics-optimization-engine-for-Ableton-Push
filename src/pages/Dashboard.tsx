import React, { useEffect, useState } from 'react';
// import { Link, useNavigate } from 'react-router-dom';
// import { useProject } from '../context/ProjectContext';
import { SongCard } from '../components/dashboard/SongCard';
import { SongMetadata } from '../types/song';
import { songService } from '../services/SongService';

export const Dashboard: React.FC = () => {
    const [songs, setSongs] = useState<SongMetadata[]>([]);
    const [songsWithMidi, setSongsWithMidi] = useState<Set<string>>(new Set());

    const refreshSongs = () => {
        const allSongs = songService.getAllSongs();
        setSongs(allSongs);

        // Check which songs have MIDI data
        const withMidi = new Set<string>();
        allSongs.forEach(song => {
            if (songService.hasMidiData(song.id)) {
                withMidi.add(song.id);
            }
        });
        setSongsWithMidi(withMidi);
    };

    useEffect(() => {
        // Seed default test MIDI clip if not already present (hardcoded, no import needed)
        songService.seedDefaultTestSong().then(() => refreshSongs());
    }, []);





    const handleMidiLinked = async (songId: string, file: File) => {
        console.log("[LinkMIDI Debug] handleMidiLinked called:", {
            songId,
            fileName: file.name,
            fileSize: file.size,
        });

        try {
            const updatedSong = await songService.linkMidiToSong(songId, file);

            console.log("[LinkMIDI Debug] songService.linkMidiToSong success:", {
                songId,
                updatedSong: updatedSong
                    ? {
                        id: updatedSong.metadata?.id ?? songId,
                        title: updatedSong.metadata?.title,
                    }
                    : null,
            });

            // Refresh songs so UI picks up hasMidiLinked changes
            refreshSongs();
        } catch (error) {
            console.error("[LinkMIDI Debug] songService.linkMidiToSong error:", {
                songId,
                error,
            });
            alert("Failed to link MIDI file. See console for details.");
        }
    };

    const handleAddSongClick = () => {
        songService.createSong('New Song', 'Unknown Artist', 120, 'C Major');
        refreshSongs();
    };

    const handleDeleteSong = (id: string, _title: string) => {
        // if (window.confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
        songService.deleteSong(id);
        refreshSongs();
        // }
    };

    const handleUpdateSong = (id: string, updates: Partial<SongMetadata>) => {
        songService.updateSongMetadata(id, updates);
        refreshSongs();
    };

    return (
        <div className="h-screen w-screen bg-slate-950 text-slate-200 flex flex-col overflow-hidden font-sans selection:bg-blue-500/30">
            {/* Hidden File Input for Import MIDI (new song) */}


            {/* Header */}
            <div className="flex-none h-16 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-md flex items-center justify-between px-8 z-10">
                <div>
                    <h1 className="text-xl font-bold text-slate-100 tracking-tight">Performability Engine <span className="text-slate-500 font-light">— Song Portfolio</span></h1>
                    <p className="text-xs text-slate-500 mt-0.5">Your practice library. Choose a song to begin.</p>
                </div>
                <div className="flex items-center gap-4">
                    <button className="p-2 text-slate-400 hover:text-slate-200 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </button>
                    <button className="p-2 text-slate-400 hover:text-slate-200 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Main Grid */}
                <div className="flex-1 overflow-y-auto p-8 bg-gradient-to-br from-slate-900 to-slate-950">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
                        {songs.map(song => (
                            <SongCard
                                key={song.id}
                                song={song}
                                onDelete={handleDeleteSong}
                                onLinkMidi={handleMidiLinked}
                                onUpdate={handleUpdateSong}
                                hasMidiLinked={songsWithMidi.has(song.id)}
                            />
                        ))}

                        {/* Add New Card */}
                        <button
                            onClick={handleAddSongClick}
                            className="group relative border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col items-center justify-center text-slate-500 hover:text-slate-300 transition-all min-h-[200px]"
                        >
                            <div className="w-12 h-12 rounded-full bg-slate-800 group-hover:bg-slate-700 flex items-center justify-center mb-3 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            </div>
                            <span className="font-medium">Add New Song</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="flex-none h-16 border-t border-slate-800/50 bg-slate-900/50 backdrop-blur-md flex items-center justify-end px-8 z-10" />

            {/* DEBUG: Global file input diagnostics */}

        </div>
    );
};
