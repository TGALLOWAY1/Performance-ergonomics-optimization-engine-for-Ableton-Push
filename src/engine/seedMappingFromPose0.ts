/**
 * Pose0-based Layout Seeding
 *
 * Deterministically seeds a full GridMapping from performance notes and Pose0.
 * Ensures 100% coverage before optimization.
 */

import { Performance } from '../types/performance';
import { InstrumentConfig } from '../types/performance';
import { GridMapping, Voice, cellKey } from '../types/layout';
import { NaturalHandPose, getPose0PadsWithOffset, FINGER_PRIORITY_ORDER } from '../types/naturalHandPose';
import { getPerformanceNoteSet } from './mappingCoverage';
import { generateId } from '../utils/performanceUtils';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function getNoteName(midiNote: number): string {
  const octave = Math.floor(midiNote / 12) - 2;
  const note = NOTE_NAMES[midiNote % 12];
  return `${note}${octave}`;
}

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#3b82f6', '#8b5cf6',
];

/**
 * Creates a minimal Voice for a note number.
 */
function createVoiceForNote(noteNumber: number, index: number): Voice {
  return {
    id: generateId('sound'),
    name: `${getNoteName(noteNumber)} (${noteNumber})`,
    sourceType: 'midi_track',
    sourceFile: 'seed',
    originalMidiNote: noteNumber,
    color: COLORS[index % COLORS.length],
  };
}

/**
 * Seeds a full GridMapping from performance notes using Pose0 anchor pads.
 * Deterministic: same inputs produce same mapping.
 *
 * @param performance - Performance with note events
 * @param pose0 - Natural hand pose (anchor pads)
 * @param instrumentConfig - Instrument config
 * @param offsetRow - Vertical offset 0..4 (default 0)
 * @param existingVoices - Optional map of noteNumber -> Voice for names/colors
 */
export function seedMappingFromPose0(
  performance: Performance,
  pose0: NaturalHandPose,
  instrumentConfig: InstrumentConfig,
  offsetRow: number = 0,
  existingVoices?: Map<number, Voice>
): GridMapping {
  const requiredNotes = getPerformanceNoteSet(performance);

  // Sort by importance: event count desc, then noteNumber asc
  const noteCounts = new Map<number, number>();
  for (const e of performance.events) {
    noteCounts.set(e.noteNumber, (noteCounts.get(e.noteNumber) ?? 0) + 1);
  }
  const sortedNotes = Array.from(requiredNotes).sort((a, b) => {
    const countA = noteCounts.get(a) ?? 0;
    const countB = noteCounts.get(b) ?? 0;
    if (countB !== countA) return countB - countA;
    return a - b;
  });

  // Get Pose0 pads with offset, ordered by finger priority
  const posePads = getPose0PadsWithOffset(pose0, offsetRow, true);
  const orderedPosePads = FINGER_PRIORITY_ORDER.flatMap((fid) => {
    const entry = posePads.find((p) => p.fingerId === fid);
    return entry ? [{ row: entry.row, col: entry.col }] : [];
  }).filter((p) => p.row >= 0 && p.row <= 7 && p.col >= 0 && p.col <= 7);

  // Build set of occupied pads
  const occupied = new Set<string>();
  for (const p of orderedPosePads) {
    occupied.add(cellKey(p.row, p.col));
  }

  // Deterministic pad order for remaining: row-major, then by distance from Pose0 centroid
  const allPads: { row: number; col: number }[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      allPads.push({ row, col });
    }
  }
  const remainingPads = allPads.filter((p) => !occupied.has(cellKey(p.row, p.col)));

  const cells: Record<string, Voice> = {};
  const padOrder = [...orderedPosePads, ...remainingPads];

  for (let i = 0; i < sortedNotes.length && i < padOrder.length; i++) {
    const noteNumber = sortedNotes[i];
    const pad = padOrder[i];
    const key = cellKey(pad.row, pad.col);
    const voice = existingVoices?.get(noteNumber) ?? createVoiceForNote(noteNumber, i);
    cells[key] = { ...voice, originalMidiNote: noteNumber };
  }

  return {
    id: generateId('mapping'),
    name: `${performance.name ?? 'Performance'} Layout`,
    cells,
    fingerConstraints: {},
    scoreCache: null,
    notes: `Seeded from Pose0 (offset ${offsetRow})`,
    layoutMode: 'optimized',
  };
}
