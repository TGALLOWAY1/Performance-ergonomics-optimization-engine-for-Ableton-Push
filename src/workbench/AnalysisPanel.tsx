import React, { useMemo, useState } from 'react';
import { EngineResult } from '../engine/core';
import { GridMapping } from '../types/layout';
import { SoundAssignmentTable } from './SoundAssignmentTable';
import { Performance } from '../types/performance';
import { EventLogTable } from './EventLogTable';
import { FingerType } from '../engine/models';
import { useProject } from '../context/ProjectContext';
import { EvolutionLogEntry } from '../engine/solvers/types';

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
    const { projectState, getSolverResult } = useProject();
    const [activeTab, setActiveTab] = useState<'summary' | 'comparison' | 'optimization'>('summary');

    // Get solver results for comparison
    const beamResult = getSolverResult('beam');
    const geneticResult = getSolverResult('genetic');
    const annealingResult = getSolverResult('annealing');

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

    // Calculate comparison metrics
    const comparisonMetrics = useMemo(() => {
        const metrics: {
            beam?: { totalCost: number; leftHandPercent: number; rightHandPercent: number; fatigueScore: number };
            genetic?: { totalCost: number; leftHandPercent: number; rightHandPercent: number; fatigueScore: number };
        } = {};

        if (beamResult) {
            let leftHandCount = 0;
            let rightHandCount = 0;
            Object.entries(beamResult.fingerUsageStats).forEach(([key, count]) => {
                if (key.startsWith('L-')) leftHandCount += count;
                if (key.startsWith('R-')) rightHandCount += count;
            });
            const totalHandEvents = leftHandCount + rightHandCount;
            const totalCost = beamResult.averageMetrics.total * (performance?.events.length || 0);
            const fatigueScore = Object.values(beamResult.fatigueMap).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);

            metrics.beam = {
                totalCost,
                leftHandPercent: totalHandEvents > 0 ? Math.round((leftHandCount / totalHandEvents) * 100) : 0,
                rightHandPercent: totalHandEvents > 0 ? Math.round((rightHandCount / totalHandEvents) * 100) : 0,
                fatigueScore,
            };
        }

        if (geneticResult) {
            let leftHandCount = 0;
            let rightHandCount = 0;
            Object.entries(geneticResult.fingerUsageStats).forEach(([key, count]) => {
                if (key.startsWith('L-')) leftHandCount += count;
                if (key.startsWith('R-')) rightHandCount += count;
            });
            const totalHandEvents = leftHandCount + rightHandCount;
            const totalCost = geneticResult.averageMetrics.total * (performance?.events.length || 0);
            const fatigueScore = Object.values(geneticResult.fatigueMap).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);

            metrics.genetic = {
                totalCost,
                leftHandPercent: totalHandEvents > 0 ? Math.round((leftHandCount / totalHandEvents) * 100) : 0,
                rightHandPercent: totalHandEvents > 0 ? Math.round((rightHandCount / totalHandEvents) * 100) : 0,
                fatigueScore,
            };
        }

        return metrics;
    }, [beamResult, geneticResult, performance]);

    return (
        <div className="h-full flex flex-col bg-[var(--bg-panel)] border-l border-[var(--border-subtle)] backdrop-blur-md">
            {/* Header with Tabs */}
            <div className="flex-none border-b border-[var(--border-subtle)] bg-[var(--bg-card)]">
                <div className="flex items-center px-4 h-12">
                    <h2 className="text-sm font-semibold text-[var(--text-primary)] tracking-wide uppercase mr-6">Analysis & Insights</h2>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setActiveTab('summary')}
                            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                                activeTab === 'summary'
                                    ? 'bg-[var(--bg-input)] text-[var(--text-primary)]'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                        >
                            Performance Summary
                        </button>
                        <button
                            onClick={() => setActiveTab('comparison')}
                            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                                activeTab === 'comparison'
                                    ? 'bg-[var(--bg-input)] text-[var(--text-primary)]'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                        >
                            Model Comparison
                        </button>
                        <button
                            onClick={() => setActiveTab('optimization')}
                            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                                activeTab === 'optimization'
                                    ? 'bg-[var(--bg-input)] text-[var(--text-primary)]'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                        >
                            Optimization Process
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6 flex flex-col">
                {activeTab === 'summary' ? (
                    <>
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
                    </>
                ) : activeTab === 'comparison' ? (
                    <>
                        {/* Model Comparison Tab */}
                        <div className="bg-[var(--bg-card)] p-4 rounded-[var(--radius-lg)] space-y-4 flex-none border border-[var(--border-subtle)] shadow-sm">
                            <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Solver Comparison</h3>

                            {/* Metrics Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-[var(--border-subtle)]">
                                            <th className="text-left py-2 px-2 text-[var(--text-secondary)] font-semibold">Metric</th>
                                            <th className="text-center py-2 px-2 text-[var(--text-secondary)] font-semibold">Beam Search</th>
                                            <th className="text-center py-2 px-2 text-[var(--text-secondary)] font-semibold">Genetic Algorithm</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b border-[var(--border-subtle)]">
                                            <td className="py-2 px-2 text-[var(--text-primary)]">Total Cost</td>
                                            <td className="py-2 px-2 text-center font-mono text-[var(--text-primary)]">
                                                {comparisonMetrics.beam ? comparisonMetrics.beam.totalCost.toFixed(1) : '—'}
                                            </td>
                                            <td className="py-2 px-2 text-center font-mono text-[var(--text-primary)]">
                                                {comparisonMetrics.genetic ? comparisonMetrics.genetic.totalCost.toFixed(1) : '—'}
                                            </td>
                                        </tr>
                                        <tr className="border-b border-[var(--border-subtle)]">
                                            <td className="py-2 px-2 text-[var(--text-primary)]">Left Hand Balance</td>
                                            <td className="py-2 px-2 text-center font-mono text-[var(--text-primary)]">
                                                {comparisonMetrics.beam ? `${comparisonMetrics.beam.leftHandPercent}%` : '—'}
                                            </td>
                                            <td className="py-2 px-2 text-center font-mono text-[var(--text-primary)]">
                                                {comparisonMetrics.genetic ? `${comparisonMetrics.genetic.leftHandPercent}%` : '—'}
                                            </td>
                                        </tr>
                                        <tr className="border-b border-[var(--border-subtle)]">
                                            <td className="py-2 px-2 text-[var(--text-primary)]">Right Hand Balance</td>
                                            <td className="py-2 px-2 text-center font-mono text-[var(--text-primary)]">
                                                {comparisonMetrics.beam ? `${comparisonMetrics.beam.rightHandPercent}%` : '—'}
                                            </td>
                                            <td className="py-2 px-2 text-center font-mono text-[var(--text-primary)]">
                                                {comparisonMetrics.genetic ? `${comparisonMetrics.genetic.rightHandPercent}%` : '—'}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="py-2 px-2 text-[var(--text-primary)]">Fatigue Score</td>
                                            <td className="py-2 px-2 text-center font-mono text-[var(--text-primary)]">
                                                {comparisonMetrics.beam ? comparisonMetrics.beam.fatigueScore.toFixed(1) : '—'}
                                            </td>
                                            <td className="py-2 px-2 text-center font-mono text-[var(--text-primary)]">
                                                {comparisonMetrics.genetic ? comparisonMetrics.genetic.fatigueScore.toFixed(1) : '—'}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Evolution Graph */}
                        {geneticResult?.evolutionLog && geneticResult.evolutionLog.length > 0 && (
                            <div className="bg-[var(--bg-card)] p-4 rounded-[var(--radius-lg)] flex-none border border-[var(--border-subtle)] shadow-sm">
                                <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4">Evolution Progress</h3>
                                <EvolutionGraph
                                    evolutionLog={geneticResult.evolutionLog}
                                    beamCost={comparisonMetrics.beam?.totalCost}
                                />
                            </div>
                        )}

                        {(!geneticResult || !geneticResult.evolutionLog || geneticResult.evolutionLog.length === 0) && (
                            <div className="bg-[var(--bg-card)] p-4 rounded-[var(--radius-lg)] flex-none border border-[var(--border-subtle)] shadow-sm">
                                <div className="text-center py-8 text-[var(--text-tertiary)] text-sm italic">
                                    Run the Genetic Algorithm to see evolution progress.
                                </div>
                            </div>
                        )}
                    </>
                ) : activeTab === 'optimization' ? (
                    <>
                        {/* Optimization Process Tab */}
                        {annealingResult?.optimizationLog && annealingResult.optimizationLog.length > 0 ? (
                            <div className="space-y-4">
                                <div className="bg-[var(--bg-card)] p-4 rounded-[var(--radius-lg)] flex-none border border-[var(--border-subtle)] shadow-sm">
                                    <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Simulated Annealing Process</h3>
                                    <p className="text-xs text-[var(--text-tertiary)] mb-4 italic">
                                        The algorithm initially explores random layouts (High Temp) and eventually settles on the most ergonomic configuration.
                                    </p>
                                    <AnnealingProcessGraph optimizationLog={annealingResult.optimizationLog} />
                                </div>

                                {/* Optimization Stats */}
                                <div className="bg-[var(--bg-card)] p-4 rounded-[var(--radius-lg)] flex-none border border-[var(--border-subtle)] shadow-sm">
                                    <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Optimization Statistics</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-[var(--bg-input)] rounded-[var(--radius-md)] p-3 border border-[var(--border-subtle)]">
                                            <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Initial Cost</div>
                                            <div className="text-xl font-light text-[var(--text-primary)] mt-1">
                                                {annealingResult.optimizationLog[0]?.cost.toFixed(2) || '—'}
                                            </div>
                                        </div>
                                        <div className="bg-[var(--bg-input)] rounded-[var(--radius-md)] p-3 border border-[var(--border-subtle)]">
                                            <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Final Cost</div>
                                            <div className="text-xl font-light text-[var(--text-primary)] mt-1">
                                                {annealingResult.optimizationLog[annealingResult.optimizationLog.length - 1]?.cost.toFixed(2) || '—'}
                                            </div>
                                        </div>
                                        <div className="bg-[var(--bg-input)] rounded-[var(--radius-md)] p-3 border border-[var(--border-subtle)]">
                                            <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Improvement</div>
                                            <div className="text-xl font-light text-[var(--text-primary)] mt-1">
                                                {(() => {
                                                    const initial = annealingResult.optimizationLog[0]?.cost || 0;
                                                    const final = annealingResult.optimizationLog[annealingResult.optimizationLog.length - 1]?.cost || 0;
                                                    const improvement = initial > 0 ? ((initial - final) / initial * 100) : 0;
                                                    return `${improvement > 0 ? '-' : ''}${Math.abs(improvement).toFixed(1)}%`;
                                                })()}
                                            </div>
                                        </div>
                                        <div className="bg-[var(--bg-input)] rounded-[var(--radius-md)] p-3 border border-[var(--border-subtle)]">
                                            <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Acceptance Rate</div>
                                            <div className="text-xl font-light text-[var(--text-primary)] mt-1">
                                                {(() => {
                                                    const accepted = annealingResult.optimizationLog.filter(e => e.accepted).length;
                                                    const total = annealingResult.optimizationLog.length;
                                                    return total > 0 ? `${Math.round((accepted / total) * 100)}%` : '—';
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-[var(--bg-card)] p-4 rounded-[var(--radius-lg)] flex-none border border-[var(--border-subtle)] shadow-sm">
                                <div className="text-center py-8 text-[var(--text-tertiary)] text-sm italic">
                                    Run "Auto-Arrange Grid" to see the optimization process visualization.
                                </div>
                            </div>
                        )}
                    </>
                ) : null}

            </div>
        </div>
    );
};

/**
 * Evolution Graph Component - Visualizes GA convergence over generations
 */
interface EvolutionGraphProps {
    evolutionLog: EvolutionLogEntry[];
    beamCost?: number;
}

const EvolutionGraph: React.FC<EvolutionGraphProps> = ({ evolutionLog, beamCost }) => {
    const width = 400;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 30, left: 50 };

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Find min/max for scaling
    const allCosts = evolutionLog.map(e => e.bestCost);
    if (beamCost !== undefined) {
        allCosts.push(beamCost);
    }
    const minCost = Math.min(...allCosts);
    const maxCost = Math.max(...allCosts);
    const costRange = maxCost - minCost || 1;

    // Scale functions
    const scaleX = (generation: number) => {
        const maxGen = Math.max(...evolutionLog.map(e => e.generation));
        return padding.left + (generation / maxGen) * chartWidth;
    };

    const scaleY = (cost: number) => {
        return padding.top + chartHeight - ((cost - minCost) / costRange) * chartHeight;
    };

    // Generate path for best cost line
    const bestCostPath = evolutionLog
        .map((entry, i) => {
            const x = scaleX(entry.generation);
            const y = scaleY(entry.bestCost);
            return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
        })
        .join(' ');

    // Generate path for average cost line
    const avgCostPath = evolutionLog
        .map((entry, i) => {
            const x = scaleX(entry.generation);
            const y = scaleY(entry.averageCost);
            return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
        })
        .join(' ');

    return (
        <div className="w-full">
            <svg width={width} height={height} className="w-full" viewBox={`0 0 ${width} ${height}`}>
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map(frac => {
                    const y = padding.top + chartHeight - (frac * chartHeight);
                    const cost = minCost + (1 - frac) * costRange;
                    return (
                        <g key={frac}>
                            <line
                                x1={padding.left}
                                y1={y}
                                x2={width - padding.right}
                                y2={y}
                                stroke="var(--border-subtle)"
                                strokeWidth="0.5"
                                strokeDasharray="2,2"
                            />
                            <text
                                x={padding.left - 5}
                                y={y + 4}
                                textAnchor="end"
                                fontSize="10"
                                fill="var(--text-tertiary)"
                            >
                                {cost.toFixed(0)}
                            </text>
                        </g>
                    );
                })}

                {/* X-axis labels */}
                {evolutionLog.filter((_, i) => i % Math.ceil(evolutionLog.length / 5) === 0 || i === evolutionLog.length - 1).map(entry => {
                    const x = scaleX(entry.generation);
                    return (
                        <text
                            key={entry.generation}
                            x={x}
                            y={height - padding.bottom + 15}
                            textAnchor="middle"
                            fontSize="10"
                            fill="var(--text-tertiary)"
                        >
                            {entry.generation}
                        </text>
                    );
                })}

                {/* Beam cost reference line */}
                {beamCost !== undefined && (
                    <g>
                        <line
                            x1={padding.left}
                            y1={scaleY(beamCost)}
                            x2={width - padding.right}
                            y2={scaleY(beamCost)}
                            stroke="var(--finger-R2)"
                            strokeWidth="2"
                            strokeDasharray="4,4"
                        />
                        <text
                            x={width - padding.right + 5}
                            y={scaleY(beamCost) + 4}
                            fontSize="10"
                            fill="var(--finger-R2)"
                            fontWeight="bold"
                        >
                            Beam: {beamCost.toFixed(1)}
                        </text>
                    </g>
                )}

                {/* Average cost line */}
                <path
                    d={avgCostPath}
                    fill="none"
                    stroke="var(--text-tertiary)"
                    strokeWidth="1.5"
                    opacity="0.5"
                />

                {/* Best cost line */}
                <path
                    d={bestCostPath}
                    fill="none"
                    stroke="var(--finger-L2)"
                    strokeWidth="2"
                />

                {/* Data points */}
                {evolutionLog.map((entry, i) => (
                    <circle
                        key={i}
                        cx={scaleX(entry.generation)}
                        cy={scaleY(entry.bestCost)}
                        r="3"
                        fill="var(--finger-L2)"
                    />
                ))}

                {/* Axis labels */}
                <text
                    x={width / 2}
                    y={height - 5}
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--text-secondary)"
                    fontWeight="500"
                >
                    Generation
                </text>
                <text
                    x={15}
                    y={height / 2}
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--text-secondary)"
                    fontWeight="500"
                    transform={`rotate(-90, 15, ${height / 2})`}
                >
                    Cost
                </text>

                {/* Legend */}
                <g transform={`translate(${width - padding.right - 120}, ${padding.top + 10})`}>
                    <line x1="0" y1="0" x2="20" y2="0" stroke="var(--finger-L2)" strokeWidth="2" />
                    <text x="25" y="4" fontSize="10" fill="var(--text-primary)">Best Cost</text>
                    <line x1="0" y1="15" x2="20" y2="15" stroke="var(--text-tertiary)" strokeWidth="1.5" opacity="0.5" />
                    <text x="25" y="19" fontSize="10" fill="var(--text-primary)">Avg Cost</text>
                    {beamCost !== undefined && (
                        <>
                            <line x1="0" y1="30" x2="20" y2="30" stroke="var(--finger-R2)" strokeWidth="2" strokeDasharray="4,4" />
                            <text x="25" y="34" fontSize="10" fill="var(--text-primary)">Beam Search</text>
                        </>
                    )}
                </g>
            </svg>
        </div>
    );
};

