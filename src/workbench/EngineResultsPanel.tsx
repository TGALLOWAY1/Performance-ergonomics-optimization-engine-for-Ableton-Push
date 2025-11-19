import React from 'react';
import { EngineResult } from '../engine/runEngine';

interface EngineResultsPanelProps {
  result: EngineResult | null;
}

export const EngineResultsPanel: React.FC<EngineResultsPanelProps> = ({ result }) => {
  if (!result) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 text-sm">
        No analysis data available.
      </div>
    );
  }

  const { score, hardCount, unplayableCount, debugEvents } = result;

  // Calculate Hand Balance
  const lhCount = debugEvents.filter(e => e.assignedHand === 'LH').length;
  const rhCount = debugEvents.filter(e => e.assignedHand === 'RH').length;
  const totalAssigned = lhCount + rhCount;
  
  const lhPercent = totalAssigned > 0 ? Math.round((lhCount / totalAssigned) * 100) : 0;
  const rhPercent = totalAssigned > 0 ? Math.round((rhCount / totalAssigned) * 100) : 0;

  // Score Color
  let scoreColor = 'text-slate-200';
  if (score > 80) scoreColor = 'text-green-400';
  else if (score > 50) scoreColor = 'text-yellow-400';
  else scoreColor = 'text-red-400';

  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto">
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
    </div>
  );
};
