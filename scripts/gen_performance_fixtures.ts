/**
 * Performance Fixture Generator
 * 
 * Generates JSON performance fixtures for solver tests.
 * All fixtures use SECONDS for startTime and duration (canonical unit).
 * 
 * Run with: npx tsx scripts/gen_performance_fixtures.ts
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface NoteEvent {
  noteNumber: number;
  startTime: number;
  duration: number;
  velocity: number;
  eventKey: string;
}

interface Performance {
  name: string;
  tempo: number;
  events: NoteEvent[];
}

const OUTPUT_DIR = join(__dirname, '..', 'src', 'engine', '__tests__', 'fixtures', 'performances');

function beatsToSeconds(beats: number, bpm: number): number {
  return (60 / bpm) * beats;
}

function generateEventKey(index: number, startTime: number, noteNumber: number, ordinal: number = 1): string {
  return `${index}:${startTime.toFixed(4)}:${noteNumber}:${ordinal}`;
}

function writeFixture(performance: Performance): void {
  const filename = `${performance.name}.json`;
  const filepath = join(OUTPUT_DIR, filename);
  writeFileSync(filepath, JSON.stringify(performance, null, 2));
  console.log(`Wrote: ${filename}`);
}

/**
 * F01: Same pad 16ths, 1 bar @140 BPM
 * Tests: fatigue increases, bounce > 0
 */
function generateF01(): Performance {
  const bpm = 140;
  const noteNumber = 36;
  const events: NoteEvent[] = [];
  
  for (let i = 0; i < 16; i++) {
    const startTime = beatsToSeconds(i * 0.25, bpm);
    events.push({
      noteNumber,
      startTime,
      duration: beatsToSeconds(0.2, bpm),
      velocity: 100,
      eventKey: generateEventKey(i, startTime, noteNumber),
    });
  }
  
  return { name: 'F01', tempo: bpm, events };
}

/**
 * F02: Same pad quarters, 8 bars
 * Tests: drift present, fatigue ~flat
 */
function generateF02(): Performance {
  const bpm = 120;
  const noteNumber = 40;
  const events: NoteEvent[] = [];
  
  for (let i = 0; i < 32; i++) {
    const startTime = beatsToSeconds(i, bpm);
    events.push({
      noteNumber,
      startTime,
      duration: beatsToSeconds(0.8, bpm),
      velocity: 100,
      eventKey: generateEventKey(i, startTime, noteNumber),
    });
  }
  
  return { name: 'F02', tempo: bpm, events };
}

/**
 * F03: Adjacent alternation 8ths
 * Tests: crossover ~0, movement low, 2-hand usage
 */
function generateF03(): Performance {
  const bpm = 120;
  const notes = [36, 37];
  const events: NoteEvent[] = [];
  
  for (let i = 0; i < 16; i++) {
    const startTime = beatsToSeconds(i * 0.5, bpm);
    const noteNumber = notes[i % 2];
    events.push({
      noteNumber,
      startTime,
      duration: beatsToSeconds(0.4, bpm),
      velocity: 100,
      eventKey: generateEventKey(i, startTime, noteNumber),
    });
  }
  
  return { name: 'F03', tempo: bpm, events };
}

/**
 * F04: Wide alternation 8ths
 * Tests: crossover low, movement >= F03 or hand-split
 */
function generateF04(): Performance {
  const bpm = 120;
  const notes = [36, 51];
  const events: NoteEvent[] = [];
  
  for (let i = 0; i < 16; i++) {
    const startTime = beatsToSeconds(i * 0.5, bpm);
    const noteNumber = notes[i % 2];
    events.push({
      noteNumber,
      startTime,
      duration: beatsToSeconds(0.4, bpm),
      velocity: 100,
      eventKey: generateEventKey(i, startTime, noteNumber),
    });
  }
  
  return { name: 'F04', tempo: bpm, events };
}

/**
 * F05_slow: Medium jump at quarter notes (slow tempo)
 * Tests: feasibility at slow speed
 */
