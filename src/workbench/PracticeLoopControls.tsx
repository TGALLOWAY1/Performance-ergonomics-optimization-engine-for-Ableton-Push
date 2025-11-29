/**
 * Practice Loop Controls Component
 * 
 * Provides UI controls for practicing transitions between events N and N+1.
 * Includes play/stop button and speed selector.
 */

import React, { useState } from 'react';

export interface PracticeLoopControlsProps {
  /** Whether there is a next event to loop to */
  hasNextEvent: boolean;
  /** Currently selected event index */
  selectedIndex: number | null;
  /** Callback when loop starts */
  onStartLoop: (speed: number) => void;
  /** Callback when loop stops */
  onStopLoop: () => void;
  /** Whether the loop is currently playing */
  isPlaying: boolean;
}

const SPEED_OPTIONS = [
  { label: '0.75×', value: 0.75 },
  { label: '0.85×', value: 0.85 },
  { label: '1.0×', value: 1.0 },
  { label: '1.10×', value: 1.10 },
] as const;

export const PracticeLoopControls: React.FC<PracticeLoopControlsProps> = ({
  hasNextEvent,
  selectedIndex,
  onStartLoop,
  onStopLoop,
  isPlaying,
}) => {
  const [selectedSpeed, setSelectedSpeed] = useState(1.0);

  const handlePlay = () => {
    if (hasNextEvent && selectedIndex !== null) {
      onStartLoop(selectedSpeed);
    }
  };

  const handleStop = () => {
    onStopLoop();
  };

  const canPlay = hasNextEvent && selectedIndex !== null && !isPlaying;
  const canStop = isPlaying;

  return (
    <div className="bg-[var(--bg-card)] p-4 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
          Practice Loop
        </h3>
        {selectedIndex !== null && hasNextEvent && (
          <span className="text-[10px] text-[var(--text-tertiary)]">
            Looping transition {selectedIndex} → {selectedIndex + 1}
          </span>
        )}
      </div>

      {/* Play/Stop Controls */}
      <div className="flex items-center gap-3">
        {!isPlaying ? (
          <button
            onClick={handlePlay}
            disabled={!canPlay}
            className={`
              px-4 py-2 rounded-[var(--radius-md)] text-xs font-semibold transition-all
              ${canPlay
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-[var(--bg-input)] text-[var(--text-tertiary)] cursor-not-allowed'
              }
            `}
          >
            ▶ Play
          </button>
        ) : (
          <button
            onClick={handleStop}
            disabled={!canStop}
            className="px-4 py-2 rounded-[var(--radius-md)] text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-all"
          >
            ⏹ Stop
          </button>
        )}

        {/* Speed Selector */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--text-secondary)] uppercase">Speed:</span>
          <div className="flex gap-1 bg-[var(--bg-input)] rounded-[var(--radius-sm)] p-0.5 border border-[var(--border-subtle)]">
            {SPEED_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedSpeed(option.value)}
                disabled={isPlaying}
                className={`
                  px-2 py-1 text-[10px] font-medium rounded transition-all
                  ${selectedSpeed === option.value
                    ? 'bg-blue-600 text-white'
                    : isPlaying
                    ? 'text-[var(--text-tertiary)] cursor-not-allowed'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
                  }
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Status Message */}
      {!hasNextEvent && selectedIndex !== null && (
        <p className="text-[10px] text-[var(--text-tertiary)] italic">
          No next event available for looping
        </p>
      )}
      {selectedIndex === null && (
        <p className="text-[10px] text-[var(--text-tertiary)] italic">
          Select a transition to practice
        </p>
      )}
    </div>
  );
};

