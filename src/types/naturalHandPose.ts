/**
 * Natural Hand Pose Types
 * 
 * Defines the data model for user-defined "Natural Hand Pose" configurations.
 * Pose 0 is the default pose that defines where each finger naturally rests on the grid.
 * 
 * TERMINOLOGY (see TERMINOLOGY.md):
 * - FingerId: Unique identifier for each of the 10 fingers (L_THUMB..R_PINKY)
 * - PadCoord: Grid position {row: 0-7, col: 0-7}
 * - NaturalHandPose: Complete pose configuration mapping fingers to pads
 */

import { FingerType } from '../engine/models';
import { cellKey } from './layout';

// ============================================================================
// Core Types
// ============================================================================

/**
 * FingerId: Unique identifier for each finger (10 total).
 * Format: {Hand}_{Finger} where Hand is L/R and Finger is THUMB/INDEX/MIDDLE/RING/PINKY
 */
export type FingerId =
  | 'L_THUMB'
  | 'L_INDEX'
  | 'L_MIDDLE'
  | 'L_RING'
  | 'L_PINKY'
  | 'R_THUMB'
  | 'R_INDEX'
  | 'R_MIDDLE'
  | 'R_RING'
  | 'R_PINKY';

/**
 * All FingerId values in a fixed order for iteration.
 * Order: Left hand (thumb→pinky), then Right hand (thumb→pinky)
 */
export const ALL_FINGER_IDS: readonly FingerId[] = [
  'L_THUMB',
  'L_INDEX',
  'L_MIDDLE',
  'L_RING',
  'L_PINKY',
  'R_THUMB',
  'R_INDEX',
  'R_MIDDLE',
  'R_RING',
  'R_PINKY',
] as const;

/**
 * Finger priority order for seeding (per hand): index → middle → ring → thumb → pinky
 * This order prioritizes the most dexterous fingers first.
 */
export const FINGER_PRIORITY_ORDER: readonly FingerId[] = [
  'L_INDEX',
  'L_MIDDLE',
  'L_RING',
  'L_THUMB',
  'L_PINKY',
  'R_INDEX',
  'R_MIDDLE',
  'R_RING',
  'R_THUMB',
  'R_PINKY',
] as const;

/**
 * PadCoord: Grid position on the 8x8 Push grid.
 * Row 0 is bottom, Row 7 is top. Col 0 is left, Col 7 is right.
 */
export interface PadCoord {
  row: number;
  col: number;
}

/**
 * NaturalHandPose: Complete pose configuration.
 * Defines where each finger should naturally rest on the grid.
 */
