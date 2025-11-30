# Link MIDI Bug Fix and Refactoring

**Date:** 2025-11-30
**Branch:** Current branch

## Summary

Fixed a critical bug in the "Link MIDI" functionality on the Song Portfolio (Dashboard) page. The button was not properly linking MIDI files to songs, preventing the entire application from functioning. The solution involved refactoring from a fragile global file input approach to a robust per-card file input pattern using native HTML label behavior.

## Problem Statement

The "Link MIDI" button on song cards was not working. Console logs showed:
- Button clicks were registered (`[LinkMIDI Debug] Link MIDI label clicked`)
- But file input `onChange` handlers never fired
- No logs from `handleLinkMidiFileChange`, `handleMidiLinked`, or `songService.linkMidiToSong`

This was a **critical blocker** since nothing in the tool works without a linked MIDI file.

## Root Cause Analysis

The original implementation used:
- A single global hidden `<input type="file">` in `Dashboard.tsx`
- `SongCard` manually setting `data-song-id` attributes via `document.getElementById`
- `Dashboard` calling `.click()` on the input via refs
- Complex callback chains that broke the browser's user gesture requirements

This approach was fragile and violated browser security restrictions on programmatic file input clicks.

## Solution: Per-Card File Input with Label Pattern

### Architecture Change

**Before:**
- Global file input shared across all song cards
- Manual DOM manipulation with `document.getElementById`
- Programmatic `.click()` calls on refs
- `data-song-id` attributes for state tracking

**After:**
- Each `SongCard` owns its own hidden file input
- Native HTML `<label>` element wraps the file input
- Browser handles click → file dialog natively
- Clean callback: `onLinkMidi(songId: string, file: File)`

### Key Changes

#### 1. SongCard Component (`src/components/dashboard/SongCard.tsx`)

**Removed:**
- `useRef` import and `linkMidiInputRef`
- `handleLinkMidiClick` function that called `.click()` on refs
- `linkMidiInputId` prop
- All `document.getElementById` calls
- `data-song-id` attribute manipulation

**Added:**
- Local file input inside each card's label
- `handleLinkMidiFileChange` handler that calls `onLinkMidi(song.id, file)`
- Label-based pattern: `<label><input type="file" /></label>`
- Enhanced debug logging

**Updated Props Interface:**
```typescript
interface SongCardProps {
  song: SongMetadata;
  onDelete?: (id: string, title: string) => void;
  onLinkMidi?: (songId: string, file: File) => void | Promise<void>;  // Changed signature
  onUpdate?: (id: string, updates: Partial<SongMetadata>) => void;
  hasMidiLinked?: boolean;
}
```

**File Input Styling:**
Changed from `className="hidden"` to `className="absolute opacity-0 w-px h-px -z-10 pointer-events-none"` with `tabIndex={-1}` to ensure browser accessibility while remaining visually hidden.

#### 2. Dashboard Component (`src/pages/Dashboard.tsx`)

**Removed:**
- `linkMidiInputRef` ref
- `linkingMidiSongIdRef` ref
- `linkingMidiForSongId` state
- `triggerLinkMidiFileInput` callback function
- `handleLinkMidiFileChange` handler (old version)
- Global `link-midi-input` file input element

**Added:**
- `handleMidiLinked(songId: string, file: File)` handler
- Global file input change listener for diagnostics (capture phase)
- Visible debug file input in bottom-left corner for testing

**Updated SongCard Rendering:**
```typescript
<SongCard 
  key={song.id} 
  song={song} 
  onDelete={handleDeleteSong}
  onLinkMidi={handleMidiLinked}  // New signature
  onUpdate={handleUpdateSong}
  hasMidiLinked={songsWithMidi.has(song.id)}
/>
```

#### 3. SongService (`src/services/SongService.ts`)

**Enhanced Logging:**
- Added `fileSize` to `linkMidiToSong` debug logs
- Added `projectStateId` to success logs
- Improved error logging with structured data

### New Flow (Step-by-Step)

1. **User clicks "Link MIDI" label on song card**
   - Label's `onClick` fires, stops propagation, logs debug info
   - Browser natively opens file dialog (no JavaScript `.click()` needed)

2. **User selects a `.mid` or `.midi` file**
   - File input's `onChange` fires (`handleLinkMidiFileChange`)
   - Logs: `[LinkMIDI Debug] handleLinkMidiFileChange fired in SongCard`

3. **SongCard calls `onLinkMidi(song.id, file)`**
   - Calls the prop callback passed from Dashboard

4. **Dashboard receives callback**
   - `handleMidiLinked(songId, file)` fires
   - Logs: `[LinkMIDI Debug] handleMidiLinked called`

5. **Dashboard calls `songService.linkMidiToSong(songId, file)`**
   - Service logs: `[LinkMIDI Debug] linkMidiToSong called`
   - Service parses MIDI, creates/updates project state, updates song metadata
   - Service logs: `[LinkMIDI Debug] linkMidiToSong finished` on success

