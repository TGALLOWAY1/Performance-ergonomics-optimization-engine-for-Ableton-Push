/**
 * Unit tests for Natural Hand Pose types and utilities
 * 
 * Test checklist from plan:
 * - normalizePose0: Given pads with minRow > 0, stored rows start at 0
 * - getPose0PadsWithOffset: Offsets behave correctly (signed, clamped)
 * - getMaxSafeOffset: Returns largest safe offset in [-4, +4]
 * - validateNaturalHandPose: Catches duplicate pads, invalid coords
 * - Import → normalize: Stable representation after import
 */
import { describe, it, expect } from 'vitest';
import {
  NaturalHandPose,
  FingerId,
  PadCoord,
  createDefaultPose0,
  createEmptyPose0,
  normalizePose0,
  validateNaturalHandPose,
  getPose0PadsWithOffset,
  getMaxSafeOffset,
  isOffsetSafe,
  fingerIdToEngineKey,
  engineKeyToFingerId,
  poseHasAssignments,
  getAssignedFingerCount,
} from '../naturalHandPose';

// ============================================================================
// Test Helpers
// ============================================================================

function createPoseWithPads(pads: Partial<Record<FingerId, PadCoord | null>>): NaturalHandPose {
  const base = createEmptyPose0();
  return {
    ...base,
    fingerToPad: {
      ...base.fingerToPad,
      ...pads,
    },
  };
}

// ============================================================================
// Tests: normalizePose0
// ============================================================================

describe('normalizePose0', () => {
  it('should normalize pose so minRow becomes 0', () => {
    const pose = createPoseWithPads({
      L_INDEX: { row: 3, col: 2 },
      L_MIDDLE: { row: 4, col: 3 },
      R_INDEX: { row: 5, col: 5 },
    });

    const normalized = normalizePose0(pose);

    // minRow was 3, so all rows should be shifted by -3
    expect(normalized.fingerToPad.L_INDEX).toEqual({ row: 0, col: 2 });
    expect(normalized.fingerToPad.L_MIDDLE).toEqual({ row: 1, col: 3 });
    expect(normalized.fingerToPad.R_INDEX).toEqual({ row: 2, col: 5 });
  });

  it('should preserve column values during normalization', () => {
    const pose = createPoseWithPads({
      L_THUMB: { row: 2, col: 0 },
      R_PINKY: { row: 2, col: 7 },
    });

    const normalized = normalizePose0(pose);

    expect(normalized.fingerToPad.L_THUMB?.col).toBe(0);
    expect(normalized.fingerToPad.R_PINKY?.col).toBe(7);
  });

  it('should handle pose already at row 0', () => {
    const pose = createPoseWithPads({
      L_INDEX: { row: 0, col: 2 },
      L_MIDDLE: { row: 1, col: 3 },
    });

    const normalized = normalizePose0(pose);

    expect(normalized.fingerToPad.L_INDEX).toEqual({ row: 0, col: 2 });
    expect(normalized.fingerToPad.L_MIDDLE).toEqual({ row: 1, col: 3 });
  });

  it('should handle empty pose (no assignments)', () => {
    const pose = createEmptyPose0();
    const normalized = normalizePose0(pose);

    // Should not throw, all fingers should remain null
    for (const fingerId of Object.keys(normalized.fingerToPad) as FingerId[]) {
      expect(normalized.fingerToPad[fingerId]).toBeNull();
    }
  });

  it('should set a valid updatedAt timestamp', () => {
    const pose = createPoseWithPads({
      L_INDEX: { row: 3, col: 2 },
    });

    const normalized = normalizePose0(pose);

    // Should be a valid ISO timestamp
    expect(typeof normalized.updatedAt).toBe('string');
    expect(new Date(normalized.updatedAt).getTime()).not.toBeNaN();
  });
});

// ============================================================================
// Tests: getPose0PadsWithOffset
// ============================================================================

