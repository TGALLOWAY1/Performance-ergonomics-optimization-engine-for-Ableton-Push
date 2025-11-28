import React, { useMemo } from 'react';
import { EngineResult } from '../engine/core';
import { GridMapping } from '../types/layout';
import { SoundAssignmentTable } from './SoundAssignmentTable';
import { Performance } from '../types/performance';
import { EventLogTable } from './EventLogTable';
import { FingerType } from '../engine/models';

interface AnalysisPanelProps {
    engineResult: EngineResult | null;
    activeMapping: GridMapping | null;
    performance: Performance | null;
    onAssignmentChange: (index: number, hand: 'left' | 'right', finger: FingerType) => void;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
    engineResult,
    activeMapping,
    performance,
    onAssignmentChange,
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
        <div className="h-full flex flex-col bg-[var(--bg-panel)] border-l border-[var(--border-subtle)] backdrop-blur-md">
            {/* Header */}
            <div className="flex-none h-12 border-b border-[var(--border-subtle)] flex items-center px-4 bg-[var(--bg-card)]">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] tracking-wide uppercase">Analysis & Insights</h2>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6 flex flex-col">

                {/* Performance Summary Card */}
                <div className="bg-[var(--bg-card)] p-4 rounded-[var(--radius-lg)] space-y-4 flex-none border border-[var(--border-subtle)] shadow-sm">
                    <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Performance Summary</h3>

                    {stats ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-[var(--bg-input)] rounded-[var(--radius-md)] p-3 border border-[var(--border-subtle)]">
                                    <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Ergonomic Score</div>
                                    <div className="text-2xl font-light text-[var(--text-primary)] mt-1">{stats.score}</div>
                                </div>
                                <div className="bg-[var(--bg-input)] rounded-[var(--radius-md)] p-3 border border-[var(--border-subtle)]">
                                    <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Total Events</div>
                                    <div className="text-2xl font-light text-[var(--text-primary)] mt-1">{stats.eventCount}</div>
                                </div>

                                {/* Hand Balance Visualization */}
                                <div className="col-span-2 bg-[var(--bg-input)] rounded-[var(--radius-md)] p-3 border border-[var(--border-subtle)]">
                                    <div className="flex justify-between text-[10px] text-[var(--text-tertiary)] uppercase mb-2">
                                        <span>Left Hand</span>
                                        <span>Hand Balance</span>
                                        <span>Right Hand</span>
                                    </div>
                                    <div className="h-2 bg-[var(--bg-app)] rounded-full overflow-hidden flex">
                                        <div
                                            className="h-full bg-[var(--finger-L2)] transition-all duration-500"
                                            style={{ width: `${stats.handBalance.left}%` }}
                                        />
                                        <div
                                            className="h-full bg-[var(--finger-R2)] transition-all duration-500"
                                            style={{ width: `${stats.handBalance.right}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs text-[var(--text-primary)] mt-1 font-mono">
                                        <span>{stats.handBalance.left}%</span>
                                        <span>{stats.handBalance.right}%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Cost Metrics Breakdown */}
                            {engineResult && engineResult.averageMetrics && (
                                <div className="bg-[var(--bg-input)] rounded-[var(--radius-md)] p-3 border border-[var(--border-subtle)]">
                                    <div className="text-[10px] text-[var(--text-tertiary)] uppercase mb-3">Average Cost Metrics</div>
                                    <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-[var(--text-secondary)]">Movement</span>
                                            <span className="text-xs font-mono text-[var(--finger-L3)]">{engineResult.averageMetrics.movement.toFixed(1)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-[var(--text-secondary)]">Stretch</span>
                                            <span className="text-xs font-mono text-[var(--finger-L5)]">{engineResult.averageMetrics.stretch.toFixed(1)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-[var(--text-secondary)]">Drift</span>
                                            <span className="text-xs font-mono text-[var(--finger-R3)]">{engineResult.averageMetrics.drift.toFixed(1)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-[var(--text-secondary)]">Bounce</span>
                                            <span className="text-xs font-mono text-[var(--text-warning)]">{engineResult.averageMetrics.bounce.toFixed(1)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-[var(--text-secondary)]">Fatigue</span>
                                            <span className="text-xs font-mono text-[var(--finger-R4)]">{engineResult.averageMetrics.fatigue.toFixed(1)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-[var(--text-secondary)]">Crossover</span>
                                            <span className="text-xs font-mono text-[var(--finger-L4)]">{engineResult.averageMetrics.crossover.toFixed(1)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-4 text-[var(--text-tertiary)] text-sm italic">
                            No analysis data available.
                        </div>
                    )}
                </div>

                {/* Event Log & Manual Assignments */}
                <div className="bg-[var(--bg-card)] p-4 rounded-[var(--radius-lg)] flex-none h-[300px] flex flex-col border border-[var(--border-subtle)] shadow-sm">
                    <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Event Log</h3>
                    <div className="flex-1 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)]">
                        {engineResult ? (
                            <EventLogTable
                                events={engineResult.debugEvents}
                                onAssignmentChange={onAssignmentChange}
                            />
                        ) : (
                            <div className="h-full flex items-center justify-center text-[var(--text-tertiary)] text-xs italic">
                                No events to display
                            </div>
                        )}
                    </div>
                </div>

                {/* Sound Assignments */}
                <div className="bg-[var(--bg-card)] p-4 rounded-[var(--radius-lg)] flex flex-col flex-1 min-h-[300px] border border-[var(--border-subtle)] shadow-sm">
                    <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Finger Assignments</h3>
                    <div className="flex-1 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)]">
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
