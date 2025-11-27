import React, { useMemo } from 'react';
import { GridMapping, parseCellKey } from '../types/layout';
import { EngineResult } from '../engine/core';
import { FingerType } from '../engine/models';

interface SoundAssignmentTableProps {
    activeMapping: GridMapping | null;
    engineResult: EngineResult | null;
}

/**
 * Formats finger type to human-readable format (e.g., "thumb" -> "Thumb", "index" -> "Index")
 */
function formatFinger(finger: FingerType): string {
    return finger.charAt(0).toUpperCase() + finger.slice(1);
}

/**
 * Formats hand and finger to full notation (e.g., "left" + "thumb" -> "L-Thumb")
 */
function formatHandFinger(hand: 'left' | 'right' | 'Unplayable', finger: FingerType | null): string {
    if (hand === 'Unplayable' || finger === null) {
        return '—';
    }
    const handPrefix = hand === 'left' ? 'L' : 'R';
    return `${handPrefix}-${formatFinger(finger)}`;
}

/**
 * SoundAssignmentTable: Displays a table showing which sounds are assigned to which pads
 * and which fingers are assigned to play them (based on engine analysis).
 */
export const SoundAssignmentTable: React.FC<SoundAssignmentTableProps> = ({
    activeMapping,
    engineResult,
}) => {
    // Build the assignment data by combining mapping and engine result
    const assignmentData = useMemo(() => {
        // DEBUG: Log what we're receiving
        console.log('[SoundAssignmentTable] Building assignment data:', {
            hasActiveMapping: !!activeMapping,
            hasEngineResult: !!engineResult,
            debugEventsCount: engineResult?.debugEvents?.length || 0,
            fingerUsageStats: engineResult?.fingerUsageStats,
            sampleDebugEvent: engineResult?.debugEvents?.[0],
        });

        if (!activeMapping || !engineResult) {
            console.log('[SoundAssignmentTable] Early return - missing data');
            return [];
        }

        // Create a map of noteNumber -> finger assignment (using the most common assignment)
        const noteToFingerMap = new Map<number, { hand: 'left' | 'right'; finger: FingerType; count: number }[]>();

        engineResult.debugEvents.forEach(event => {
            if (event.assignedHand === 'Unplayable' || event.finger === null) {
                return;
            }

            const existing = noteToFingerMap.get(event.noteNumber) || [];
            const fingerKey = `${event.assignedHand}-${event.finger}`;
            const existingEntry = existing.find(e => `${e.hand}-${e.finger}` === fingerKey);

            if (existingEntry) {
                existingEntry.count++;
            } else {
                existing.push({
                    hand: event.assignedHand,
                    finger: event.finger,
                    count: 1,
                });
            }

            noteToFingerMap.set(event.noteNumber, existing);
        });

        // Build table rows from the active mapping
        const rows = Object.entries(activeMapping.cells).map(([cellKey, sound]) => {
            const parsed = parseCellKey(cellKey);
            if (!parsed) {
                return null;
            }

            // Get the most common finger assignment for this sound's note
            const noteNumber = sound.originalMidiNote;
            let assignedFinger = '—';

            if (noteNumber !== null) {
                const fingerAssignments = noteToFingerMap.get(noteNumber);
                if (fingerAssignments && fingerAssignments.length > 0) {
                    // Sort by count (descending) and take the most common
                    const mostCommon = fingerAssignments.sort((a, b) => b.count - a.count)[0];
                    assignedFinger = formatHandFinger(mostCommon.hand, mostCommon.finger);
                }
            }

            return {
                soundName: sound.name,
                soundColor: sound.color,
                padLocation: `[${parsed.row},${parsed.col}]`,
                row: parsed.row,
                col: parsed.col,
                assignedFinger,
                noteNumber,
            };
        });

        // Filter out nulls and sort by row (descending, so top row is first), then by col
        return rows
            .filter((row): row is NonNullable<typeof row> => row !== null)
            .sort((a, b) => {
                if (a.row !== b.row) {
                    return b.row - a.row; // Sort by row descending (row 7 first)
                }
                return a.col - b.col; // Then by col ascending
            });
    }, [activeMapping, engineResult]);

    if (!activeMapping) {
        return (
            <div className="h-full flex items-center justify-center p-4">
                <div className="text-center text-slate-500 text-sm">
                    <p>No active mapping</p>
                    <p className="text-xs mt-1">Create or select a layout to view assignments</p>
                </div>
            </div>
        );
    }

    if (assignmentData.length === 0) {
        return (
            <div className="h-full flex items-center justify-center p-4">
                <div className="text-center text-slate-500 text-sm">
                    <p>No sounds assigned</p>
                    <p className="text-xs mt-1">Drag sounds from the library to the grid</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex-none px-4 py-3 border-b border-slate-700 bg-slate-800/50">
                <h3 className="text-sm font-semibold text-slate-200">Sound Assignment Table</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                    {assignmentData.length} sound{assignmentData.length !== 1 ? 's' : ''} assigned
                </p>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-800 border-b border-slate-700 z-10">
                        <tr>
                            <th className="px-3 py-2 text-left font-semibold text-slate-300">Sound</th>
                            <th className="px-3 py-2 text-center font-semibold text-slate-300">Pad</th>
                            <th className="px-3 py-2 text-center font-semibold text-slate-300">Finger</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {assignmentData.map((row, index) => (
                            <tr
                                key={`${row.padLocation}-${row.soundName}-${index}`}
                                className="hover:bg-slate-800/50 transition-colors"
                            >
                                {/* Sound Name with color indicator */}
                                <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-3 h-3 rounded-sm flex-shrink-0 border border-slate-600"
                                            style={{ backgroundColor: row.soundColor }}
                                            title={row.soundColor}
                                        />
                                        <span className="text-slate-200 truncate" title={row.soundName}>
                                            {row.soundName}
                                        </span>
                                    </div>
                                </td>

                                {/* Pad Location */}
                                <td className="px-3 py-2 text-center">
                                    <span className="font-mono text-slate-300">{row.padLocation}</span>
                                </td>

                                {/* Assigned Finger */}
                                <td className="px-3 py-2 text-center">
                                    <span
                                        className={`inline-block px-2 py-0.5 rounded font-medium ${row.assignedFinger === '—'
                                            ? 'text-slate-500 bg-slate-800/50'
                                            : row.assignedFinger.startsWith('L-')
                                                ? 'text-blue-300 bg-blue-900/30 border border-blue-800/50'
                                                : 'text-green-300 bg-green-900/30 border border-green-800/50'
                                            }`}
                                    >
                                        {row.assignedFinger}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer info */}
            {!engineResult && (
                <div className="flex-none px-4 py-2 border-t border-slate-700 bg-slate-800/30">
                    <p className="text-xs text-slate-500 italic">
                        Finger assignments will appear after engine analysis
                    </p>
                </div>
            )}
        </div>
    );
};