describe('getPose0PadsWithOffset', () => {
  it('should return pads unchanged with offset 0', () => {
    const pose = createPoseWithPads({
      L_INDEX: { row: 0, col: 2 },
      R_INDEX: { row: 2, col: 5 },
    });

    const pads = getPose0PadsWithOffset(pose, 0);

    expect(pads).toHaveLength(2);
    expect(pads.find(p => p.fingerId === 'L_INDEX')).toEqual({
      fingerId: 'L_INDEX',
      row: 0,
      col: 2,
    });
    expect(pads.find(p => p.fingerId === 'R_INDEX')).toEqual({
      fingerId: 'R_INDEX',
      row: 2,
      col: 5,
    });
  });

  it('should apply positive offset (shift up)', () => {
    const pose = createPoseWithPads({
      L_INDEX: { row: 0, col: 2 },
      L_MIDDLE: { row: 1, col: 3 },
    });

    const pads = getPose0PadsWithOffset(pose, 3);

    expect(pads.find(p => p.fingerId === 'L_INDEX')?.row).toBe(3);
    expect(pads.find(p => p.fingerId === 'L_MIDDLE')?.row).toBe(4);
  });

  it('should apply negative offset (shift down)', () => {
    const pose = createPoseWithPads({
      L_INDEX: { row: 4, col: 2 },
      L_MIDDLE: { row: 5, col: 3 },
    });

    const pads = getPose0PadsWithOffset(pose, -2);

    expect(pads.find(p => p.fingerId === 'L_INDEX')?.row).toBe(2);
    expect(pads.find(p => p.fingerId === 'L_MIDDLE')?.row).toBe(3);
  });

  it('should allow off-grid rows when clamp=false', () => {
    const pose = createPoseWithPads({
      L_INDEX: { row: 0, col: 2 },
    });

    const pads = getPose0PadsWithOffset(pose, -2, false);

    expect(pads[0].row).toBe(-2); // Off-grid, but allowed
  });

  it('should clamp rows to [0,7] when clamp=true', () => {
    const pose = createPoseWithPads({
      L_INDEX: { row: 0, col: 2 },
      R_INDEX: { row: 6, col: 5 },
    });

    // Offset -3 would put L_INDEX at -3
    const padsDown = getPose0PadsWithOffset(pose, -3, true);
    expect(padsDown.find(p => p.fingerId === 'L_INDEX')?.row).toBe(0); // Clamped to 0

    // Offset +3 would put R_INDEX at 9
    const padsUp = getPose0PadsWithOffset(pose, 3, true);
    expect(padsUp.find(p => p.fingerId === 'R_INDEX')?.row).toBe(7); // Clamped to 7
  });

  it('should preserve column values', () => {
    const pose = createPoseWithPads({
      L_THUMB: { row: 0, col: 0 },
      R_PINKY: { row: 0, col: 7 },
    });

    const pads = getPose0PadsWithOffset(pose, 4);

    expect(pads.find(p => p.fingerId === 'L_THUMB')?.col).toBe(0);
    expect(pads.find(p => p.fingerId === 'R_PINKY')?.col).toBe(7);
  });

  it('should skip null assignments', () => {
    const pose = createPoseWithPads({
      L_INDEX: { row: 0, col: 2 },
      // All others are null
    });

    const pads = getPose0PadsWithOffset(pose, 0);

    expect(pads).toHaveLength(1);
    expect(pads[0].fingerId).toBe('L_INDEX');
  });
});

// ============================================================================
// Tests: getMaxSafeOffset
// ============================================================================

describe('getMaxSafeOffset', () => {
  it('should return 0 for empty pose', () => {
    const pose = createEmptyPose0();
    expect(getMaxSafeOffset(pose)).toBe(0);
  });

  it('should return max positive offset when preferPositive=true', () => {
    // Pose at rows 0-2, max safe positive offset is 7-2=5, clamped to 4
    const pose = createPoseWithPads({
      L_INDEX: { row: 0, col: 2 },
      L_MIDDLE: { row: 1, col: 3 },
      L_RING: { row: 2, col: 4 },
    });

    const offset = getMaxSafeOffset(pose, true);

    expect(offset).toBe(4); // Clamped to max of 4
  });

  it('should return max negative offset when preferPositive=false', () => {
    // Pose at rows 3-5, max safe negative offset is -3
    const pose = createPoseWithPads({
      L_INDEX: { row: 3, col: 2 },
      L_MIDDLE: { row: 4, col: 3 },
      L_RING: { row: 5, col: 4 },
    });

    const offset = getMaxSafeOffset(pose, false);

    expect(offset).toBe(-3);
  });

  it('should respect [-4, +4] bounds', () => {
    // Pose spans rows 0-7, so only offset 0 is safe
    const pose = createPoseWithPads({
      L_INDEX: { row: 0, col: 2 },
      R_INDEX: { row: 7, col: 5 },
    });

    expect(getMaxSafeOffset(pose, true)).toEqual(0);
    expect(getMaxSafeOffset(pose, false)).toEqual(0);
  });

  it('should calculate correct offset for normalized pose', () => {
    // Normalized pose at rows 0-3, can shift up by 4 (7-3=4)
    const pose = createPoseWithPads({
      L_THUMB: { row: 0, col: 1 },
      L_INDEX: { row: 1, col: 2 },
      L_MIDDLE: { row: 2, col: 3 },
      L_RING: { row: 3, col: 4 },
    });

    expect(getMaxSafeOffset(pose, true)).toBe(4);
    expect(getMaxSafeOffset(pose, false)).toEqual(0); // Can't go lower than 0
  });
});

