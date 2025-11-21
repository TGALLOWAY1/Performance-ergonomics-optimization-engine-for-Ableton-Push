import React, { useState } from 'react';
import { EngineResult, EngineDebugEvent } from '../engine/core';
import { GridMapping } from '../types/layout';
import { getPositionForMidi } from '../utils/layoutUtils';
import { formatFinger, normalizeHand } from '../utils/formatUtils';

interface EngineResultsPanelProps {
  result: EngineResult | null;
  activeMapping?: GridMapping | null;
  onHighlightCell?: (row: number, col: number) => void;
}

interface FingerUsage {
  hand: 'L' | 'R';
  finger: number;
  count: number;
  percentage: number;
  name: string;
}

const FINGER_NAMES: Record<number, string> = {
  1: 'Thumb',
  2: 'Index',
  3: 'Middle',
  4: 'Ring',
  5: 'Pinky'
};

type TabType = 'overview' | 'handAnalysis';

export const EngineResultsPanel: React.FC<EngineResultsPanelProps> = ({ 
  result, 
  activeMapping,
  onHighlightCell 
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  if (!result) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 text-sm">
        No analysis data available.
      </div>
    );
  }

  const { score, hardCount, unplayableCount, debugEvents } = result;
  // Handle new fields with fallback for backward compatibility
  const fingerUsageStats = 'fingerUsageStats' in result ? result.fingerUsageStats : undefined;
  const fatigueMap = 'fatigueMap' in result ? result.fatigueMap : undefined;
  const averageDrift = 'averageDrift' in result ? result.averageDrift : 0;

  // Calculate Hand Balance
  const lhCount = debugEvents.filter(e => e.assignedHand === 'left' || e.assignedHand === 'LH').length;
  const rhCount = debugEvents.filter(e => e.assignedHand === 'right' || e.assignedHand === 'RH').length;
  const totalAssigned = lhCount + rhCount;
  
  const lhPercent = totalAssigned > 0 ? Math.round((lhCount / totalAssigned) * 100) : 0;
  const rhPercent = totalAssigned > 0 ? Math.round((rhCount / totalAssigned) * 100) : 0;

  // Helper to convert FingerType to number (for backward compatibility)
  const fingerTypeToNumber = (finger: string | null): number | null => {
    if (!finger) return null;
    const map: Record<string, number> = {
      'thumb': 1,
      'index': 2,
      'middle': 3,
      'ring': 4,
      'pinky': 5
    };
    return map[finger.toLowerCase()] || null;
  };

  // Helper to normalize hand string
  const normalizeHandString = (hand: string): 'L' | 'R' => {
    if (hand === 'left' || hand === 'LH') return 'L';
    if (hand === 'right' || hand === 'RH') return 'R';
    return 'L';
  };

  // Calculate Finger Usage (use fingerUsageStats if available, otherwise calculate from events)
  const fingerUsageMap = new Map<string, number>();
  const allFingers: FingerUsage[] = [];
  
  if (fingerUsageStats && Object.keys(fingerUsageStats).length > 0) {
    // Use provided fingerUsageStats
    Object.entries(fingerUsageStats).forEach(([key, count]) => {
      const [handStr, fingerStr] = key.split('-');
      const hand = handStr === 'L' ? 'L' : 'R';
      const fingerNum = fingerTypeToNumber(fingerStr.toLowerCase());
      if (fingerNum) {
        const percentage = totalAssigned > 0 ? Math.round((count / totalAssigned) * 100) : 0;
        allFingers.push({
          hand,
          finger: fingerNum,
          count,
          percentage,
          name: `${hand === 'L' ? 'Left' : 'Right'} ${fingerStr}`
        });
      }
    });
  } else {
    // Fallback: calculate from events
    debugEvents.forEach(event => {
      if (event.assignedHand !== 'Unplayable' && event.finger !== null) {
        const hand = normalizeHandString(event.assignedHand);
        const fingerNum = typeof event.finger === 'number' ? event.finger : fingerTypeToNumber(event.finger);
        if (fingerNum) {
          const key = `${hand}${fingerNum}`;
          fingerUsageMap.set(key, (fingerUsageMap.get(key) || 0) + 1);
        }
      }
    });

    // Convert to array and calculate percentages
    fingerUsageMap.forEach((count, key) => {
      const hand = key[0] as 'L' | 'R';
      const finger = parseInt(key[1]);
      const percentage = totalAssigned > 0 ? Math.round((count / totalAssigned) * 100) : 0;
      allFingers.push({
        hand,
        finger,
        count,
        percentage,
        name: `${hand === 'L' ? 'Left' : 'Right'} ${FINGER_NAMES[finger]}`
      });
    });
  }

  // Sort by usage (highest first)
  allFingers.sort((a, b) => b.count - a.count);

  // Identify high-usage fingers (fatigue warnings)
  const highUsageThreshold = 30; // 30% or more usage
  const fatigueWarnings = allFingers.filter(f => f.percentage >= highUsageThreshold);

  // Get choke points (Hard and Unplayable events)
  const chokePoints = debugEvents.filter(e => 
    e.difficulty === 'Hard' || e.difficulty === 'Unplayable'
  ).sort((a, b) => {
    // Sort by difficulty (Unplayable first), then by cost
    if (a.difficulty === 'Unplayable' && b.difficulty !== 'Unplayable') return -1;
    if (a.difficulty !== 'Unplayable' && b.difficulty === 'Unplayable') return 1;
    return b.cost - a.cost;
  });

  // Handle clicking a choke point to highlight on grid
  const handleChokePointClick = (event: EngineDebugEvent) => {
    if (!onHighlightCell || !activeMapping) return;
    
    // Try to get position from the event first (if available)
    if (event.row !== undefined && event.col !== undefined) {
      onHighlightCell(event.row, event.col);
      return;
    }
    
    // Otherwise, use activeMapping to find the position
    const pos = getPositionForMidi(event.noteNumber, activeMapping);
    if (pos) {
      onHighlightCell(pos.row, pos.col);
    }
  };

  // Score Color
  let scoreColor = 'text-slate-200';
  if (score > 80) scoreColor = 'text-green-400';
  else if (score > 50) scoreColor = 'text-yellow-400';
  else scoreColor = 'text-red-400';

  // Prepare finger usage data for bar chart
  const fingerUsageData = allFingers
    .sort((a, b) => {
      // Sort by hand first (L then R), then by finger number
      if (a.hand !== b.hand) return a.hand === 'L' ? -1 : 1;
      return a.finger - b.finger;
    })
    .map(f => ({
      ...f,
      maxCount: Math.max(...allFingers.map(ff => ff.count), 1)
    }));

  // Prepare fatigue data
  const fatigueData = Object.entries(fatigueMap || {})
    .map(([key, value]) => {
      const [handStr, fingerStr] = key.split('-');
      const hand = handStr === 'L' ? 'L' : 'R';
      const fingerNum = fingerTypeToNumber(fingerStr.toLowerCase());
      return {
        key,
        hand,
        finger: fingerNum,
        fingerName: fingerStr,
        value,
        name: `${hand === 'L' ? 'Left' : 'Right'} ${fingerStr}`
      };
    })
    .filter(f => f.finger !== null)
    .sort((a, b) => {
      if (a.hand !== b.hand) return a.hand === 'L' ? -1 : 1;
      return (a.finger || 0) - (b.finger || 0);
    });

  const maxFatigue = Math.max(...fatigueData.map(f => f.value), 0.1);

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-700 bg-slate-900">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
            activeTab === 'overview'
              ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-800'
              : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('handAnalysis')}
          className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
            activeTab === 'handAnalysis'
              ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-800'
              : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
          }`}
        >
          Hand Analysis
        </button>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {activeTab === 'overview' && (
          <>
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Ergonomic Analysis</h3>
      
      {/* Overall Score */}
      <div className="flex flex-col items-center mb-6">
        <div className={`text-5xl font-bold ${scoreColor} mb-1`}>
          {Math.round(score)}
        </div>
        <span className="text-slate-500 text-xs">Performability Score</span>
      </div>

      {/* Key Stats */}
      <div className="space-y-3 mb-6">
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-400">Hard Notes</span>
          <span className={`font-mono font-bold ${hardCount > 0 ? 'text-yellow-400' : 'text-slate-200'}`}>
            {hardCount}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-400">Unplayable</span>
          <span className={`font-mono font-bold ${unplayableCount > 0 ? 'text-red-400' : 'text-slate-200'}`}>
            {unplayableCount}
          </span>
        </div>
      </div>

      {/* Hand Balance */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-slate-500 mb-2">
          <span>Left Hand</span>
          <span>Right Hand</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
          <div 
            className="h-full bg-blue-500/70" 
            style={{ width: `${lhPercent}%` }} 
          />
          <div 
            className="h-full bg-purple-500/70" 
            style={{ width: `${rhPercent}%` }} 
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1 font-mono">
          <span>{lhCount} ({lhPercent}%)</span>
          <span>{rhCount} ({rhPercent}%)</span>
        </div>
      </div>

      {/* Finger Usage */}
      <div className="mb-4">
        <h4 className="text-slate-500 text-xs font-bold uppercase mb-2">Finger Usage</h4>
        <div className="space-y-1.5">
          {allFingers.map((finger) => (
            <div key={`${finger.hand}${finger.finger}`} className="flex items-center justify-between text-xs">
              <span className="text-slate-400">
                {finger.name} ({formatFinger(finger.hand, finger.finger)})
              </span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${
                      finger.percentage >= 30 ? 'bg-orange-500' :
                      finger.percentage >= 20 ? 'bg-yellow-500' :
                      'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(finger.percentage, 100)}%` }}
                  />
                </div>
                <span className="text-slate-300 font-mono w-10 text-right">
                  {finger.percentage}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fatigue Warnings */}
      {fatigueWarnings.length > 0 && (
        <div className="mb-4 p-2 bg-orange-900/20 border border-orange-800/50 rounded">
          <h4 className="text-orange-400 text-xs font-bold uppercase mb-1.5">Fatigue Warnings</h4>
          <div className="space-y-1 text-xs text-orange-300">
            {fatigueWarnings.map((finger) => (
              <div key={`warning-${finger.hand}${finger.finger}`}>
                High usage detected on {finger.name} ({finger.percentage}%).
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Choke Points */}
      {chokePoints.length > 0 && (
        <div className="mb-4">
          <h4 className="text-slate-500 text-xs font-bold uppercase mb-2">
            Choke Points ({chokePoints.length})
          </h4>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {chokePoints.slice(0, 20).map((event, index) => (
              <button
                key={`choke-${index}-${event.noteNumber}-${event.startTime}`}
                onClick={() => handleChokePointClick(event)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                  event.difficulty === 'Unplayable'
                    ? 'bg-red-900/30 hover:bg-red-900/50 border border-red-800/50 text-red-200'
                    : 'bg-orange-900/20 hover:bg-orange-900/40 border border-orange-800/30 text-orange-200'
                }`}
                disabled={!onHighlightCell || !activeMapping}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    Note {event.noteNumber} ({event.difficulty})
                  </span>
                  {event.finger && event.assignedHand !== 'Unplayable' && (
                    <span className="text-[10px] opacity-75">
                      {typeof event.finger === 'number' 
                        ? formatFinger(normalizeHandString(event.assignedHand), event.finger)
                        : `${normalizeHandString(event.assignedHand)}-${event.finger.charAt(0).toUpperCase() + event.finger.slice(1)}`
                      }
                    </span>
                  )}
                </div>
                {event.cost !== Infinity && (
                  <div className="text-[10px] opacity-60 mt-0.5">
                    Cost: {event.cost.toFixed(2)}
                  </div>
                )}
              </button>
            ))}
            {chokePoints.length > 20 && (
              <div className="text-xs text-slate-500 text-center py-1">
                +{chokePoints.length - 20} more...
              </div>
            )}
          </div>
        </div>
      )}

            {/* Legend */}
            <div className="mt-auto pt-4 border-t border-slate-800">
              <h4 className="text-slate-500 text-[10px] font-bold uppercase mb-2">Legend</h4>
              <div className="space-y-1 text-[10px] text-slate-400">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span>Easy (Standard)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                  <span>Medium (Stretch)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                  <span>Hard (Fast/Far)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <span>Unplayable</span>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'handAnalysis' && (
          <>
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Hand Analysis</h3>

            {/* Average Drift Metric */}
            <div className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm font-medium">Average Drift</span>
                <span className={`text-2xl font-bold ${
                  averageDrift < 2 ? 'text-green-400' :
                  averageDrift < 4 ? 'text-yellow-400' :
                  'text-orange-400'
                }`}>
                  {averageDrift.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Average distance from home positions (grid cells)
              </p>
            </div>

            {/* Finger Usage Bar Chart */}
            <div className="mb-6">
              <h4 className="text-slate-500 text-xs font-bold uppercase mb-3">Finger Usage Distribution</h4>
              <div className="space-y-2">
                {fingerUsageData.map((finger) => (
                  <div key={`${finger.hand}${finger.finger}`} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">
                        {finger.name}
                      </span>
                      <span className="text-slate-300 font-mono">
                        {finger.count} ({finger.percentage}%)
                      </span>
                    </div>
                    <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          finger.percentage >= 30 ? 'bg-orange-500' :
                          finger.percentage >= 20 ? 'bg-yellow-500' :
                          'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min((finger.count / finger.maxCount) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
                {fingerUsageData.length === 0 && (
                  <div className="text-xs text-slate-500 text-center py-4">
                    No finger usage data available
                  </div>
                )}
              </div>
            </div>

            {/* Fatigue Heat Map */}
            <div className="mb-4">
              <h4 className="text-slate-500 text-xs font-bold uppercase mb-3">Fatigue Heat Map</h4>
              <div className="grid grid-cols-2 gap-2">
                {fatigueData.map((finger) => {
                  const intensity = maxFatigue > 0 ? (finger.value / maxFatigue) : 0;
                  const colorIntensity = Math.min(intensity * 255, 255);
                  const bgColor = `rgb(${colorIntensity}, ${100 - colorIntensity * 0.3}, ${100 - colorIntensity * 0.5})`;
                  
                  return (
                    <div
                      key={finger.key}
                      className="p-3 rounded-lg border border-slate-700"
                      style={{
                        backgroundColor: `rgba(${Math.round(colorIntensity)}, ${Math.round(100 - colorIntensity * 0.3)}, ${Math.round(100 - colorIntensity * 0.5)}, 0.2)`,
                        borderColor: `rgba(${Math.round(colorIntensity)}, ${Math.round(100 - colorIntensity * 0.3)}, ${Math.round(100 - colorIntensity * 0.5)}, 0.5)`
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-300">
                          {finger.name}
                        </span>
                        <span className={`text-xs font-mono ${
                          finger.value < 0.5 ? 'text-green-400' :
                          finger.value < 1.0 ? 'text-yellow-400' :
                          'text-orange-400'
                        }`}>
                          {finger.value.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            finger.value < 0.5 ? 'bg-green-500' :
                            finger.value < 1.0 ? 'bg-yellow-500' :
                            'bg-orange-500'
                          }`}
                          style={{ width: `${Math.min(intensity * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {fatigueData.length === 0 && (
                <div className="text-xs text-slate-500 text-center py-4">
                  No fatigue data available
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
