/**
 * Vitest setup file for solver tests.
 * Registers custom matchers and test utilities.
 */

import { expect } from 'vitest';
import { EngineResult } from '../../solvers/types';
import { Performance } from '../../../types/performance';
import {
  assertNoNaNs,
  assertMappingIntegrity,
  assertValidGridPositions,
  assertDebugEventsMatchInput,
  assertPerformanceUnits,
  containsNaN,
} from './testHelpers';

interface CustomMatchers<R = unknown> {
  toBeFeasible(): R;
  toBeInfeasible(): R;
  toHaveNoNaNs(): R;
  toHaveValidMappingIntegrity(): R;
  toHaveValidGridPositions(): R;
  toHaveDebugEventsForInput(performance: Performance): R;
}

declare module 'vitest' {
  interface Assertion<T = unknown> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

expect.extend({
  toBeFeasible(received: EngineResult) {
    const pass = received.unplayableCount === 0;
    return {
      pass,
      message: () =>
        pass
          ? `expected result to be infeasible but unplayableCount was 0`
          : `expected result to be feasible but unplayableCount was ${received.unplayableCount}`,
    };
  },

  toBeInfeasible(received: EngineResult) {
    const pass = received.unplayableCount > 0;
    return {
      pass,
      message: () =>
        pass
          ? `expected result to be feasible but unplayableCount was ${received.unplayableCount}`
          : `expected result to be infeasible but unplayableCount was 0`,
    };
  },

  toHaveNoNaNs(received: EngineResult) {
    try {
      assertNoNaNs(received);
      return {
        pass: true,
        message: () => `expected result to contain NaN values but it did not`,
      };
    } catch (error) {
      return {
        pass: false,
        message: () => (error as Error).message,
      };
    }
  },

  toHaveValidMappingIntegrity(received: EngineResult) {
    try {
      assertMappingIntegrity(received);
      return {
        pass: true,
        message: () => `expected result to have invalid mapping integrity`,
      };
    } catch (error) {
      return {
        pass: false,
        message: () => (error as Error).message,
      };
    }
  },

  toHaveValidGridPositions(received: EngineResult) {
    try {
      assertValidGridPositions(received);
      return {
        pass: true,
        message: () => `expected result to have invalid grid positions`,
      };
    } catch (error) {
      return {
        pass: false,
        message: () => (error as Error).message,
      };
    }
  },

  toHaveDebugEventsForInput(received: EngineResult, performance: Performance) {
    try {
      assertDebugEventsMatchInput(performance, received);
      return {
        pass: true,
        message: () => `expected result to be missing debug events for some inputs`,
      };
    } catch (error) {
      return {
        pass: false,
        message: () => (error as Error).message,
      };
    }
  },
});