// ============================================================================
// Tests: isOffsetSafe
// ============================================================================

describe('isOffsetSafe', () => {
  it('should return true for offset 0', () => {
    const pose = createPoseWithPads({
      L_INDEX: { row: 3, col: 2 },
    });

    expect(isOffsetSafe(pose, 0)).toBe(true);
  });

  it('should return false when offset pushes finger below 0', () => {
    const pose = createPoseWithPads({
      L_INDEX: { row: 2, col: 2 },
    });

    expect(isOffsetSafe(pose, -3)).toBe(false); // Would put row at -1
  });

  it('should return false when offset pushes finger above 7', () => {
    const pose = createPoseWithPads({
      L_INDEX: { row: 5, col: 2 },
    });

    expect(isOffsetSafe(pose, 3)).toBe(false); // Would put row at 8
  });

  it('should return true for empty pose with any offset', () => {
    const pose = createEmptyPose0();

    expect(isOffsetSafe(pose, -4)).toBe(true);
    expect(isOffsetSafe(pose, 4)).toBe(true);
  });
});

// ============================================================================
// Tests: validateNaturalHandPose
// ============================================================================

describe('validateNaturalHandPose', () => {
  it('should validate a correct pose', () => {
    const pose = createPoseWithPads({
      L_INDEX: { row: 2, col: 3 },
      R_INDEX: { row: 2, col: 5 },
    });

    const result = validateNaturalHandPose(pose);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should reject duplicate pad assignments', () => {
    const pose = createPoseWithPads({
      L_INDEX: { row: 2, col: 3 },
      R_INDEX: { row: 2, col: 3 }, // Same pad!
    });

    const result = validateNaturalHandPose(pose);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Duplicate pad');
    expect(result.error).toContain('L_INDEX');
    expect(result.error).toContain('R_INDEX');
  });

  it('should reject row out of range (< 0)', () => {
    const pose = createPoseWithPads({
      L_INDEX: { row: -1, col: 3 },
    });

    const result = validateNaturalHandPose(pose);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('row');
    expect(result.error).toContain('out of range');
  });

  it('should reject row out of range (> 7)', () => {
    const pose = createPoseWithPads({
      L_INDEX: { row: 8, col: 3 },
    });

    const result = validateNaturalHandPose(pose);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('row');
    expect(result.error).toContain('out of range');
  });

  it('should reject col out of range (< 0)', () => {
    const pose = createPoseWithPads({
      L_INDEX: { row: 2, col: -1 },
    });

    const result = validateNaturalHandPose(pose);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('col');
    expect(result.error).toContain('out of range');
  });

  it('should reject col out of range (> 7)', () => {
    const pose = createPoseWithPads({
      L_INDEX: { row: 2, col: 8 },
    });

    const result = validateNaturalHandPose(pose);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('col');
    expect(result.error).toContain('out of range');
  });

  it('should accept empty pose (all null)', () => {
    const pose = createEmptyPose0();

    const result = validateNaturalHandPose(pose);

    expect(result.valid).toBe(true);
  });

  it('should reject non-object pose', () => {
    const result = validateNaturalHandPose(null as unknown as NaturalHandPose);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('must be an object');
  });

  it('should reject invalid version', () => {
    const pose = {
      ...createDefaultPose0(),
      version: 2 as const,
    };

    const result = validateNaturalHandPose(pose as unknown as NaturalHandPose);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('version');
  });
});

// ============================================================================
// Tests: Import → Normalize (Stable Representation)
// ============================================================================

