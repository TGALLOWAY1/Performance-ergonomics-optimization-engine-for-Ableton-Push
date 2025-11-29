/**
 * Practice Loop Hook
 * 
 * Manages practice loop playback for transitioning between events N and N+1.
 * For MVP, steps the selected event index back and forth on a timer.
 * 
 * Future: Can be extended to trigger actual MIDI/audio playback.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Performance } from '../types/performance';
import type { AnalyzedEvent, Transition } from '../types/eventAnalysis';

export interface UsePracticeLoopOptions {
  /** Performance data (for tempo) */
  performance: Performance | null;
  /** Array of analyzed events */
  events: AnalyzedEvent[];
  /** Array of transitions */
  transitions: Transition[];
  /** Currently selected event index */
  selectedIndex: number | null;
  /** Callback to update selected index */
  onIndexChange: (index: number) => void;
}

export interface UsePracticeLoopReturn {
  /** Whether the loop is currently playing */
  isPlaying: boolean;
  /** Start the practice loop at the given speed */
  startLoop: (speed: number) => void;
  /** Stop the practice loop */
  stopLoop: () => void;
  /** Current playback speed multiplier */
  currentSpeed: number;
}

/**
 * Practice loop hook
 * 
 * Manages looping between event N and N+1 for practice.
 * Steps the selected index back and forth on a timer.
 */
export function usePracticeLoop(options: UsePracticeLoopOptions): UsePracticeLoopReturn {
  const { performance, events, transitions, selectedIndex, onIndexChange } = options;
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(1.0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isAtNRef = useRef(true); // Track whether we're at N (true) or N+1 (false)

  // Stop loop and cleanup
  const stopLoop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPlaying(false);
    console.log('[PracticeLoop] Stopped');
  }, []);

  // Start loop
  const startLoop = useCallback((speed: number) => {
    // Stop any existing loop
    stopLoop();

    if (selectedIndex === null || events.length === 0) {
      console.warn('[PracticeLoop] Cannot start: no selected event');
      return;
    }

    // Check if there's a next event
    const hasNext = selectedIndex < events.length - 1;
    if (!hasNext) {
      console.warn('[PracticeLoop] Cannot start: no next event to loop to');
      return;
    }

    // Get transition timing
    const transition = transitions.find(t => t.fromIndex === selectedIndex);
    if (!transition) {
      console.warn('[PracticeLoop] Cannot start: no transition found');
      return;
    }

    // Calculate interval based on transition time and speed
    // timeDeltaMs is the time between N and N+1
    // We want to loop: N → N+1 → N → N+1...
    // So each step should take timeDeltaMs / 2 (half the transition time per step)
    const baseIntervalMs = transition.metrics.timeDeltaMs / 2;
    const adjustedIntervalMs = baseIntervalMs / speed; // Speed up with higher multiplier

    // Clamp to reasonable bounds (min 50ms, max 2000ms)
    const clampedInterval = Math.max(50, Math.min(2000, adjustedIntervalMs));

    setIsPlaying(true);
    setCurrentSpeed(speed);
    isAtNRef.current = true; // Start at N
    console.log('[PracticeLoop] Started', {
      selectedIndex,
      speed,
      intervalMs: clampedInterval,
      timeDeltaMs: transition.metrics.timeDeltaMs,
    });

    // Store the base index for the loop
    const baseIndex = selectedIndex;
    const nextIndex = baseIndex + 1;

    // Set up interval to step between N and N+1
    intervalRef.current = setInterval(() => {
      if (isAtNRef.current) {
        // Move to N+1
        onIndexChange(nextIndex);
        isAtNRef.current = false;
        console.log('[PracticeLoop] Step: N → N+1', { from: baseIndex, to: nextIndex });
      } else {
        // Move back to N
        onIndexChange(baseIndex);
        isAtNRef.current = true;
        console.log('[PracticeLoop] Step: N+1 → N', { from: nextIndex, to: baseIndex });
      }
    }, clampedInterval);
  }, [selectedIndex, events.length, transitions, onIndexChange, stopLoop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLoop();
    };
  }, [stopLoop]);

  // Stop loop if selected index changes externally
  useEffect(() => {
    if (isPlaying) {
      // Reset the loop state when index changes externally
      isAtNRef.current = true;
    }
  }, [selectedIndex, isPlaying]);

  return {
    isPlaying,
    startLoop,
    stopLoop,
    currentSpeed,
  };
}

