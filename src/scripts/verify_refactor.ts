
import { BiomechanicalSolver } from '../engine/core';
import { InstrumentConfig, Performance, NoteEvent } from '../types/performance';
import { GridMapping } from '../types/layout';

// Mock Data
const mockInstrumentConfig: InstrumentConfig = {
    id: 'test-config',
    name: 'Test Config',
    bottomLeftNote: 36, // C2
    rows: 8,
    cols: 8,
    layoutMode: 'drum_64'
};

const mockNoteEvents: NoteEvent[] = [
    { noteNumber: 36, startTime: 0, duration: 1, velocity: 100 }, // C2 (0,0)
    { noteNumber: 37, startTime: 1, duration: 1, velocity: 100 }, // C#2 (0,1)
    { noteNumber: 44, startTime: 2, duration: 1, velocity: 100 }, // G#2 (1,0) - adjacent row
];

const mockPerformance: Performance = {
    name: 'Test Performance',
    tempo: 120,
    events: mockNoteEvents
};

const mockMapping: GridMapping = {
    id: 'test-mapping',
    name: 'Test Mapping',
    cells: {
        '0,0': { id: 'v1', name: 'Kick', originalMidiNote: 36, sourceType: 'midi_track', sourceFile: '', color: '#000' },
        '0,1': { id: 'v2', name: 'Snare', originalMidiNote: 37, sourceType: 'midi_track', sourceFile: '', color: '#000' },
        '1,0': { id: 'v3', name: 'HiHat', originalMidiNote: 44, sourceType: 'midi_track', sourceFile: '', color: '#000' }
    },
    fingerConstraints: {}
};

async function runVerification() {
    console.log('Starting Verification...');

    try {
        // 1. Instantiate Solver
        console.log('Instantiating BiomechanicalSolver...');
        const solver = new BiomechanicalSolver(mockInstrumentConfig);
        console.log('Solver instantiated successfully.');

        // 2. Run Solve
        console.log('Running solve()...');
        const result = await solver.solve(mockPerformance, mockMapping);
        console.log('Solve completed.');

        // 3. Analyze Results
        console.log('Analysis Results:');
        console.log(`Total Cost: ${result.score}`);
        console.log(`Events Processed: ${result.debugEvents.length}`);

        const unplayableCount = result.debugEvents.filter(e => e.difficulty === 'Unplayable').length;
        console.log(`Unplayable Events: ${unplayableCount}`);

        if (unplayableCount === 0) {
            console.log('SUCCESS: No unplayable events found.');
        } else {
            console.error('FAILURE: Unplayable events found!');
            result.debugEvents.forEach(e => {
                if (e.difficulty === 'Unplayable') {
                    console.log(`  - Note ${e.noteNumber} at time ${e.startTime}: Unplayable`);
                }
            });
        }

        // 4. Check specific logic (e.g. hand assignment)
        const hands = result.debugEvents.map(e => e.assignedHand);
        console.log('Hand Assignments:', hands);

    } catch (error) {
        console.error('Verification Failed with Error:', error);
        process.exit(1);
    }
}

runVerification();
