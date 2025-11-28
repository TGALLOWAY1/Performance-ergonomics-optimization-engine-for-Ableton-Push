import React from 'react';
import { SongMetadata } from '../../types/song';
import { useNavigate } from 'react-router-dom';

interface SongCardProps {
    song: SongMetadata;
}

export const SongCard: React.FC<SongCardProps> = ({ song }) => {
    const navigate = useNavigate();

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty) {
            case 'Easy': return 'text-green-400 bg-green-900/30 border-green-800';
            case 'Medium': return 'text-yellow-400 bg-yellow-900/30 border-yellow-800';
            case 'Hard': return 'text-orange-400 bg-orange-900/30 border-orange-800';
            case 'Expert': return 'text-red-400 bg-red-900/30 border-red-800';
            default: return 'text-slate-400 bg-slate-900/30 border-slate-800';
        }
    };

    return (
        <div
            onClick={() => navigate('/workbench')}
            className="group relative bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-xl p-4 transition-all cursor-pointer hover:shadow-xl hover:shadow-blue-900/10 hover:-translate-y-1"
        >
            {/* Status Badge */}
            <div className="absolute top-4 right-4">
                {song.lastPracticed > Date.now() - 86400000 * 3 ? (
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-200 bg-blue-600 rounded-full shadow-lg shadow-blue-900/50">
                        In Progress
                    </span>
                ) : song.performanceRating > 90 ? (
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200 bg-emerald-600 rounded-full shadow-lg shadow-emerald-900/50">
                        Mastered
                    </span>
                ) : null}
            </div>

            {/* Icon / Cover Art Placeholder */}
            <div className="w-16 h-16 mb-4 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center shadow-inner border border-white/5 group-hover:scale-105 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-500 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
            </div>

            {/* Title & Artist */}
            <h3 className="text-lg font-bold text-slate-200 mb-1 truncate group-hover:text-white transition-colors">{song.title}</h3>
            <p className="text-sm text-slate-400 mb-4 truncate">{song.artist}</p>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs mb-4">
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

            {/* Difficulty & Action */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
                <span className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wider rounded border ${getDifficultyColor(song.difficulty)}`}>
                    {song.difficulty}
                </span>

                <button className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-full font-medium shadow-lg shadow-blue-900/30">
                    Practice
                </button>
            </div>
        </div>
    );
};
