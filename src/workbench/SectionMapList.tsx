import React, { useState, useEffect } from 'react';
import { InstrumentConfig, SectionMap } from '../data/models';

interface SectionMapItemProps {
  section: SectionMap;
  instrumentConfigs: InstrumentConfig[];
  onUpdateSection: (id: string, updates: Partial<SectionMap> | { field: 'startMeasure' | 'lengthInMeasures' | 'bottomLeftNote'; value: number }) => void;
  onDeleteSection?: (id: string) => void;
}

const SectionMapItem: React.FC<SectionMapItemProps> = ({
  section,
  instrumentConfigs,
  onUpdateSection,
  onDeleteSection,
}) => {
  // Use local state for input values to allow temporary empty values
  const [localStartMeasure, setLocalStartMeasure] = useState(section.startMeasure.toString());
  const [localLength, setLocalLength] = useState(section.lengthInMeasures.toString());
  
  // Sync local state when section prop changes
  useEffect(() => {
    setLocalStartMeasure(section.startMeasure.toString());
  }, [section.startMeasure]);
  
  useEffect(() => {
    setLocalLength(section.lengthInMeasures.toString());
  }, [section.lengthInMeasures]);

  return (
    <div className="flex flex-col gap-2 p-3 bg-slate-800 rounded border border-slate-700 text-sm">
      <div className="flex items-center justify-between text-slate-400 text-xs">
        <span>{section.name || section.instrumentConfig.name}</span>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col">
          <label className="text-xs text-slate-400 mb-1 font-medium">Start Bar</label>
          <input
            type="number"
            className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-200 text-xs focus:border-blue-500 outline-none"
            value={localStartMeasure}
            onChange={(e) => {
              setLocalStartMeasure(e.target.value);
            }}
            onBlur={(e) => {
              const val = e.target.value.trim();
              const numVal = parseInt(val, 10);
              if (val === '' || isNaN(numVal) || numVal < 1) {
                // Restore to current value if empty or invalid
                setLocalStartMeasure(section.startMeasure.toString());
              } else {
                // Update if valid
                onUpdateSection(section.id, { field: 'startMeasure', value: numVal });
              }
            }}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-400 mb-1 font-medium">Length (measures)</label>
          <input
            type="number"
            className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-200 text-xs focus:border-blue-500 outline-none"
            value={localLength}
            onChange={(e) => {
              setLocalLength(e.target.value);
            }}
            onBlur={(e) => {
              const val = e.target.value.trim();
              const numVal = parseInt(val, 10);
              if (val === '' || isNaN(numVal) || numVal < 1) {
                // Restore to current value if empty or invalid
                setLocalLength(section.lengthInMeasures.toString());
              } else {
                // Update if valid
                onUpdateSection(section.id, { field: 'lengthInMeasures', value: numVal });
              }
            }}
          />
        </div>
      </div>

      <div className="flex flex-col">
        <label className="text-xs text-slate-500 mb-1">Instrument Config</label>
        <select
          className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-200 text-xs focus:border-blue-500 outline-none"
          value={section.instrumentConfig.id}
          onChange={(e) => {
            const selectedConfig = instrumentConfigs.find(c => c.id === e.target.value);
            if (selectedConfig) {
              onUpdateSection(section.id, { instrumentConfig: selectedConfig });
            }
          }}
        >
          {instrumentConfigs.map(config => (
            <option key={config.id} value={config.id}>
              {config.name} (Note {config.bottomLeftNote})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col">
        <label className="text-xs text-slate-500 mb-1">Bottom Left Note (MIDI)</label>
        <input
          type="number"
          className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-200 text-xs focus:border-blue-500 outline-none"
          value={section.instrumentConfig.bottomLeftNote}
          onChange={(e) => onUpdateSection(section.id, { field: 'bottomLeftNote', value: parseInt(e.target.value) || 0 })}
        />
        <span className="text-[10px] text-slate-500 mt-1">
          Editing the config's bottom left note directly
        </span>
      </div>
      
      {onDeleteSection && (
        <button
          onClick={() => {
            if (window.confirm(`Delete section "${section.name || section.instrumentConfig.name}"?`)) {
              onDeleteSection(section.id);
            }
          }}
          className="mt-2 px-2 py-1 text-xs bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded border border-red-900/50"
        >
          Delete
        </button>
      )}
    </div>
  );
};

interface SectionMapListProps {
  sectionMaps: SectionMap[];
  instrumentConfigs: InstrumentConfig[];
  onUpdateSection: (id: string, updates: Partial<SectionMap> | { field: 'startMeasure' | 'lengthInMeasures' | 'bottomLeftNote'; value: number }) => void;
  onDeleteSection?: (id: string) => void;
  onCreateInstrumentConfig?: (config: Omit<InstrumentConfig, 'id'>) => void;
  onCreateSectionMap?: (sectionMap: Omit<SectionMap, 'id'>) => void;
  onUpdateInstrumentConfig?: (id: string, updates: Partial<InstrumentConfig>) => void;
  onDeleteInstrumentConfig?: (id: string) => void;
}

export const SectionMapList: React.FC<SectionMapListProps> = ({
  sectionMaps,
  instrumentConfigs,
  onUpdateSection,
  onDeleteSection,
  onCreateInstrumentConfig,
  onCreateSectionMap,
  onUpdateInstrumentConfig,
  onDeleteInstrumentConfig,
}) => {
  const [showNewConfigForm, setShowNewConfigForm] = useState(false);
  const [showNewSectionForm, setShowNewSectionForm] = useState(false);
  const [newConfigName, setNewConfigName] = useState('');
  const [newConfigBottomNote, setNewConfigBottomNote] = useState(36);
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionStart, setNewSectionStart] = useState(1);
  const [newSectionLength, setNewSectionLength] = useState(4);
  const [newSectionConfigId, setNewSectionConfigId] = useState<string>('');

  const handleCreateConfig = () => {
    if (!newConfigName.trim() || !onCreateInstrumentConfig) return;
    
    onCreateInstrumentConfig({
      name: newConfigName.trim(),
      rows: 8,
      cols: 8,
      bottomLeftNote: newConfigBottomNote,
    });
    
    setNewConfigName('');
    setNewConfigBottomNote(36);
    setShowNewConfigForm(false);
  };

  const handleCreateSection = () => {
    if (!newSectionName.trim() || !newSectionConfigId || !onCreateSectionMap) return;
    
    const selectedConfig = instrumentConfigs.find(c => c.id === newSectionConfigId);
    if (!selectedConfig) return;
    
    onCreateSectionMap({
      name: newSectionName.trim(),
      startMeasure: newSectionStart,
      lengthInMeasures: newSectionLength,
      instrumentConfig: selectedConfig,
    });
    
    setNewSectionName('');
    setNewSectionStart(1);
    setNewSectionLength(4);
    setNewSectionConfigId('');
    setShowNewSectionForm(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* W1: Instrument Configs Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-300">Instrument Configs</h3>
          {onCreateInstrumentConfig && (
            <button
              onClick={() => setShowNewConfigForm(!showNewConfigForm)}
              className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded"
            >
              + New Config
            </button>
          )}
        </div>
        
        {showNewConfigForm && onCreateInstrumentConfig && (
          <div className="p-3 bg-slate-800 rounded border border-slate-700 mb-2">
            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Config name"
                value={newConfigName}
                onChange={(e) => setNewConfigName(e.target.value)}
                className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-200 text-xs focus:border-blue-500 outline-none"
                autoFocus
              />
              <input
                type="number"
                placeholder="Bottom Left Note (MIDI)"
                value={newConfigBottomNote}
                onChange={(e) => setNewConfigBottomNote(parseInt(e.target.value) || 36)}
                className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-200 text-xs focus:border-blue-500 outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateConfig}
                  className="flex-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowNewConfigForm(false);
                    setNewConfigName('');
                    setNewConfigBottomNote(36);
                  }}
                  className="flex-1 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {instrumentConfigs.map((config) => (
            <div
              key={config.id}
              className="flex flex-col gap-2 p-2 bg-slate-800 rounded border border-slate-700 text-xs"
            >
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-500">Name</label>
                <input
                  type="text"
                  className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-200 text-xs focus:border-blue-500 outline-none"
                  value={config.name}
                  onChange={(e) => {
                    if (onUpdateInstrumentConfig) {
                      onUpdateInstrumentConfig(config.id, { name: e.target.value });
                    }
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-500">Bottom Left Note (MIDI)</label>
                <input
                  type="number"
                  className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-200 text-xs focus:border-blue-500 outline-none"
                  value={config.bottomLeftNote}
                  onChange={(e) => {
                    if (onUpdateInstrumentConfig) {
                      onUpdateInstrumentConfig(config.id, { bottomLeftNote: parseInt(e.target.value) || 0 });
                    }
                  }}
                />
              </div>
              {onDeleteInstrumentConfig && (
                <button
                  onClick={() => {
                    if (window.confirm(`Delete config "${config.name}"?`)) {
                      onDeleteInstrumentConfig(config.id);
                    }
                  }}
                  className="mt-1 px-2 py-1 text-xs bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
          {instrumentConfigs.length === 0 && (
            <div className="text-xs text-slate-500 italic p-2">No instrument configs defined.</div>
          )}
        </div>
      </div>

      {/* W1: Section Maps Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-300">Section Maps</h3>
          {onCreateSectionMap && (
            <button
              onClick={() => setShowNewSectionForm(!showNewSectionForm)}
              className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded"
            >
              + New Section
            </button>
          )}
        </div>

        {showNewSectionForm && onCreateSectionMap && (
          <div className="p-3 bg-slate-800 rounded border border-slate-700 mb-2">
            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Section name"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-200 text-xs focus:border-blue-500 outline-none"
                autoFocus
              />
              <select
                value={newSectionConfigId}
                onChange={(e) => setNewSectionConfigId(e.target.value)}
                className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-200 text-xs focus:border-blue-500 outline-none"
              >
                <option value="">Select Instrument Config</option>
                {instrumentConfigs.map((config) => (
                  <option key={config.id} value={config.id}>
                    {config.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Start Measure"
                  value={newSectionStart}
                  onChange={(e) => setNewSectionStart(parseInt(e.target.value) || 1)}
                  className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-200 text-xs focus:border-blue-500 outline-none"
                />
                <input
                  type="number"
                  placeholder="Length (measures)"
                  value={newSectionLength}
                  onChange={(e) => setNewSectionLength(parseInt(e.target.value) || 4)}
                  className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-200 text-xs focus:border-blue-500 outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateSection}
                  className="flex-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowNewSectionForm(false);
                    setNewSectionName('');
                    setNewSectionStart(1);
                    setNewSectionLength(4);
                    setNewSectionConfigId('');
                  }}
                  className="flex-1 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {sectionMaps.map((section) => (
            <SectionMapItem
              key={section.id}
              section={section}
              instrumentConfigs={instrumentConfigs}
              onUpdateSection={onUpdateSection}
              onDeleteSection={onDeleteSection}
            />
          ))}
          {sectionMaps.length === 0 && (
            <div className="text-xs text-slate-500 italic p-2">No sections defined.</div>
          )}
        </div>
      </div>
    </div>
  );
};

