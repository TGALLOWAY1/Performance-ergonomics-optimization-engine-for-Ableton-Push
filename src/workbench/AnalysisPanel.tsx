import React, { useMemo } from 'react';
import { EngineResult } from '../engine/core';
import { GridMapping } from '../types/layout';
import { SoundAssignmentTable } from './SoundAssignmentTable';
import { Performance } from '../types/performance';

interface AnalysisPanelProps {
    engineResult: EngineResult | null;
    activeMapping: GridMapping | null;
    performance: Performance | null;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
    engineResult,
    activeMapping,
    performance,
}) => {
    // Calculate summary stats
    const stats = useMemo(() => {
        if (!engineResult) return null;

        const { score, fingerUsageStats } = engineResult;
        const totalEvents = performance?.events.length || 0;

        // Calculate hand balance
        let leftHandCount = 0;
        let rightHandCount = 0;

        Object.entries(fingerUsageStats).forEach(([key, count]) => {
            if (key.startsWith('L-')) leftHandCount += count;
            if (key.startsWith('R-')) rightHandCount += count;
        });

        const totalHandEvents = leftHandCount + rightHandCount;
        const leftHandPercent = totalHandEvents > 0 ? Math.round((leftHandCount / totalHandEvents) * 100) : 0;
        const rightHandPercent = totalHandEvents > 0 ? Math.round((rightHandCount / totalHandEvents) * 100) : 0;

        return {
            score: Math.round(score), // Use score instead of cost
            eventCount: totalEvents,
            handBalance: { left: leftHandPercent, right: rightHandPercent },
        };
    }, [engineResult, performance]);

    return (
        <div className="h-full flex flex-col bg-slate-900/50 backdrop-blur-md border-l border-white/10">
            {/* Header */}
            <div className="flex-none h-12 border-b border-white/10 flex items-center px-4 bg-white/5">
                <h2 className="text-sm font-semibold text-white/90 tracking-wide uppercase">Analysis & Insights</h2>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">

                {/* Performance Summary Card */}
                <div className="glass-panel p-4 rounded-xl space-y-4">
                    <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Performance Summary</h3>

                    {stats ? (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-800/50 rounded-lg p-3 border border-white/5">
                                <div className="text-[10px] text-slate-400 uppercase">Ergonomic Score</div>
                                <div className="text-2xl font-light text-white mt-1">{stats.score}</div>
                            </div>
                            <div className="bg-slate-800/50 rounded-lg p-3 border border-white/5">
                                <div className="text-[10px] text-slate-400 uppercase">Total Events</div>
                                <div className="text-2xl font-light text-white mt-1">{stats.eventCount}</div>
                            </div>

                            {/* Hand Balance Visualization */}
                            <div className="col-span-2 bg-slate-800/50 rounded-lg p-3 border border-white/5">
                                <div className="flex justify-between text-[10px] text-slate-400 uppercase mb-2">
                                    <span>Left Hand</span>
                                    <span>Hand Balance</span>
                                    <span>Right Hand</span>
                                </div>
                                <div className="h-2 bg-slate-700 rounded-full overflow-hidden flex">
                                    <div
                                        className="h-full bg-blue-500 transition-all duration-500"
                                        style={{ width: `${stats.handBalance.left}%` }}
                                    />
                                    <div
                                        className="h-full bg-rose-500 transition-all duration-500"
                                        style={{ width: `${stats.handBalance.right}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-xs text-white mt-1 font-mono">
                                    <span>{stats.handBalance.left}%</span>
                                    <span>{stats.handBalance.right}%</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-4 text-slate-500 text-sm italic">
                            No analysis data available.
                        </div>
                    )}
                </div>

                {/* Event Transition View (Placeholder for now, can be expanded) */}
                <div className="glass-panel p-4 rounded-xl">
                    <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-3">Event Transitions</h3>
                    <div className="h-32 bg-slate-800/50 rounded-lg border border-white/5 flex items-center justify-center text-slate-500 text-xs">
                        Transition Graph Visualization Coming Soon
                    </div>
                </div>

                {/* Sound Assignments */}
                <div className="glass-panel p-4 rounded-xl flex flex-col h-[400px]">
                    <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-3">Finger Assignments</h3>
                    <div className="flex-1 overflow-hidden rounded-lg border border-white/5 bg-slate-800/30">
                        <SoundAssignmentTable
                            activeMapping={activeMapping}
                            engineResult={engineResult}
                        />
                    </div>
                </div>

            </div>
        </div>
    );
};
