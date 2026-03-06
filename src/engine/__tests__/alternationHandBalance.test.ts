/**
 * Tests for alternation and hand balance cost functions (Phase 3).
 */

import { describe, it, expect } from 'vitest';
import {
  calculateAlternationCost,
  calculateHandBalanceCost,
  ALTERNATION_DT_THRESHOLD,
  HAND_BALANCE_TARGET_LEFT,
  HAND_BALANCE_MIN_NOTES,
} from '../costFunction';
import type { FingerType } from '../models';

describe('calculateAlternationCost', () => {
  it('returns 0 when prevAssignments is empty', () => {
    const curr = [{ hand: 'left' as const, finger: 'index' as FingerType }];
    expect(calculateAlternationCost([], curr, 0.1)).toBe(0);
  });

  it('returns 0 when dt >= ALTERNATION_DT_THRESHOLD', () => {
    const prev = [{ hand: 'left' as const, finger: 'index' as FingerType }];
    const curr = [{ hand: 'left' as const, finger: 'index' as FingerType }];
    expect(calculateAlternationCost(prev, curr, ALTERNATION_DT_THRESHOLD)).toBe(0);
    expect(calculateAlternationCost(prev, curr, 0.5)).toBe(0);
  });

  it('penalizes same-finger repetition on short dt', () => {
    const prev = [{ hand: 'left' as const, finger: 'index' as FingerType }];
    const curr = [{ hand: 'left' as const, finger: 'index' as FingerType }];
    const cost = calculateAlternationCost(prev, curr, 0.1);
    expect(cost).toBeGreaterThan(0);
  });

  it('returns 0 when different finger is used', () => {
    const prev = [{ hand: 'left' as const, finger: 'index' as FingerType }];
    const curr = [{ hand: 'left' as const, finger: 'middle' as FingerType }];
    expect(calculateAlternationCost(prev, curr, 0.1)).toBe(0);
  });

  it('returns 0 when different hand uses same finger', () => {
    const prev = [{ hand: 'left' as const, finger: 'index' as FingerType }];
    const curr = [{ hand: 'right' as const, finger: 'index' as FingerType }];
    expect(calculateAlternationCost(prev, curr, 0.1)).toBe(0);
  });
});

describe('calculateHandBalanceCost', () => {
  it('returns 0 when total notes < HAND_BALANCE_MIN_NOTES', () => {
    expect(calculateHandBalanceCost(0, 0)).toBe(0);
    expect(calculateHandBalanceCost(1, 0)).toBe(0);
    expect(calculateHandBalanceCost(0, 1)).toBe(0);
  });

  it('returns 0 when leftShare equals target', () => {
    const total = 20;
    const left = Math.round(total * HAND_BALANCE_TARGET_LEFT);
    const right = total - left;
    expect(calculateHandBalanceCost(left, right)).toBe(0);
  });

  it('returns positive penalty when leftShare deviates from target', () => {
    expect(calculateHandBalanceCost(10, 0)).toBeGreaterThan(0);
    expect(calculateHandBalanceCost(0, 10)).toBeGreaterThan(0);
  });

  it('penalizes strong left-hand bias more than slight bias', () => {
    const slight = calculateHandBalanceCost(8, 2); // 80% left
    const strong = calculateHandBalanceCost(19, 1); // 95% left
    expect(strong).toBeGreaterThan(slight);
  });
});
