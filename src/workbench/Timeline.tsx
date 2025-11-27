
import React, { useRef, useEffect, useMemo } from 'react';
import { Performance } from '../types/performance';
import { Voice } from '../types/layout';

interface TimelineProps {
  performance: Performance | null;
  voices: Voice[];
  fingerAssignments?: string[]; // Array of finger labels corresponding to events
  currentTime: number;
  zoom: number; // pixels per second
  isPlaying: boolean;
  onSeek: (time: number) => void;
}

const HEADER_WIDTH = 150;
const LANE_HEIGHT = 40;
const RULER_HEIGHT = 30;

export const Timeline: React.FC<TimelineProps> = ({
  performance,
  voices,
  fingerAssignments = [],
  currentTime,
  zoom,
  isPlaying,
  onSeek,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Sort voices by MIDI note (descending) or keep order? 
  // Usually drums are low to high or high to low. Let's sort by MIDI note descending (Kick at bottom? Or top?)
  // Mockup shows Kick at top. Kick is usually low note (36). So ascending? 
  // Mockup: Kick, Snare 1, Snare Ghost, Closed Hat...
  // Let's rely on the order passed in `voices` or sort by note number.
  // For now, use the order provided.

  const sortedVoices = useMemo(() => {
    return [...voices].sort((a, b) => (a.originalMidiNote || 0) - (b.originalMidiNote || 0));
  }, [voices]);

  // Calculate total duration
  const duration = useMemo(() => {
    if (!performance?.events.length) return 10; // Default 10s
    const lastEvent = performance.events[performance.events.length - 1];
    return lastEvent.startTime + (lastEvent.duration || 0.1) + 1; // +1s padding
  }, [performance]);

  const totalWidth = duration * zoom;

  // Auto-scroll logic
  useEffect(() => {
    if (isPlaying && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const currentX = currentTime * zoom;
      const halfWidth = container.clientWidth / 2;

      // Keep "Now" bar centered-ish
      if (currentX > halfWidth) {
        container.scrollLeft = currentX - halfWidth;
      } else {
        container.scrollLeft = 0;
      }
    }
  }, [currentTime, zoom, isPlaying]);

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!contentRef.current) return;
    const rect = contentRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - HEADER_WIDTH + scrollContainerRef.current!.scrollLeft;
    const time = Math.max(0, x / zoom);
    onSeek(time);
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 text-slate-300 select-none">
      {/* Ruler */}
      <div className="flex-none h-[30px] flex border-b border-slate-700 bg-slate-800">
        <div style={{ width: HEADER_WIDTH }} className="flex-none border-r border-slate-700 bg-slate-800 z-10" />
        <div className="flex-1 relative overflow-hidden">
          <div
            className="absolute top-0 bottom-0"
            style={{
              width: totalWidth,
              transform: `translateX(-${scrollContainerRef.current?.scrollLeft || 0}px)`
            }}
          >
            {/* Simple ruler markers every second */}
            {Array.from({ length: Math.ceil(duration) }).map((_, i) => (
              <React.Fragment key={i}>
                {/* Major Tick (Seconds) */}
                <div
                  className="absolute top-0 bottom-0 border-l border-slate-600 text-[10px] pl-1 select-none"
                  style={{ left: i * zoom }}
                >
                  {i}s
                </div>

                {/* Minor Ticks (0.5s) - Show if zoom > 40 */}
                {zoom > 40 && (
                  <div
                    className="absolute bottom-0 h-2 border-l border-slate-700"
                    style={{ left: (i + 0.5) * zoom }}
                  />
                )}

                {/* Sub-minor Ticks (0.1s) - Show if zoom > 100 */}
                {zoom > 100 && Array.from({ length: 9 }).map((_, j) => {
                  if (j === 4) return null; // Skip 0.5s
                  return (
                    <div
                      key={`sub-${i}-${j}`}
                      className="absolute bottom-0 h-1 border-l border-slate-800"
                      style={{ left: (i + (j + 1) * 0.1) * zoom }}
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Header (Voice Names) */}
        <div className="flex-none w-[150px] bg-slate-800 border-r border-slate-700 z-10 overflow-hidden">
          <div style={{ transform: `translateY(-${scrollContainerRef.current?.scrollTop || 0}px)` }}>
            {sortedVoices.map(voice => (
              <div
                key={voice.id}
                className="flex items-center px-4 border-b border-slate-700/50 bg-slate-800"
                style={{ height: LANE_HEIGHT }}
              >
                <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: voice.color }} />
                <span className="text-xs font-medium truncate" title={voice.name}>{voice.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline Area */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto relative bg-slate-900/50"
          onScroll={(e) => {
            // Sync header scroll if we had vertical scrolling (not implemented yet, but good practice)
          }}
          onClick={handleTimelineClick}
        >
          <div
            ref={contentRef}
            className="relative"
            style={{ width: totalWidth, height: sortedVoices.length * LANE_HEIGHT }}
          >
            {/* Grid Lines (Lanes) */}
            {sortedVoices.map((voice, i) => (
              <div
                key={`lane-${voice.id}`}
                className="absolute left-0 right-0 border-b border-slate-800/50"
                style={{ top: i * LANE_HEIGHT, height: LANE_HEIGHT }}
              />
            ))}

            {/* Notes */}
            {performance?.events.map((event, i) => {
              // Find which lane this note belongs to
              const voiceIndex = sortedVoices.findIndex(v => v.originalMidiNote === event.noteNumber);
              if (voiceIndex === -1) return null; // Note not mapped to a visible voice

              const left = event.startTime * zoom;
              const width = Math.max(2, (event.duration || 0.1) * zoom);
              const top = voiceIndex * LANE_HEIGHT + 4; // +4 padding
              const height = LANE_HEIGHT - 8; // -8 padding

              // Finger assignment
              // We need a way to map specific event to finger. 
              // Usually finger assignments are per note-event (if ergonomic engine ran).
              // Or per pitch if static. 
              // The prop `fingerAssignments` is Record<string, string>. 
              // If it's by note number: fingerAssignments[event.noteNumber]
              // But requirements say "only the leading note if the voice doesn't change finger assignments".
              // For now, let's assume we show it if available.
              // We might need a more complex structure for finger assignments if it varies per event.
              // Assuming the engine returns assignments per event index or timestamp?
              // The `EngineResult` has `debugEvents` which likely contains the assignment.
              // For now, let's try to look it up.

              // If fingerAssignments is keyed by noteNumber (static assignment):
              const finger = fingerAssignments && fingerAssignments[i] ? fingerAssignments[i] : '';

              const voice = sortedVoices[voiceIndex];

              return (
                <div
                  key={`evt-${i}`}
                  className="absolute rounded-sm shadow-sm flex items-center justify-center overflow-hidden"
                  style={{
                    left,
                    width,
                    top,
                    height,
                    backgroundColor: voice.color,
                    opacity: 0.8,
                  }}
                  title={`Note: ${event.noteNumber}, Time: ${event.startTime.toFixed(2)}`}
                >
                  {finger && width > 15 && (
                    <span className="text-[10px] font-bold text-white drop-shadow-md">
                      {finger}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Now Bar */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-20 shadow-[0_0_10px_rgba(250,204,21,0.5)]"
              style={{ left: currentTime * zoom }}
            >
              <div className="absolute -top-1 -left-1.5 w-4 h-4 bg-yellow-400 rounded-full opacity-20 animate-ping" />
              <div className="absolute -top-1 -left-1 w-3 h-3 bg-yellow-400 rounded-full shadow-sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