/**
 * Annealing Process Graph Component - Visualizes SA optimization with cost and temperature
 */
interface AnnealingProcessGraphProps {
    optimizationLog: Array<{ step: number; temp: number; cost: number; accepted: boolean }>;
}

const AnnealingProcessGraph: React.FC<AnnealingProcessGraphProps> = ({ optimizationLog }) => {
    const width = 600;
    const height = 300;
    const padding = { top: 30, right: 80, bottom: 40, left: 60 };

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Find min/max for cost scaling (left Y-axis)
    const allCosts = optimizationLog.map(e => e.cost);
    const minCost = Math.min(...allCosts);
    const maxCost = Math.max(...allCosts);
    const costRange = maxCost - minCost || 1;

    // Find min/max for temperature scaling (right Y-axis)
    const allTemps = optimizationLog.map(e => e.temp);
    const minTemp = Math.min(...allTemps);
    const maxTemp = Math.max(...allTemps);
    const tempRange = maxTemp - minTemp || 1;

    // Scale functions
    const scaleX = (step: number) => {
        const maxStep = Math.max(...optimizationLog.map(e => e.step));
        return padding.left + (step / maxStep) * chartWidth;
    };

    const scaleYCost = (cost: number) => {
        return padding.top + chartHeight - ((cost - minCost) / costRange) * chartHeight;
    };

    const scaleYTemp = (temp: number) => {
        return padding.top + chartHeight - ((temp - minTemp) / tempRange) * chartHeight;
    };

    // Generate path for cost line (noisy at start, smooths out)
    const costPath = optimizationLog
        .map((entry, i) => {
            const x = scaleX(entry.step);
            const y = scaleYCost(entry.cost);
            return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
        })
        .join(' ');

    // Generate path for temperature decay (smooth curve)
    const tempPath = optimizationLog
        .map((entry, i) => {
            const x = scaleX(entry.step);
            const y = scaleYTemp(entry.temp);
            return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
        })
        .join(' ');

    // Generate area path for temperature (filled area)
    const tempAreaPath = tempPath + 
        ` L ${scaleX(optimizationLog[optimizationLog.length - 1].step)} ${padding.top + chartHeight}` +
        ` L ${scaleX(optimizationLog[0].step)} ${padding.top + chartHeight} Z`;

    return (
        <div className="w-full">
            <svg width={width} height={height} className="w-full" viewBox={`0 0 ${width} ${height}`}>
                {/* Grid lines for cost (left Y-axis) */}
                {[0, 0.25, 0.5, 0.75, 1].map(frac => {
                    const y = padding.top + chartHeight - (frac * chartHeight);
                    const cost = minCost + (1 - frac) * costRange;
                    return (
                        <g key={`cost-${frac}`}>
                            <line
                                x1={padding.left}
                                y1={y}
                                x2={width - padding.right}
                                y2={y}
                                stroke="var(--border-subtle)"
                                strokeWidth="0.5"
                                strokeDasharray="2,2"
                            />
                            <text
                                x={padding.left - 5}
                                y={y + 4}
                                textAnchor="end"
                                fontSize="10"
                                fill="var(--text-tertiary)"
                            >
                                {cost.toFixed(1)}
                            </text>
                        </g>
                    );
                })}

                {/* Grid lines for temperature (right Y-axis) */}
                {[0, 0.25, 0.5, 0.75, 1].map(frac => {
                    const y = padding.top + chartHeight - (frac * chartHeight);
                    const temp = minTemp + (1 - frac) * tempRange;
                    return (
                        <g key={`temp-${frac}`}>
                            <text
                                x={width - padding.right + 5}
                                y={y + 4}
                                textAnchor="start"
                                fontSize="10"
                                fill="var(--finger-R3)"
                            >
                                {temp.toFixed(0)}
                            </text>
                        </g>
                    );
                })}

                {/* X-axis labels */}
                {optimizationLog.filter((_, i) => i % Math.ceil(optimizationLog.length / 6) === 0 || i === optimizationLog.length - 1).map(entry => {
                    const x = scaleX(entry.step);
                    return (
                        <g key={entry.step}>
                            <line
                                x1={x}
                                y1={padding.top + chartHeight}
                                x2={x}
                                y2={padding.top + chartHeight + 5}
                                stroke="var(--border-subtle)"
                                strokeWidth="1"
                            />
                            <text
                                x={x}
                                y={height - padding.bottom + 15}
                                textAnchor="middle"
                                fontSize="10"
                                fill="var(--text-tertiary)"
                            >
                                {entry.step}
                            </text>
                        </g>
                    );
                })}

                {/* Temperature area (filled, semi-transparent) */}
                <path
                    d={tempAreaPath}
                    fill="var(--finger-R3)"
                    opacity="0.15"
                />

                {/* Temperature line (smooth decay) */}
                <path
                    d={tempPath}
                    fill="none"
                    stroke="var(--finger-R3)"
                    strokeWidth="2"
                    opacity="0.7"
                />

                {/* Cost line (noisy at start, smooths out) */}
                <path
                    d={costPath}
                    fill="none"
                    stroke="var(--finger-L2)"
                    strokeWidth="2"
                />

                {/* Cost data points (colored by acceptance) */}
                {optimizationLog.map((entry, i) => {
                    // Sample points to avoid overcrowding (show every Nth point)
                    const sampleRate = Math.max(1, Math.floor(optimizationLog.length / 200));
                    if (i % sampleRate !== 0 && i !== optimizationLog.length - 1) return null;
                    
                    const x = scaleX(entry.step);
                    const y = scaleYCost(entry.cost);
                    return (
                        <circle
                            key={i}
                            cx={x}
                            cy={y}
                            r="2"
                            fill={entry.accepted ? "var(--finger-L2)" : "var(--text-tertiary)"}
                            opacity={entry.accepted ? 0.8 : 0.3}
                        />
                    );
                })}

                {/* Axis labels */}
                <text
                    x={width / 2}
                    y={height - 10}
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--text-secondary)"
                    fontWeight="500"
                >
                    Iteration Step
                </text>
                <text
                    x={20}
                    y={height / 2}
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--text-secondary)"
                    fontWeight="500"
                    transform={`rotate(-90, 20, ${height / 2})`}
                >
                    Cost
                </text>
                <text
                    x={width - 20}
                    y={height / 2}
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--finger-R3)"
                    fontWeight="500"
                    transform={`rotate(90, ${width - 20}, ${height / 2})`}
                >
                    Temperature
                </text>

                {/* Legend */}
                <g transform={`translate(${padding.left + 10}, ${padding.top + 10})`}>
                    <line x1="0" y1="0" x2="30" y2="0" stroke="var(--finger-L2)" strokeWidth="2" />
                    <text x="35" y="4" fontSize="10" fill="var(--text-primary)">Cost</text>
                    <line x1="0" y1="15" x2="30" y2="15" stroke="var(--finger-R3)" strokeWidth="2" opacity="0.7" />
                    <text x="35" y="19" fontSize="10" fill="var(--text-primary)">Temperature</text>
                    <rect x="0" y="30" width="30" height="10" fill="var(--finger-R3)" opacity="0.15" />
                    <text x="35" y="39" fontSize="10" fill="var(--text-primary)">Temp Area</text>
                </g>
            </svg>
        </div>
    );
};