describe('Import → Normalize', () => {
  it('should produce stable representation after import and normalize', () => {
    // Simulate an imported pose with minRow > 0
    const importedPose: NaturalHandPose = {
      version: 1,
      name: 'Imported Pose',
      positionIndex: 0,
      fingerToPad: {
        L_THUMB: null,
        L_INDEX: { row: 4, col: 2 },
        L_MIDDLE: { row: 5, col: 3 },
        L_RING: null,
        L_PINKY: null,
        R_THUMB: null,
        R_INDEX: { row: 6, col: 5 },
        R_MIDDLE: null,
        R_RING: null,
        R_PINKY: null,
      },
      maxUpShiftRows: 4,
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    // First normalize
    const normalized1 = normalizePose0(importedPose);

    // Second normalize should be identical (idempotent)
    const normalized2 = normalizePose0(normalized1);

    // Rows should be the same (both normalized)
    expect(normalized1.fingerToPad.L_INDEX?.row).toBe(normalized2.fingerToPad.L_INDEX?.row);
    expect(normalized1.fingerToPad.L_MIDDLE?.row).toBe(normalized2.fingerToPad.L_MIDDLE?.row);
    expect(normalized1.fingerToPad.R_INDEX?.row).toBe(normalized2.fingerToPad.R_INDEX?.row);

    // Min row should be 0
    const rows = [
      normalized1.fingerToPad.L_INDEX?.row,
      normalized1.fingerToPad.L_MIDDLE?.row,
      normalized1.fingerToPad.R_INDEX?.row,
    ].filter((r): r is number => r !== null && r !== undefined);

    expect(Math.min(...rows)).toBe(0);
  });

  it('should validate imported pose before normalizing', () => {
    // Invalid pose with duplicate pads should fail validation
    const invalidImport: NaturalHandPose = {
      version: 1,
      name: 'Invalid Import',
      positionIndex: 0,
      fingerToPad: {
        L_THUMB: null,
        L_INDEX: { row: 2, col: 3 },
        L_MIDDLE: { row: 2, col: 3 }, // Duplicate!
        L_RING: null,
        L_PINKY: null,
        R_THUMB: null,
        R_INDEX: null,
        R_MIDDLE: null,
        R_RING: null,
        R_PINKY: null,
      },
      maxUpShiftRows: 4,
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const validation = validateNaturalHandPose(invalidImport);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('Duplicate');
  });

  it('should preserve relative finger positions after normalization', () => {
    // Import pose with rows at 4, 5, 6
    const importedPose: NaturalHandPose = {
      version: 1,
      name: 'Test Pose',
      positionIndex: 0,
      fingerToPad: {
        L_THUMB: null,
        L_INDEX: { row: 4, col: 1 },
        L_MIDDLE: { row: 5, col: 2 },
        L_RING: { row: 6, col: 3 },
        L_PINKY: null,
        R_THUMB: null,
        R_INDEX: null,
        R_MIDDLE: null,
        R_RING: null,
        R_PINKY: null,
      },
      maxUpShiftRows: 4,
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const normalized = normalizePose0(importedPose);

    // After normalization, rows should be 0, 1, 2 (relative positions preserved)
    expect(normalized.fingerToPad.L_INDEX).toEqual({ row: 0, col: 1 });
    expect(normalized.fingerToPad.L_MIDDLE).toEqual({ row: 1, col: 2 });
    expect(normalized.fingerToPad.L_RING).toEqual({ row: 2, col: 3 });
  });
});

// ============================================================================
// Tests: Conversion Helpers
// ============================================================================

describe('fingerIdToEngineKey', () => {
  it('should convert FingerId to engine key format', () => {
    expect(fingerIdToEngineKey('L_THUMB')).toBe('L1');
    expect(fingerIdToEngineKey('L_INDEX')).toBe('L2');
    expect(fingerIdToEngineKey('L_MIDDLE')).toBe('L3');
    expect(fingerIdToEngineKey('L_RING')).toBe('L4');
    expect(fingerIdToEngineKey('L_PINKY')).toBe('L5');
    expect(fingerIdToEngineKey('R_THUMB')).toBe('R1');
    expect(fingerIdToEngineKey('R_INDEX')).toBe('R2');
    expect(fingerIdToEngineKey('R_MIDDLE')).toBe('R3');
    expect(fingerIdToEngineKey('R_RING')).toBe('R4');
    expect(fingerIdToEngineKey('R_PINKY')).toBe('R5');
  });
});

describe('engineKeyToFingerId', () => {
  it('should convert engine key to FingerId', () => {
    expect(engineKeyToFingerId('L1')).toBe('L_THUMB');
    expect(engineKeyToFingerId('L2')).toBe('L_INDEX');
    expect(engineKeyToFingerId('R5')).toBe('R_PINKY');
  });

  it('should return null for invalid keys', () => {
    expect(engineKeyToFingerId('X1')).toBeNull();
    expect(engineKeyToFingerId('L0')).toBeNull();
    expect(engineKeyToFingerId('invalid')).toBeNull();
  });
});

// ============================================================================
// Tests: Utility Functions
// ============================================================================

describe('poseHasAssignments', () => {
  it('should return false for empty pose', () => {
    const pose = createEmptyPose0();
    expect(poseHasAssignments(pose)).toBe(false);
  });

  it('should return true for pose with at least one assignment', () => {
    const pose = createPoseWithPads({
      L_INDEX: { row: 2, col: 3 },
    });
    expect(poseHasAssignments(pose)).toBe(true);
  });
});

describe('getAssignedFingerCount', () => {
  it('should return 0 for empty pose', () => {
    const pose = createEmptyPose0();
    expect(getAssignedFingerCount(pose)).toBe(0);
  });

  it('should count assigned fingers correctly', () => {
    const pose = createPoseWithPads({
      L_INDEX: { row: 2, col: 3 },
      L_MIDDLE: { row: 3, col: 4 },
      R_INDEX: { row: 2, col: 5 },
    });
    expect(getAssignedFingerCount(pose)).toBe(3);
  });
});
