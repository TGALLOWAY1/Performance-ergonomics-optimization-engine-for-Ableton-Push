
import { BiomechanicalSolver } from '../engine/core';
import { InstrumentConfig, Performance, NoteEvent } from '../types/performance';
import { DEFAULT_ENGINE_CONSTANTS } from '../engine/models';

// Mock Instrument Config (Standard 8x8 Grid)
const mockInstrumentConfig: InstrumentConfig = {
    id: 'mock-config',
    name: 'Standard 8x8',
    rows: 8,
    cols: 8,
    bottomLeftNote: 36, // C1
    layoutMode: 'drum_64'
};

// Test Case 1: Sequential notes that should reuse the same finger (e.g., Index)
// C3 (48) -> D3 (50) -> E3 (52)
// These are close enough that moving Index should be better than bringing in Middle/Ring if we want "human-like" behavior,
// or at least it shouldn't FORCE unique fingers.
const sequentialPerformance: Performance = {
    name: 'Sequential Test',
    events: [
        { noteNumber: 48, startTime: 0, duration: 0.5, velocity: 100 },
        { noteNumber: 50, startTime: 1, duration: 0.5, velocity: 100 },
        { noteNumber: 52, startTime: 2, duration: 0.5, velocity: 100 },
        { noteNumber: 50, startTime: 3, duration: 0.5, velocity: 100 },
        { noteNumber: 48, startTime: 4, duration: 0.5, velocity: 100 }
    ]
};

// Test Case 2: Crossover Scale
// A scale run that typically requires a crossover (Thumb under or Index over)
// For a grid, this might be moving up a column or across rows.
// Let's try a simple chromatic run that goes "up" the grid.
const crossoverPerformance: Performance = {
    name: 'Crossover Test',
    events: [
        { noteNumber: 60, startTime: 0, duration: 0.5, velocity: 100 },
        { noteNumber: 61, startTime: 1, duration: 0.5, velocity: 100 },
        { noteNumber: 62, startTime: 2, duration: 0.5, velocity: 100 },
        { noteNumber: 63, startTime: 3, duration: 0.5, velocity: 100 },
        { noteNumber: 64, startTime: 4, duration: 0.5, velocity: 100 }
    ]
};

async function runTests() {
    const solver = new BiomechanicalSolver(mockInstrumentConfig);

    console.log('--- Test 1: Sequential Notes (Finger Reuse) ---');
    const result1 = solver.solve(sequentialPerformance);
    result1.debugEvents.forEach(e => {
        console.log(`Note ${e.noteNumber}: ${e.assignedHand} ${e.finger} (Cost: ${e.cost.toFixed(2)})`);
    });

    // Analyze reuse
    const fingersUsed = new Set(result1.debugEvents.map(e => e.finger));
    console.log(`Unique fingers used: ${fingersUsed.size}`);
    if (fingersUsed.size > 2) {
        console.log('FAIL: Engine used too many unique fingers for a simple sequence.');
    } else {
        console.log('PASS: Finger reuse seems reasonable.');
    }

    console.log('\n--- Test 2: Crossover Potential ---');
    const result2 = solver.solve(crossoverPerformance);
    result2.debugEvents.forEach(e => {
        console.log(`Note ${e.noteNumber}: ${e.assignedHand} ${e.finger} (Cost: ${e.cost.toFixed(2)})`);
    });
}

runTests();
