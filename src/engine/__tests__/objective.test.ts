/**
 * Objective Function Tests
 */

import { describe, it, expect } from 'vitest';
import {
  createZeroComponents,
  combineComponents,
  objectiveToCostBreakdown,
  type ObjectiveComponents,
} from '../objective';

describe('objective', () => {
  describe('combineComponents', () => {
    it('should sum all components', () => {
      const c: ObjectiveComponents = {
        transition: 1,
        stretch: 2,
        poseAttractor: 3,
        perFingerHome: 4,
        alternation: 0,
        handBalance: 0,
        constraints: 5,
      };
      expect(combineComponents(c)).toBe(15);
    });

    it('should return 0 for zero components', () => {
      expect(combineComponents(createZeroComponents())).toBe(0);
    });
  });

  describe('objectiveToCostBreakdown', () => {
    it('should map components to CostBreakdown with correct total', () => {
      const c: ObjectiveComponents = {
        transition: 10,
        stretch: 5,
        poseAttractor: 3,
        perFingerHome: 2,
        alternation: 0,
        handBalance: 0,
        constraints: 1,
      };
      const breakdown = objectiveToCostBreakdown(c);
      expect(breakdown.movement).toBe(10);
      expect(breakdown.stretch).toBe(5);
      expect(breakdown.drift).toBe(3);
      expect(breakdown.bounce).toBe(0);
      expect(breakdown.fatigue).toBe(2);
      expect(breakdown.crossover).toBe(1);
      expect(breakdown.total).toBe(21);
    });
  });
});