function generateF05Slow(): Performance {
  const bpm = 80;
  const notes = [36, 48, 36, 48, 36, 48, 36, 48];
  const events: NoteEvent[] = [];
  
  for (let i = 0; i < notes.length; i++) {
    const startTime = beatsToSeconds(i, bpm);
    const noteNumber = notes[i];
    events.push({
      noteNumber,
      startTime,
      duration: beatsToSeconds(0.8, bpm),
      velocity: 100,
      eventKey: generateEventKey(i, startTime, noteNumber),
    });
  }
  
  return { name: 'F05_slow', tempo: bpm, events };
}

/**
 * F05_fast: Medium jump at 16ths (fast tempo)
 * Tests: feasibility weakens or big cost jump at higher speed
 */
function generateF05Fast(): Performance {
  const bpm = 160;
  const notes = [36, 48, 36, 48, 36, 48, 36, 48, 36, 48, 36, 48, 36, 48, 36, 48];
  const events: NoteEvent[] = [];
  
  for (let i = 0; i < notes.length; i++) {
    const startTime = beatsToSeconds(i * 0.25, bpm);
    const noteNumber = notes[i];
    events.push({
      noteNumber,
      startTime,
      duration: beatsToSeconds(0.2, bpm),
      velocity: 100,
      eventKey: generateEventKey(i, startTime, noteNumber),
    });
  }
  
  return { name: 'F05_fast', tempo: bpm, events };
}

/**
 * F06: Impossible leap at 16ths (extreme)
 * Tests: unplayableCount > 0, Unplayable flagged (notes outside grid)
 */
function generateF06(): Performance {
  const bpm = 140;
  const events: NoteEvent[] = [];
  
  for (let i = 0; i < 8; i++) {
    const startTime = beatsToSeconds(i * 0.25, bpm);
    const noteNumber = 200 + i;
    events.push({
      noteNumber,
      startTime,
      duration: beatsToSeconds(0.2, bpm),
      velocity: 100,
      eventKey: generateEventKey(i, startTime, noteNumber),
    });
  }
  
  return { name: 'F06', tempo: bpm, events };
}

/**
 * F07: Triad compact
 * Tests: >= 3 fingers, low crossover
 */
function generateF07(): Performance {
  const bpm = 120;
  const chordNotes = [36, 40, 43];
  const events: NoteEvent[] = [];
  
  for (let beat = 0; beat < 4; beat++) {
    const startTime = beatsToSeconds(beat, bpm);
    for (let j = 0; j < chordNotes.length; j++) {
      events.push({
        noteNumber: chordNotes[j],
        startTime,
        duration: beatsToSeconds(0.9, bpm),
        velocity: 100,
        eventKey: generateEventKey(beat * 3 + j, startTime, chordNotes[j], j + 1),
      });
    }
  }
  
  return { name: 'F07', tempo: bpm, events };
}

/**
 * F08: Triad large span
 * Tests: both hands in chord, low crossover
 */
function generateF08(): Performance {
  const bpm = 120;
  const chordNotes = [36, 48, 60];
  const events: NoteEvent[] = [];
  
  for (let beat = 0; beat < 4; beat++) {
    const startTime = beatsToSeconds(beat, bpm);
    for (let j = 0; j < chordNotes.length; j++) {
      events.push({
        noteNumber: chordNotes[j],
        startTime,
        duration: beatsToSeconds(0.9, bpm),
        velocity: 100,
        eventKey: generateEventKey(beat * 3 + j, startTime, chordNotes[j], j + 1),
      });
    }
  }
  
  return { name: 'F08', tempo: bpm, events };
}

/**
 * F09: Cluster chord tight
 * Tests: split-hands or Unplayable
 */
function generateF09(): Performance {
  const bpm = 120;
  const chordNotes = [36, 37, 38, 39, 40];
  const events: NoteEvent[] = [];
  
  for (let beat = 0; beat < 4; beat++) {
    const startTime = beatsToSeconds(beat, bpm);
    for (let j = 0; j < chordNotes.length; j++) {
      events.push({
        noteNumber: chordNotes[j],
        startTime,
        duration: beatsToSeconds(0.9, bpm),
        velocity: 100,
        eventKey: generateEventKey(beat * 5 + j, startTime, chordNotes[j], j + 1),
      });
    }
  }
  
  return { name: 'F09', tempo: bpm, events };
}

/**
 * F10: 2-octave chromatic 16ths
 * Tests: jerk/movement not spiky, crossovers low
 */
