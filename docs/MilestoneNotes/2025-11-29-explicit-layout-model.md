# Explicit Layout Model Implementation

**Date:** 2025-11-29
**Branch:** 34-update-the-optimization-engine-approach

## Summary

Refactored the grid editor to use an **explicit, user-driven layout model** instead of auto-generating layouts on load. This addresses bugs and UX confusion caused by automatic pad positioning.

## Key Changes

### 1. Auto-Layout Behavior (REMOVED)

**Previous Behavior:**
- MIDI import (`midiImport.ts`) auto-mapped voices to grid cells
- Grid would show populated layout immediately after MIDI import
- No explicit user action required for initial layout

**New Behavior:**
- MIDI import creates voices in `parkedSounds` (staging area) only
- Grid starts **EMPTY** when opening a song
- Users must explicitly assign sounds via:
  - Drag & drop
  - "Assign Manually" button
  - "Optimize Layout" button

### 2. New Layout Toolbar (`LayoutDesigner.tsx`)

Added an explicit layout controls toolbar with 4 buttons:

| Button | Action | layoutMode |
|--------|--------|------------|
| **Assign Manually** | Random, non-colliding placement of unassigned sounds | `'random'` |
| **Optimize Layout** | Run biomechanical solver (marks as optimized) | `'optimized'` |
| **Clear Grid** | Move all sounds back to staging | `'none'` |
| **Save Layout** | Increment version number for versioning | (preserves current) |

### 3. Layout Mode Tracking

Added `layoutMode` field to `GridMapping` type:

```typescript
type LayoutMode = 'manual' | 'optimized' | 'random' | 'none';

interface GridMapping {
  // ... existing fields
  layoutMode?: LayoutMode;
  version?: number;
  savedAt?: string;
}
```

Mode is set by:
- Opening a song → loaded from storage
- Manual drag → `'manual'`
- "Assign Manually" → `'random'`
- "Optimize Layout" → `'optimized'`
- "Clear Grid" → `'none'`

### 4. Autosave (PRESERVED)

The existing autosave mechanism remains unchanged:
- Debounced (1 second) persistence on `projectState` changes
- Uses `songService.saveSongState()` to persist to localStorage
- Immediate save on component unmount

**Autosave triggers for all user actions:**
- Drag & drop
- Button clicks (Assign, Optimize, Clear, Save)
- Any mapping changes

## Files Modified

| File | Changes |
|------|---------|
| `src/types/layout.ts` | Added `LayoutMode` type, `layoutMode`, `version`, `savedAt` fields |
| `src/utils/midiImport.ts` | Removed auto-mapping logic; grid starts empty |
| `src/services/SongService.ts` | Set `layoutMode: 'none'` on MIDI import |
| `src/workbench/Workbench.tsx` | Added `handleOptimizeLayout`, `handleSaveLayoutVersion` handlers |
| `src/workbench/LayoutDesigner.tsx` | Added layout toolbar UI with 4 buttons |

## Testing Verification

✅ Open song with no MIDI → Empty grid, prompt to link MIDI
✅ Import MIDI → Grid empty, all voices in staging
✅ "Assign Manually" → Random placement, mode shows "Random Layout"
✅ Manual drag → Mode changes to "Manual Layout"
✅ "Clear Grid" → Grid empty, mode shows "No Layout"
✅ "Save Layout" → Version incremented, autosave persists
✅ Navigation between pages → Layout preserved via autosave

## Context-Aware Loading

When opening a song from Song Portfolio:
1. **Existing layout** → Load exactly as saved (no modification)
2. **No layout** → Grid empty, all sounds in staging area

No automatic layout generation or optimization on load.

