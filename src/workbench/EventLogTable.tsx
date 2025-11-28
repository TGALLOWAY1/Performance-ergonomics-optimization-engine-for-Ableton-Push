import React from 'react';
import { EngineDebugEvent } from '../engine/core';
import { FingerType } from '../engine/models';

interface EventLogTableProps {
    events: EngineDebugEvent[];
    onAssignmentChange: (index: number, hand: 'left' | 'right', finger: FingerType) => void;
}

const FINGER_OPTIONS: { label: string; value: FingerType }[] = [
    { label: 'Thumb', value: 'thumb' },
    { label: 'Index', value: 'index' },
    { label: 'Middle', value: 'middle' },
    { label: 'Ring', value: 'ring' },
    { label: 'Pinky', value: 'pinky' },
];

export const EventLogTable: React.FC<EventLogTableProps> = ({ events, onAssignmentChange }) => {
    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex-none grid grid-cols-[40px_60px_60px_80px_100px_1fr] gap-2 px-3 py-2 bg-white/5 border-b border-white/10 text-[10px] uppercase text-slate-400 font-semibold tracking-wider">
                <div>#</div>
                <div>Time</div>
                <div>Note</div>
                <div>Hand</div>
                <div>Finger</div>
                <div className="text-right">Cost</div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {events.map((event, index) => (
                    <div
                        key={index}
                        className={`grid grid-cols-[40px_60px_60px_80px_100px_1fr] gap-2 px-3 py-2 border-b border-white/5 text-xs hover:bg-white/5 transition-colors items-center ${event.difficulty === 'Hard' ? 'bg-red-500/10' : ''
                            }`}
                    >
                        <div className="text-slate-500 font-mono">{index + 1}</div>
                        <div className="text-slate-400 font-mono">{event.startTime.toFixed(2)}s</div>
                        <div className="text-white font-medium">{event.noteNumber}</div>

                        {/* Hand Selector */}
                        <div>
                            <select
                                className="bg-slate-800 border border-white/10 rounded px-1 py-0.5 text-[10px] text-white focus:outline-none focus:border-blue-500"
                                value={event.assignedHand === 'Unplayable' ? 'left' : event.assignedHand}
                                onChange={(e) => {
                                    if (event.finger) {
                                        onAssignmentChange(index, e.target.value as 'left' | 'right', event.finger);
                                    }
                                }}
                            >
                                <option value="left">Left</option>
                                <option value="right">Right</option>
                            </select>
                        </div>

                        {/* Finger Selector */}
                        <div>
                            <select
                                className="bg-slate-800 border border-white/10 rounded px-1 py-0.5 text-[10px] text-white focus:outline-none focus:border-blue-500 w-full"
                                value={event.finger || 'Index'}
                                onChange={(e) => {
                                    const hand = event.assignedHand === 'Unplayable' ? 'left' : event.assignedHand;
                                    onAssignmentChange(index, hand as 'left' | 'right', e.target.value as FingerType);
                                }}
                            >
                                {FINGER_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className={`text-right font-mono ${event.cost > 10 ? 'text-red-400' :
                            event.cost > 5 ? 'text-yellow-400' :
                                'text-green-400'
                            }`}>
                            {event.cost === Infinity ? '∞' : event.cost.toFixed(1)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