function generateF10(): Performance {
  const bpm = 100;
  const events: NoteEvent[] = [];
  
  for (let i = 0; i < 24; i++) {
    const startTime = beatsToSeconds(i * 0.25, bpm);
    const noteNumber = 36 + i;
    events.push({
      noteNumber,
      startTime,
      duration: beatsToSeconds(0.2, bpm),
      velocity: 100,
      eventKey: generateEventKey(i, startTime, noteNumber),
    });
  }
  
  return { name: 'F10', tempo: bpm, events };
}

/**
 * F11: Off-grid micro-offsets
 * Tests: stable order, no NaNs, deterministic
 */
function generateF11(): Performance {
  const events: NoteEvent[] = [
    { noteNumber: 36, startTime: 0.001, duration: 0.1, velocity: 100, eventKey: '0:0.0010:36:1' },
    { noteNumber: 37, startTime: 0.502, duration: 0.1, velocity: 100, eventKey: '1:0.5020:37:1' },
    { noteNumber: 38, startTime: 1.003, duration: 0.1, velocity: 100, eventKey: '2:1.0030:38:1' },
    { noteNumber: 39, startTime: 1.504, duration: 0.1, velocity: 100, eventKey: '3:1.5040:39:1' },
    { noteNumber: 40, startTime: 2.005, duration: 0.1, velocity: 100, eventKey: '4:2.0050:40:1' },
  ];
  
  return { name: 'F11', tempo: 120, events };
}

/**
 * F12: Grace cluster (t=0, t=+10ms)
 * Tests: consistent ordering/assignment, no crash
 */
function generateF12(): Performance {
  const events: NoteEvent[] = [
    { noteNumber: 36, startTime: 0.0, duration: 0.5, velocity: 100, eventKey: '0:0.0000:36:1' },
    { noteNumber: 37, startTime: 0.01, duration: 0.5, velocity: 100, eventKey: '1:0.0100:37:1' },
    { noteNumber: 38, startTime: 0.02, duration: 0.5, velocity: 100, eventKey: '2:0.0200:38:1' },
    { noteNumber: 39, startTime: 0.5, duration: 0.5, velocity: 100, eventKey: '3:0.5000:39:1' },
    { noteNumber: 40, startTime: 0.51, duration: 0.5, velocity: 100, eventKey: '4:0.5100:40:1' },
  ];
  
  return { name: 'F12', tempo: 120, events };
}

/**
 * I01: Dense 32nd bursts
 * Tests: fatigue dominates, hand alternation
 */
function generateI01(): Performance {
  const bpm = 120;
  const notes = [36, 37, 38, 39, 40, 41, 42, 43];
  const events: NoteEvent[] = [];
  
  for (let i = 0; i < 32; i++) {
    const startTime = beatsToSeconds(i * 0.125, bpm);
    const noteNumber = notes[i % notes.length];
    events.push({
      noteNumber,
      startTime,
      duration: beatsToSeconds(0.1, bpm),
      velocity: 100,
      eventKey: generateEventKey(i, startTime, noteNumber),
    });
  }
  
  return { name: 'I01', tempo: bpm, events };
}

/**
 * I02: Hi-hat-ish repeat across 2 notes
 * Tests: bounce > 0, movement low, stable
 */
function generateI02(): Performance {
  const bpm = 120;
  const notes = [42, 46];
  const events: NoteEvent[] = [];
  
  for (let i = 0; i < 32; i++) {
    const startTime = beatsToSeconds(i * 0.25, bpm);
    const noteNumber = notes[i % 2];
    events.push({
      noteNumber,
      startTime,
      duration: beatsToSeconds(0.2, bpm),
      velocity: 100,
      eventKey: generateEventKey(i, startTime, noteNumber),
    });
  }
  
  return { name: 'I02', tempo: bpm, events };
}

/**
 * I03: Spider walk
 * Tests: crossover penalty in at least one mapping
 */
