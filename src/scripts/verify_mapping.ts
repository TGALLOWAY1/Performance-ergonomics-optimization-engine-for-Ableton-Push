
import { BiomechanicalSolver } from '../engine/core';
import { InstrumentConfig, Performance } from '../types/performance';
import { GridMapping, Voice } from '../types/layout';

// Mock Instrument Config
const mockInstrumentConfig: InstrumentConfig = {
    id: 'mock-config',
    name: 'Standard 8x8',
    rows: 8,
    cols: 8,
    bottomLeftNote: 36, // C1
    layoutMode: 'drum_64'
};

// Simple performance: Single note C3 (48)
const performance: Performance = {
    name: 'Single Note Test',
    events: [
        { noteNumber: 48, startTime: 0, duration: 0.5, velocity: 100 }
    ]
};

// Default position for 48 (C3) in drum_64 mode starting at 36:
// 48 - 36 = 12
// row = floor(12 / 8) = 1
// col = 12 % 8 = 4
// Position: [1, 4]

// Create a custom mapping that moves 48 to [7, 7] (far away)
const customMapping: GridMapping = {
    id: 'test-mapping',
    name: 'Test Mapping',
    cells: {
        '7,7': {
            originalMidiNote: 48,
            name: 'C3',
            channel: 1
        } as Voice
    },
    fingerConstraints: {},
    scoreCache: null,
    notes: ''
};

async function runTest() {
    console.log('--- Verifying Custom Mapping Support ---');

    // 1. Run without mapping (Default)
    const solverDefault = new BiomechanicalSolver(mockInstrumentConfig);
    const resultDefault = solverDefault.solve(performance);
    const eventDefault = resultDefault.debugEvents[0];

    console.log('Default Assignment (No Mapping):');
    // We can't see internal grid pos directly, but we can infer from cost or debug output if we added it.
    // Let's rely on the fact that I added row/col to EngineDebugEvent in a previous step? 
    // Wait, I didn't add row/col to EngineDebugEvent in the interface definition I saw earlier.
    // But I can check the cost. 
    // Actually, for a single note, the cost is just activation cost + distance from home.
    // Home for left hand is [0, 1], right is [0, 5].
    // Default 48 is at [1, 4].
    // Custom 48 is at [7, 7].

    console.log(`Cost: ${eventDefault.cost.toFixed(2)}`);

    // 2. Run with mapping
    const solverMapped = new BiomechanicalSolver(mockInstrumentConfig, customMapping);
    const resultMapped = solverMapped.solve(performance);
    const eventMapped = resultMapped.debugEvents[0];

    console.log('\nCustom Assignment (Mapped to 7,7):');
    console.log(`Cost: ${eventMapped.cost.toFixed(2)}`);

    if (Math.abs(eventMapped.cost - eventDefault.cost) > 0.1) {
        console.log('\nPASS: Cost changed with custom mapping.');
        if (eventMapped.cost > eventDefault.cost) {
            console.log('PASS: Cost increased as expected (moved further away).');
        } else {
            console.log('WARN: Cost decreased? Check home position logic.');
        }
    } else {
        console.log('\nFAIL: Cost did not change. Engine ignored the mapping.');
    }
}

runTest();
