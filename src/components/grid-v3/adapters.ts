import { EngineResult, EngineDebugEvent } from '../../engine/core';
import { FingerType } from '../../engine/models';
import { PadActivation, VectorPrimitive, FingerId, HandId } from './types';

// Helper to map FingerType to FingerId
const mapFingerTypeToId = (finger: FingerType): FingerId => {
    switch (finger) {
        case 'thumb': return 1;
        case 'index': return 2;
        case 'middle': return 3;
        case 'ring': return 4;
        case 'pinky': return 5;
        default: return 2; // Default to index if unknown
    }
};

// Helper to map Hand string to HandId
const mapHandToId = (hand: 'left' | 'right' | 'Unplayable'): HandId | undefined => {
    if (hand === 'left') return 'left';
    if (hand === 'right') return 'right';
    return undefined;
};

/**
 * Transforms an EngineResult into a list of PadActivations for Snapshot View.
 * Optionally filters by a specific event index if provided.
 */
export const engineResultToPadActivations = (
    result: EngineResult,
    focusedEventIndex?: number
): PadActivation[] => {
    const activations: PadActivation[] = [];

    result.debugEvents.forEach((event, index) => {
        // If focusedEventIndex is provided, only include that event (and maybe next/prev context if needed)
        // For Snapshot view, we usually want to see the whole sequence or a specific moment.
        // If focusedEventIndex is defined, we might mark it as 'current'.

        if (event.row === undefined || event.col === undefined) return;

        const isCurrent = focusedEventIndex !== undefined && index === focusedEventIndex;
        const isNext = focusedEventIndex !== undefined && index === focusedEventIndex + 1;

        // If we are focusing on a specific event, we might only want to show that one and the next one
        // But for a full "Heatmap" or "Performance" view, we might show all.
        // Let's assume if focusedEventIndex is provided, we prioritize it, but maybe we want to return all?
        // The PRD says "Snapshot View: Solid pads only".
        // Let's return all events as activations, but 'state' might depend on focus.

        // Actually, for a single snapshot (one moment in time), we usually only pass ONE or TWO pads.
        // If the caller wants a full heatmap, they pass all.
        // Let's support a mode where we return everything, but if focusedEventIndex is passed, we highlight it.

        // However, usually we want to generate activations for a SPECIFIC view state.
        // If the view is "Snapshot at index N", we only want N and maybe N+1.

        if (focusedEventIndex !== undefined) {
            if (index !== focusedEventIndex && index !== focusedEventIndex + 1) return;
        }

        const hand = mapHandToId(event.assignedHand);
        const finger = event.finger ? mapFingerTypeToId(event.finger) : undefined;

        activations.push({
            id: `${event.row},${event.col}`,
            row: event.row,
            col: event.col,
            isCurrent,
            isNext,
            isShared: isCurrent && isNext, // Simplified shared logic (same pad)
            hand,
            finger,
            state: isCurrent ? 'active' : isNext ? 'ghost' : 'idle',
            label: event.noteNumber.toString(), // Or note name
            difficulty: event.difficulty,
            intensity: event.difficulty === 'Hard' ? 0.8 : event.difficulty === 'Medium' ? 0.5 : 0.2,
        });
    });

    // Merge duplicates (if multiple events on same pad)
    // For now, simple mapping.
    return activations;
};

/**
 * Transforms an EngineResult into VectorPrimitives for Onion Skinning.
 * Connects event N to N+1.
 */
export const engineResultToVectors = (
    result: EngineResult,
    focusedEventIndex: number
): VectorPrimitive[] => {
    const vectors: VectorPrimitive[] = [];

    if (focusedEventIndex < 0 || focusedEventIndex >= result.debugEvents.length - 1) {
        return vectors;
    }

    const current = result.debugEvents[focusedEventIndex];
    const next = result.debugEvents[focusedEventIndex + 1];

    if (
        current.row !== undefined && current.col !== undefined &&
        next.row !== undefined && next.col !== undefined
    ) {
        vectors.push({
            id: `vec-${focusedEventIndex}-${focusedEventIndex + 1}`,
            type: 'arrow',
            from: { row: current.row, col: current.col },
            to: { row: next.row, col: next.col },
            color: '#FFFFFF',
            opacity: 0.6,
            width: 2,
        });
    }

    return vectors;
};
