
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

  const sortedVoices = useMemo(() => {
    return [...voices].sort((a, b) => (a.originalMidiNote || 0) - (b.originalMidiNote || 0));
  }, [voices]);

  const duration = useMemo(() => {
    if (!performance?.events.length) return 10;
    const lastEvent = performance.events[performance.events.length - 1];
    return lastEvent.startTime + (lastEvent.duration || 0.1) + 1;
  }, [performance]);

  const totalWidth = duration * zoom;

  useEffect(() => {
    if (isPlaying && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const currentX = currentTime * zoom;
      const halfWidth = container.clientWidth / 2;

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

  // Helper to get pastel gradient based on base color
  const getNoteStyle = (baseColor: string) => {
    // This is a simplification. Ideally we'd parse the color and generate a gradient.
    // For now, let's use the base color with some opacity and a gradient overlay.
    return {
      background: `linear-gradient(135deg, ${baseColor}dd 0%, ${baseColor}99 100%)`,
      boxShadow: `0 2px 4px -1px ${baseColor}66`,
      border: `1px solid ${baseColor}aa`
    };
  };

  return (
    <div className="flex flex-col h-full w-full bg-[var(--bg-app)] text-[var(--text-secondary)] select-none font-[family-name:var(--font-ui)]">
      {/* Ruler */}
      <div className="flex-none h-[36px] flex border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] backdrop-blur-sm">
        <div style={{ width: HEADER_WIDTH }} className="flex-none border-r border-[var(--border-subtle)] bg-[var(--bg-panel)] z-20 shadow-sm" />
        <div className="flex-1 relative overflow-hidden">
          <div
            className="absolute top-0 bottom-0"
            style={{
              width: totalWidth,
              transform: `translateX(-${scrollContainerRef.current?.scrollLeft || 0}px)`
            }}
          >
            {Array.from({ length: Math.ceil(duration) }).map((_, i) => (
              <React.Fragment key={i}>
                {/* Major Tick (Seconds) */}
                <div
                  className="absolute top-0 bottom-0 border-l border-[var(--border-subtle)] text-[10px] font-medium pl-1.5 pt-1 select-none text-[var(--text-tertiary)]"
                  style={{ left: i * zoom }}
                >
                  {i}s
                </div>
                {/* Minor Ticks */}
                {zoom > 40 && (
                  <div
                    className="absolute bottom-0 h-2 border-l border-[var(--border-subtle)]"
                    style={{ left: (i + 0.5) * zoom }}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Header (Voice Names) */}
        <div className="flex-none w-[150px] bg-[var(--bg-panel)] border-r border-[var(--border-subtle)] z-10 overflow-hidden shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
          <div style={{ transform: `translateY(-${scrollContainerRef.current?.scrollTop || 0}px)` }}>
            {sortedVoices.map((voice, idx) => (
              <div
                key={voice.id}
                className={`flex items-center px-4 border-b border-[var(--border-subtle)] ${idx % 2 === 0 ? 'bg-[var(--bg-card)]' : 'bg-transparent'}`}
                style={{ height: LANE_HEIGHT }}
              >
                <div
                  className="w-2 h-8 rounded-full mr-3 shadow-sm"
                  style={{ backgroundColor: voice.color }}
                />
                <span className="text-xs font-semibold truncate text-[var(--text-primary)] tracking-tight" title={voice.name}>
                  {voice.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline Area */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto relative bg-[var(--bg-input)]"
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
                className={`absolute left-0 right-0 border-b border-[var(--border-subtle)] ${i % 2 === 0 ? 'bg-[var(--bg-card)] opacity-50' : ''}`}
                style={{ top: i * LANE_HEIGHT, height: LANE_HEIGHT }}
              />
            ))}

            {/* Beat Grid (Vertical Lines) */}
            {/* Assuming 120 BPM for now, so 1 beat = 0.5s. We can make this dynamic later. */}
            {Array.from({ length: Math.ceil(duration * 2) }).map((_, i) => (
              <div
                key={`grid-${i}`}
                className="absolute top-0 bottom-0 border-l border-[var(--border-subtle)] pointer-events-none opacity-50"
                style={{ left: i * 0.5 * zoom }}
              />
            ))}

            {/* Notes */}
            {performance?.events.map((event, i) => {
              const voiceIndex = sortedVoices.findIndex(v => v.originalMidiNote === event.noteNumber);
              if (voiceIndex === -1) return null;

              const left = event.startTime * zoom;
              const width = Math.max(4, (event.duration || 0.1) * zoom);
              const top = voiceIndex * LANE_HEIGHT + 6;
              const height = LANE_HEIGHT - 12;
              const voice = sortedVoices[voiceIndex];
              const finger = fingerAssignments && fingerAssignments[i] ? fingerAssignments[i] : '';

              return (
                <div
                  key={`evt-${i}`}
                  className="absolute rounded-[var(--radius-sm)] flex items-center justify-center overflow-hidden transition-all hover:brightness-110 hover:scale-[1.02] z-10 group"
                  style={{
                    left,
                    width,
                    top,
                    height,
                    ...getNoteStyle(voice.color)
                  }}
                  title={`Note: ${event.noteNumber}, Time: ${event.startTime.toFixed(2)}`}
                >
                  {/* Glass shine effect */}
                  <div className="absolute top-0 left-0 right-0 h-[40%] bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />

                  {finger && width > 15 && (
                    <span className="text-[10px] font-bold text-white drop-shadow-md z-10">
                      {finger}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Now Bar */}
            <div
              className="absolute top-0 bottom-0 z-30 pointer-events-none transition-transform duration-75 ease-linear"
              style={{ transform: `translateX(${currentTime * zoom}px)` }}
            >
              {/* Line */}
              <div className="absolute top-0 bottom-0 w-[2px] bg-[var(--finger-L3)] shadow-[0_0_15px_var(--finger-L3)]" />

              {/* "NOW" Label */}
              <div className="absolute -top-6 -left-6 bg-[var(--finger-L3)] text-black text-[9px] font-bold px-1.5 py-0.5 rounded-sm shadow-lg backdrop-blur-sm">
                NOW
              </div>

              {/* Glow head */}
              <div className="absolute -top-1 -left-[5px] w-3 h-3 bg-[var(--finger-L3)] rounded-full shadow-[0_0_10px_var(--finger-L3)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