6. **Songs state refreshes**
   - `refreshSongs()` updates songs list and `songsWithMidi` set
   - UI updates to show MIDI linked status (green checkmark indicator)

## Diagnostic Tools Added

### Global File Input Change Listener

Added a document-level change event listener in `Dashboard.tsx` that captures all file input changes:

```typescript
useEffect(() => {
  const handler = (event: Event) => {
    const target = event.target as HTMLInputElement | null;
    if (!target || target.type !== "file") return;
    
    console.log("[FileDebug] Native change event on <input type='file'>", {
      id: target.id || null,
      name: target.name || null,
      className: target.className || null,
      hasFiles: !!target.files && target.files.length > 0,
      filesCount: target.files?.length ?? 0,
      fileName: file?.name ?? null,
    });
  };
  
  document.addEventListener("change", handler, true);  // Capture phase
  return () => document.removeEventListener("change", handler, true);
}, []);
```

This helps diagnose if:
- File input change events are firing at all
- Which specific input is receiving the change event
- Whether React's synthetic events are working correctly

### Debug File Input UI

Added a visible debug file input in the bottom-left corner of the Dashboard:

```typescript
<div className="fixed bottom-2 left-2 z-50 bg-slate-900/90 border border-amber-500/50 ...">
  <div className="font-mono mb-1">FileInput Debug</div>
  <input
    type="file"
    accept=".mid,.midi"
    onChange={(e) => {
      console.log("[FileDebug] DEBUG direct input onChange fired", {...});
    }}
  />
</div>
```

This simple input (no labels, no refs, no hidden classes) helps verify that file inputs work in the app at all.

## Debug Logging Strategy

All debug logs are prefixed with `[LinkMIDI Debug]` or `[FileDebug]` for easy filtering:

- **Dashboard useEffect**: Logs all songs with MIDI link status on load
- **SongCard label onClick**: Logs when label is clicked
- **SongCard handleLinkMidiFileChange**: Logs when React onChange fires (early log)
- **Dashboard handleMidiLinked**: Logs when handler receives callback
- **SongService linkMidiToSong**: Logs at start, on success, and on error
- **Global change listener**: Logs all native file input change events

## Files Modified

| File | Changes |
|------|---------|
| `src/components/dashboard/SongCard.tsx` | Removed ref-based approach, added per-card file input with label pattern, updated props interface |
| `src/pages/Dashboard.tsx` | Removed global file input infrastructure, added `handleMidiLinked` handler, added diagnostic tools |
| `src/services/SongService.ts` | Enhanced debug logging in `linkMidiToSong` method |

## Technical Notes

### Why Label Pattern Works

- **Native Browser Behavior**: Clicking a `<label>` associated with a file input (by containing it) is always treated as a direct user gesture
- **No Security Restrictions**: Browsers don't block label-triggered file dialogs
- **No Programmatic Clicks**: Eliminates the need for `.click()` calls that can be blocked
- **Simpler Code**: No refs, no DOM manipulation, no callback chains

### File Input Styling Considerations

Changed from `className="hidden"` to `className="absolute opacity-0 w-px h-px -z-10 pointer-events-none"` because:
- Some browsers don't recognize `hidden` inputs for label association
- The new styling keeps the input accessible to the label while visually hidden
- `pointer-events-none` prevents the input from interfering with label clicks
- `tabIndex={-1}` prevents keyboard navigation to the hidden input

### Diagnostic Approach

The diagnostic tools help identify:
1. **If file inputs work at all**: Debug input in bottom-left
2. **If change events fire**: Global document listener
3. **If React handlers fire**: SongCard's `handleLinkMidiFileChange` early log
4. **Which input fired**: Global listener logs id, name, className

## Testing Verification

✅ Each song card has its own file input
✅ Label click opens file dialog natively
✅ File selection triggers `onChange` handler
✅ `onLinkMidi` callback receives correct `songId` and `file`
✅ `handleMidiLinked` in Dashboard processes the file
✅ `songService.linkMidiToSong` successfully links MIDI
✅ UI updates to show MIDI linked status
✅ Debug tools help diagnose any remaining issues

## User Experience

**Before Fix:**
- "Link MIDI" button appeared to work (logs showed clicks)
- But file picker didn't open or file selection didn't process
- Users couldn't link MIDI files, blocking all functionality

**After Fix:**
- "Link MIDI" button reliably opens file picker
- File selection properly triggers linking process
- Users can successfully link MIDI files to songs
- Visual feedback (green checkmark) confirms successful linking
- Debug tools available for troubleshooting if needed

## Future Considerations

- The debug file input and global listener can be removed once the fix is confirmed stable
- Consider adding loading state during MIDI linking process
- Consider adding error handling UI (beyond console logs and alerts)
- The diagnostic tools demonstrate a pattern for debugging similar issues in the future