export interface NaturalHandPose {
  /** Schema version for future migrations */
  version: 1;
  /** Display name for the pose */
  name: string;
  /** Position index (0 = default Natural Hand Pose) */
  positionIndex: number;
  /** Mapping of each finger to its pad position (null = unassigned) */
  fingerToPad: Record<FingerId, PadCoord | null>;
  /** Maximum vertical shift rows (always 4 for now) */
  maxUpShiftRows: 4;
  /** Last updated timestamp (ISO string) */
  updatedAt: string;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validation result for NaturalHandPose.
 */
export interface PoseValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a NaturalHandPose object.
 * 
 * Rules:
 * - positionIndex must be 0 for Pose 0
 * - All assigned pads must have row/col in [0, 7]
 * - No two fingers can share the same pad (duplicate check)
 * 
 * @param pose - The pose to validate
 * @returns Validation result with error message if invalid
 */
export function validateNaturalHandPose(pose: NaturalHandPose): PoseValidationResult {
  if (!pose || typeof pose !== 'object') {
    return { valid: false, error: 'Pose must be an object' };
  }

  if (pose.version !== 1) {
    return { valid: false, error: `Unsupported pose version: ${pose.version}` };
  }

  if (typeof pose.positionIndex !== 'number') {
    return { valid: false, error: 'positionIndex must be a number' };
  }

  if (!pose.fingerToPad || typeof pose.fingerToPad !== 'object') {
    return { valid: false, error: 'fingerToPad must be an object' };
  }

  // Track occupied pads to detect duplicates
  const occupiedPads = new Map<string, FingerId>();

  for (const fingerId of ALL_FINGER_IDS) {
    const pad = pose.fingerToPad[fingerId];
    
    if (pad === null || pad === undefined) {
      continue; // Unassigned is valid
    }

    if (typeof pad !== 'object') {
      return { valid: false, error: `${fingerId}: pad must be an object or null` };
    }

    const { row, col } = pad;

    if (typeof row !== 'number' || typeof col !== 'number') {
      return { valid: false, error: `${fingerId}: row and col must be numbers` };
    }

    if (row < 0 || row > 7) {
      return { valid: false, error: `${fingerId}: row ${row} is out of range [0, 7]` };
    }

    if (col < 0 || col > 7) {
      return { valid: false, error: `${fingerId}: col ${col} is out of range [0, 7]` };
    }

    // Check for duplicate pad assignment
    const padKey = cellKey(row, col);
    const existingFinger = occupiedPads.get(padKey);
    if (existingFinger) {
      return {
        valid: false,
        error: `Duplicate pad at (${row}, ${col}): both ${existingFinger} and ${fingerId} assigned`,
      };
    }
    occupiedPads.set(padKey, fingerId);
  }

  return { valid: true };
}

// ============================================================================
// Default Pose Factory (Built-in)
// ============================================================================

/**
 * Built-in default Pose 0 cell positions.
 * Thumbs at top row; index/middle/ring/pinky in lower rows.
 * Offset logic ([-4, +4]) is applied when using the pose.
 */
const BUILT_IN_POSE0_CELLS: Record<FingerId, PadCoord> = {
  L_THUMB: { row: 0, col: 3 },
  L_INDEX: { row: 3, col: 3 },
  L_MIDDLE: { row: 4, col: 2 },
  L_RING: { row: 4, col: 1 },
  L_PINKY: { row: 4, col: 0 },
  R_THUMB: { row: 0, col: 4 },
  R_INDEX: { row: 3, col: 4 },
  R_MIDDLE: { row: 4, col: 5 },
  R_RING: { row: 4, col: 6 },
  R_PINKY: { row: 4, col: 7 },
};

/**
 * Creates an empty Pose 0 (all fingers unassigned).
 * Used for tests and when explicitly clearing the pose.
 */
export function createEmptyPose0(): NaturalHandPose {
  const fingerToPad: Record<FingerId, PadCoord | null> = {
    L_THUMB: null,
    L_INDEX: null,
    L_MIDDLE: null,
    L_RING: null,
    L_PINKY: null,
    R_THUMB: null,
    R_INDEX: null,
    R_MIDDLE: null,
    R_RING: null,
    R_PINKY: null,
  };
  return {
    version: 1,
    name: 'Empty Pose',
    positionIndex: 0,
    fingerToPad,
    maxUpShiftRows: 4,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Creates the built-in default Pose 0.
 * All 10 fingers have cell positions; users can edit if desired.
 */
export function createDefaultPose0(): NaturalHandPose {
  const fingerToPad: Record<FingerId, PadCoord | null> = {
    ...BUILT_IN_POSE0_CELLS,
  };

  return {
    version: 1,
    name: 'Natural Hand Pose',
    positionIndex: 0,
    fingerToPad,
    maxUpShiftRows: 4,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Normalization
// ============================================================================

/**
 * Normalizes a pose so that the minimum row becomes 0.
 * This makes the pose translation-invariant vertically.
 * 
 * @param pose - The pose to normalize
 * @returns A new normalized pose (original is not modified)
 */
export function normalizePose0(pose: NaturalHandPose): NaturalHandPose {
  // Find minimum row among assigned pads
  let minRow = Infinity;
  for (const fingerId of ALL_FINGER_IDS) {
    const pad = pose.fingerToPad[fingerId];
    if (pad !== null && pad !== undefined) {
      minRow = Math.min(minRow, pad.row);
    }
  }

  // If no pads assigned, return as-is
  if (minRow === Infinity) {
    return { ...pose, updatedAt: new Date().toISOString() };
  }

  // Shift all rows by -minRow so minimum becomes 0
  const normalizedFingerToPad: Record<FingerId, PadCoord | null> = {} as Record<FingerId, PadCoord | null>;
  for (const fingerId of ALL_FINGER_IDS) {
    const pad = pose.fingerToPad[fingerId];
    if (pad === null || pad === undefined) {
      normalizedFingerToPad[fingerId] = null;
    } else {
      normalizedFingerToPad[fingerId] = {
        row: pad.row - minRow,
        col: pad.col,
      };
    }
  }

  return {
    ...pose,
    fingerToPad: normalizedFingerToPad,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Offset Application
// ============================================================================

/**
 * Result of applying offset to a pose.
 */
export interface PoseWithOffsetEntry {
  fingerId: FingerId;
  row: number;
  col: number;
}

/**
 * Gets the pads from Pose 0 with a vertical offset applied.
 * 
 * @param pose - The natural hand pose
 * @param offsetRow - Signed offset in [-4, +4]. Positive = shift up (increase row), negative = shift down.
 * @param clamp - If true, clamp rows to [0, 7]; if false, return raw values (may be off-grid)
 * @returns Array of finger-to-pad entries with offset applied
 */
export function getPose0PadsWithOffset(
  pose: NaturalHandPose,
  offsetRow: number,
  clamp: boolean = false
): PoseWithOffsetEntry[] {
  const result: PoseWithOffsetEntry[] = [];

  for (const fingerId of ALL_FINGER_IDS) {
    const pad = pose.fingerToPad[fingerId];
    if (pad === null || pad === undefined) {
      continue;
    }

    let row = pad.row + offsetRow;
    const col = pad.col;

    if (clamp) {
      row = Math.max(0, Math.min(7, row));
    }

    result.push({ fingerId, row, col });
  }

  return result;
}

/**
 * Checks if a given offset keeps all assigned fingers on-grid.
 * 
 * @param pose - The natural hand pose
 * @param offsetRow - The offset to check
 * @returns True if all fingers stay within [0, 7] rows
 */
export function isOffsetSafe(pose: NaturalHandPose, offsetRow: number): boolean {
  for (const fingerId of ALL_FINGER_IDS) {
    const pad = pose.fingerToPad[fingerId];
    if (pad === null || pad === undefined) {
      continue;
    }

    const row = pad.row + offsetRow;
    if (row < 0 || row > 7) {
      return false;
    }
  }
  return true;
}

/**
 * Gets the maximum safe offset that keeps all fingers on-grid.
 * Searches from the preferred direction (positive first for "up").
 * 
 * @param pose - The natural hand pose
 * @param preferPositive - If true, prefer positive offsets (shift up); otherwise prefer negative
 * @returns The largest safe offset in [-4, +4], or 0 if no fingers assigned
 */
export function getMaxSafeOffset(pose: NaturalHandPose, preferPositive: boolean = true): number {
  // Find min and max rows among assigned pads
  let minRow = Infinity;
  let maxRow = -Infinity;

  for (const fingerId of ALL_FINGER_IDS) {
    const pad = pose.fingerToPad[fingerId];
    if (pad !== null && pad !== undefined) {
      minRow = Math.min(minRow, pad.row);
      maxRow = Math.max(maxRow, pad.row);
    }
  }

  // No fingers assigned
  if (minRow === Infinity) {
    return 0;
  }

  // Calculate bounds for safe offset
  // After offset: row = storedRow + offset
  // Need: 0 <= storedRow + offset <= 7
  // So: -storedRow <= offset <= 7 - storedRow
  // For all fingers: -minRow <= offset <= 7 - maxRow
  const minSafeOffset = -minRow;
  const maxSafeOffset = 7 - maxRow;

  // Clamp to [-4, +4]
  const clampedMin = Math.max(-4, minSafeOffset);
  const clampedMax = Math.min(4, maxSafeOffset);

  if (preferPositive) {
    // Return the maximum positive offset that's safe
    return Math.min(4, clampedMax);
  } else {
    // Return the maximum negative offset that's safe
    // Use || 0 to avoid returning -0
    return Math.max(-4, clampedMin) || 0;
  }
}

// ============================================================================
// Conversion Helpers
// ============================================================================

/**
 * Converts a FingerId to hand ('left' | 'right') and FingerType.
 * Used for engine/UI integration.
 */
export function fingerIdToHandAndFingerType(fingerId: FingerId): {
  hand: 'left' | 'right';
  finger: FingerType;
} {
  const isLeft = fingerId.startsWith('L_');
  const fingerPart = fingerId.split('_')[1].toLowerCase() as FingerType;

  return {
    hand: isLeft ? 'left' : 'right',
    finger: fingerPart,
  };
}

/**
 * Converts a FingerId to the engine's "L1".."R5" key format.
 * L1 = Left thumb, L2 = Left index, ..., R5 = Right pinky
 */
export function fingerIdToEngineKey(fingerId: FingerId): string {
  const fingerMap: Record<string, number> = {
    THUMB: 1,
    INDEX: 2,
    MIDDLE: 3,
    RING: 4,
    PINKY: 5,
  };

  const hand = fingerId.startsWith('L_') ? 'L' : 'R';
  const fingerPart = fingerId.split('_')[1];
  const num = fingerMap[fingerPart];

  return `${hand}${num}`;
}

/**
 * Converts engine key ("L1".."R5") to FingerId.
 */
export function engineKeyToFingerId(key: string): FingerId | null {
  const match = key.match(/^([LR])(\d)$/);
  if (!match) return null;

  const [, hand, numStr] = match;
  const num = parseInt(numStr, 10);

  const fingerNames: Record<number, string> = {
    1: 'THUMB',
    2: 'INDEX',
    3: 'MIDDLE',
    4: 'RING',
    5: 'PINKY',
  };

  const fingerName = fingerNames[num];
  if (!fingerName) return null;

  return `${hand}_${fingerName}` as FingerId;
}

/**
 * Checks if a pose has any finger assignments.
 */
export function poseHasAssignments(pose: NaturalHandPose): boolean {
  for (const fingerId of ALL_FINGER_IDS) {
    if (pose.fingerToPad[fingerId] !== null && pose.fingerToPad[fingerId] !== undefined) {
      return true;
    }
  }
  return false;
}

/**
 * Gets the count of assigned fingers in a pose.
 */
export function getAssignedFingerCount(pose: NaturalHandPose): number {
  let count = 0;
  for (const fingerId of ALL_FINGER_IDS) {
    if (pose.fingerToPad[fingerId] !== null && pose.fingerToPad[fingerId] !== undefined) {
      count++;
    }
  }
  return count;
}
