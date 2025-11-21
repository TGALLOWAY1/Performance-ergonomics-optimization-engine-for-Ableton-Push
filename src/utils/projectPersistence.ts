/**
 * Project persistence utilities for saving and loading project state.
 */

import { ProjectState } from '../types/projectState';
import { GridMapping, Voice } from '../types/layout';

/**
 * Saves the full project state to a JSON file.
 * 
 * @param state - The complete ProjectState to save
 */
export function saveProject(state: ProjectState): void {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'project.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Loads a project state from a JSON file.
 * 
 * @param file - The JSON file to load
 * @returns Promise that resolves to the loaded ProjectState
 */
export async function loadProject(file: File): Promise<ProjectState> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  
  // Validate and ensure all required fields exist
  const state: ProjectState = {
    layouts: Array.isArray(parsed.layouts) ? parsed.layouts : [],
    sectionMaps: Array.isArray(parsed.sectionMaps) ? parsed.sectionMaps : [],
    activeLayoutId: parsed.activeLayoutId || null,
    projectTempo: parsed.projectTempo || 120,
    parkedSounds: Array.isArray(parsed.parkedSounds) ? parsed.parkedSounds : [],
    mappings: Array.isArray(parsed.mappings) ? parsed.mappings : [],
  };
  
  return state;
}

/**
 * Exports a single layout mapping with all referenced Voices.
 * This ensures the layout can be imported independently without broken references.
 * 
 * @param mapping - The GridMapping to export
 * @param allParkedSounds - All available Voices (to find referenced ones)
 */
export function exportLayout(mapping: GridMapping, allParkedSounds: Voice[]): void {
  // Collect all unique Voices referenced by this mapping
  const referencedAssetIds = new Set<string>();
  Object.values(mapping.cells).forEach(sound => {
    referencedAssetIds.add(sound.id);
  });
  
  // Find all referenced assets from parkedSounds
  const referencedAssets: Voice[] = [];
  referencedAssetIds.forEach(id => {
    const asset = allParkedSounds.find(s => s.id === id);
    if (asset) {
      referencedAssets.push(asset);
    }
  });
  
  // Also include any assets that are in the mapping but not in parkedSounds
  // (in case they were only in the mapping)
  Object.values(mapping.cells).forEach(sound => {
    if (!referencedAssets.find(a => a.id === sound.id)) {
      referencedAssets.push(sound);
    }
  });
  
  const exportData = {
    mapping,
    referencedAssets,
  };
  
  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  // Sanitize filename - remove invalid characters
  const safeName = mapping.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  link.download = `${safeName}.layout.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Imports a layout file into the current project.
 * Adds the mapping and referenced assets without overwriting existing data.
 * 
 * @param file - The layout JSON file to import
 * @param currentProject - The current ProjectState to merge into
 * @returns Updated ProjectState with the imported layout and assets
 */
export async function importLayout(
  file: File,
  currentProject: ProjectState
): Promise<ProjectState> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  
  // Validate structure
  if (!parsed.mapping || !parsed.referencedAssets) {
    throw new Error('Invalid layout file format. Expected { mapping, referencedAssets }');
  }
  
  const importedMapping: GridMapping = parsed.mapping;
  const importedAssets: Voice[] = Array.isArray(parsed.referencedAssets) 
    ? parsed.referencedAssets 
    : [];
  
  // Deduplicate assets by ID - only add if not already in parkedSounds
  const existingAssetIds = new Set(currentProject.parkedSounds.map(s => s.id));
  const newAssets = importedAssets.filter(asset => !existingAssetIds.has(asset.id));
  
  // Generate new ID for the mapping to avoid conflicts
  const newMapping: GridMapping = {
    ...importedMapping,
    id: `mapping-${Date.now()}`,
    name: importedMapping.name ? `${importedMapping.name} (Imported)` : 'Imported Layout',
  };
  
  return {
    ...currentProject,
    mappings: [...currentProject.mappings, newMapping],
    parkedSounds: [...currentProject.parkedSounds, ...newAssets],
  };
}