function generateI03(): Performance {
  const bpm = 100;
  const events: NoteEvent[] = [];
  
  const pattern = [36, 44, 37, 45, 38, 46, 39, 47, 40, 48];
  
  for (let i = 0; i < pattern.length * 2; i++) {
    const startTime = beatsToSeconds(i * 0.5, bpm);
    const noteNumber = pattern[i % pattern.length];
    events.push({
      noteNumber,
      startTime,
      duration: beatsToSeconds(0.4, bpm),
      velocity: 100,
      eventKey: generateEventKey(i, startTime, noteNumber),
    });
  }
  
  return { name: 'I03', tempo: bpm, events };
}

/**
 * I04: 2-hand bass+melody
 * Tests: LH left region, RH right region
 */
function generateI04(): Performance {
  const bpm = 120;
  const events: NoteEvent[] = [];
  
  const bassNotes = [36, 38, 36, 40];
  const melodyNotes = [60, 62, 64, 62];
  
  for (let i = 0; i < 8; i++) {
    const beatStart = beatsToSeconds(i, bpm);
    
    events.push({
      noteNumber: bassNotes[i % bassNotes.length],
      startTime: beatStart,
      duration: beatsToSeconds(0.9, bpm),
      velocity: 100,
      eventKey: generateEventKey(i * 2, beatStart, bassNotes[i % bassNotes.length], 1),
    });
    
    events.push({
      noteNumber: melodyNotes[i % melodyNotes.length],
      startTime: beatStart + beatsToSeconds(0.5, bpm),
      duration: beatsToSeconds(0.4, bpm),
      velocity: 80,
      eventKey: generateEventKey(i * 2 + 1, beatStart + beatsToSeconds(0.5, bpm), melodyNotes[i % melodyNotes.length], 1),
    });
  }
  
  events.sort((a, b) => a.startTime - b.startTime);
  
  return { name: 'I04', tempo: bpm, events };
}

/**
 * I05: Mixed benchmark (low/med/high/pathological)
 * Tests: score bands (regression gate)
 */
function generateI05(): Performance {
  const bpm = 120;
  const events: NoteEvent[] = [];
  let idx = 0;
  
  for (let i = 0; i < 4; i++) {
    const startTime = beatsToSeconds(i, bpm);
    events.push({
      noteNumber: 36,
      startTime,
      duration: beatsToSeconds(0.9, bpm),
      velocity: 100,
      eventKey: generateEventKey(idx++, startTime, 36),
    });
  }
  
  for (let i = 0; i < 8; i++) {
    const startTime = beatsToSeconds(4 + i * 0.5, bpm);
    const note = i % 2 === 0 ? 40 : 44;
    events.push({
      noteNumber: note,
      startTime,
      duration: beatsToSeconds(0.4, bpm),
      velocity: 100,
      eventKey: generateEventKey(idx++, startTime, note),
    });
  }
  
  for (let i = 0; i < 16; i++) {
    const startTime = beatsToSeconds(8 + i * 0.25, bpm);
    const note = 36 + (i % 8);
    events.push({
      noteNumber: note,
      startTime,
      duration: beatsToSeconds(0.2, bpm),
      velocity: 100,
      eventKey: generateEventKey(idx++, startTime, note),
    });
  }
  
  for (let beat = 12; beat < 16; beat++) {
    const startTime = beatsToSeconds(beat, bpm);
    for (let j = 0; j < 4; j++) {
      events.push({
        noteNumber: 48 + j * 4,
        startTime,
        duration: beatsToSeconds(0.9, bpm),
        velocity: 100,
        eventKey: generateEventKey(idx++, startTime, 48 + j * 4, j + 1),
      });
    }
  }
  
  return { name: 'I05', tempo: bpm, events };
}

function main(): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  
  console.log('Generating performance fixtures...\n');
  
  writeFixture(generateF01());
  writeFixture(generateF02());
  writeFixture(generateF03());
  writeFixture(generateF04());
  writeFixture(generateF05Slow());
  writeFixture(generateF05Fast());
  writeFixture(generateF06());
  writeFixture(generateF07());
  writeFixture(generateF08());
  writeFixture(generateF09());
  writeFixture(generateF10());
  writeFixture(generateF11());
  writeFixture(generateF12());
  
  writeFixture(generateI01());
  writeFixture(generateI02());
  writeFixture(generateI03());
  writeFixture(generateI04());
  writeFixture(generateI05());
  
  console.log('\nDone! Generated 18 performance fixtures.');
}

main();
