# Dashboard User Flow & Components Documentation

## Dashboard User Flow

### Loading Existing Songs

• **On Dashboard Mount:**
  - `songService.seedMockData()` is called to populate empty storage with sample songs
  - `refreshSongs()` loads all songs from LocalStorage via `songService.getAllSongs()`
  - Dashboard checks which songs have MIDI data using `songService.hasMidiData(songId)`
  - Songs are displayed in a responsive grid layout (1-4 columns based on screen size)

• **Song List Display:**
  - Each song is rendered as a `SongCard` component
  - Cards show title, BPM, performance rating, and practice time
  - Status badges indicate "In Progress" or "Mastered" based on recent practice activity
  - MIDI link indicator (green checkmark) appears on songs with linked MIDI files

• **Song Selection:**
  - Clicking a song card navigates to the Workbench (via React Router)
  - URL format: `/workbench?songId={songId}`
  - The Workbench loads the song's project state from LocalStorage

### Importing a New MIDI File

• **Import Button (Footer):**
  - User clicks "Import MIDI" button in the footer
  - Hidden file input (`<input type="file" accept=".mid,.midi">`) is triggered
  - File picker opens for user to select a MIDI file

• **Import Process:**
  - `handleFileChange()` receives the selected file
  - `songService.importSongFromMidi(file)` is called
  - MIDI file is converted to base64 for storage
  - `parseMidiFileToProject()` extracts:
    - Performance events (NoteEvent array)
    - Instrument configuration
    - Voice definitions (all voices go to `parkedSounds` staging area)
    - Grid mapping (initially empty with `layoutMode: 'none'`)
  - Song metadata is inferred:
    - Title from filename or performance name
    - BPM from MIDI tempo
    - Key from minimum note number (basic heuristic)
    - Duration from last event timestamp
  - New `Song` object is created with:
    - Unique UUID for song ID
    - Unique UUID for `projectStateId`
    - Base64-encoded MIDI data
    - Initial `ProjectState` saved to LocalStorage
  - Song is added to LocalStorage under key `'push_perf_songs'`
  - Dashboard refreshes to show the new song

• **Post-Import State:**
  - All voices are in `parkedSounds` (staging area)
  - Grid mapping is empty (`layoutMode: 'none'`)
  - User must explicitly assign sounds to pads via drag & drop or layout controls
  - This follows the "Explicit Layout Model" - grid starts empty

### Linking MIDI to Existing Song

• **Link MIDI Button (SongCard):**
  - Each song card has a "Link MIDI" or "Re-link MIDI" button
  - Button color: amber if no MIDI linked, slate if MIDI already linked
  - Click handler uses refs to preserve user gesture chain (critical for file input)
  - Hidden file input is clicked synchronously to avoid browser security restrictions

• **Link Process:**
  - `handleLinkMidiFileChange()` receives the selected file
  - Song ID is retrieved from ref (stored before file picker opened)
  - `songService.linkMidiToSong(songId, file)` is called
  - MIDI file is converted to base64 and stored in song object
  - Project state is created/updated from MIDI data
  - Song metadata is updated with:
    - BPM from MIDI tempo
    - Duration from last event
    - Key inference
    - "Imported" tag added if not present
  - Updated song and project state are saved to LocalStorage
  - Dashboard refreshes to show updated MIDI link status

### Navigating to the Workbench

• **Editor Button (SongCard):**
  - "Editor" button on each song card navigates to Workbench
  - URL: `/workbench?songId={songId}`
  - Uses React Router's `useNavigate()` hook

• **Workbench Load Process:**
  - Workbench reads `songId` from URL query parameters
  - `songService.loadSongState(songId)` retrieves project state from LocalStorage
  - Project state is loaded into `ProjectContext` via `setProjectState()`
  - All layouts, mappings, parked sounds, and engine results are restored
  - User can now edit the song's layout, run solvers, and analyze performance

• **Alternative Navigation:**
  - "Analyze" button navigates to `/event-analysis?songId={songId}`
  - "Practice" button (placeholder) would navigate to practice mode

---

## SongService & Persistence

### LocalStorage Structure

• **Songs Storage:**
  - Key: `'push_perf_songs'`
  - Value: JSON object mapping `songId → Song`
  - `Song` structure:
    ```typescript
    {
      projectStateId: string,      // UUID for project state storage
      midiData?: string,            // Base64-encoded MIDI file
      midiFileName?: string,        // Original filename
      metadata: SongMetadata,       // Title, artist, BPM, rating, etc.
      sections: []                  // Future: song sections
    }
    ```

• **Project State Storage:**
  - Key: `'push_perf_project_{projectStateId}'`
  - Value: JSON stringified `ProjectState` object
  - Contains: layouts, mappings, parked sounds, engine results, etc.
  - Each song has its own isolated project state

### Helper Functions Used

• **`saveProjectStateToStorage(id, state)`** (from `projectPersistence.ts`):
  - Saves complete `ProjectState` to LocalStorage
  - Key format: `push_perf_project_{id}`
  - Handles quota exceeded errors gracefully
  - Logs debug information about saved state

• **`loadProjectStateFromStorage(id)`** (from `projectPersistence.ts`):
  - Loads `ProjectState` from LocalStorage
  - Returns `null` if not found
  - Logs debug information about loaded state

• **`deleteProjectStateFromStorage(id)`** (from `projectPersistence.ts`):
  - Deletes project state when song is deleted
  - Prevents orphaned data in LocalStorage

• **`parseMidiFileToProject(file)`** (from `midiImport.ts`):
  - Parses MIDI file to extract:
    - Performance events (NoteEvent[])
    - Instrument configuration
    - Voice definitions
    - Grid mapping structure
  - Returns `MidiProjectData` object

• **`fileToBase64(file)`** (private method in SongService):
  - Converts File object to base64 string
  - Uses FileReader API
  - Strips data URL prefix
  - Used for storing MIDI files in LocalStorage

• **`base64ToArrayBuffer(base64)`** (private method in SongService):
  - Converts base64 string back to ArrayBuffer
  - Used for re-parsing MIDI data if needed

### SongService Methods

• **`getAllSongs(): SongMetadata[]`**
  - Retrieves all songs from LocalStorage
  - Returns array of metadata objects (not full Song objects)
  - Used by Dashboard to display song list

• **`getSong(id): Song | null`**
  - Retrieves full Song object by ID
  - Includes MIDI data and project state ID
  - Returns `null` if not found

• **`createSong(title, artist, bpm, key): Song`**
  - Creates new song with empty project state
  - Generates UUIDs for song ID and projectStateId
  - Saves to LocalStorage immediately

• **`importSongFromMidi(file): Promise<Song>`**
  - Imports MIDI file and creates new song
  - Stores MIDI as base64
  - Creates initial project state with all voices in `parkedSounds`
  - Infers metadata (title, BPM, key, duration)
  - Saves both song and project state to LocalStorage

• **`linkMidiToSong(songId, file): Promise<Song | null>`**
  - Links MIDI file to existing song
  - Updates song metadata
  - Creates/updates project state
  - Preserves existing song data

• **`hasMidiData(songId): boolean`**
  - Checks if song has linked MIDI data
  - Used to show/hide MIDI link indicators

• **`updateSongMetadata(id, updates): void`**
  - Updates song metadata fields
  - Merges updates with existing metadata
  - Saves to LocalStorage

• **`deleteSong(id): void`**
  - Deletes song from LocalStorage
  - Also deletes associated project state
  - Prevents orphaned data

• **`saveSongState(songId, state): void`**
  - Saves project state for a song
  - Updates `lastPracticed` timestamp
  - Called when user saves work in Workbench

• **`loadSongState(songId): ProjectState | null`**
  - Loads project state for a song
  - Returns `null` if not found
  - Called when navigating to Workbench

• **`seedMockData(): void`**
  - Populates LocalStorage with sample songs if empty
  - Creates 4 mock songs with various metadata
  - Used for MVP/demo purposes

---

## SongCard UI & Props

### Props Interface

```typescript
interface SongCardProps {
  song: SongMetadata;                    // Song metadata (title, BPM, rating, etc.)
  onDelete?: (id: string, title: string) => void;
  onLinkMidi?: (id: string) => void;     // Callback to trigger MIDI file input
  linkMidiInputRef?: React.RefObject<HTMLInputElement>;  // Ref to hidden file input
  onLinkMidiFileChange?: (songId: string) => void;      // Legacy callback
  onUpdate?: (id: string, updates: Partial<SongMetadata>) => void;
  hasMidiLinked?: boolean;               // Whether song has MIDI data
}
```

### Rendering Logic

• **Status Badge Display:**
  - **"In Progress" badge (blue):**
    - Shown if `song.lastPracticed > Date.now() - 86400000 * 3` (within last 3 days)
    - Blue background with blue text
    - Indicates recent practice activity
  - **"Mastered" badge (green):**
    - Shown if `song.performanceRating > 90` AND not "In Progress"
    - Green background with green text
    - Indicates high performance rating
  - **No badge:**
    - If neither condition is met
    - Song appears without status indicator

• **MIDI Link Indicator:**
  - Green checkmark icon appears on song icon if `hasMidiLinked === true`
  - Positioned at bottom-right of icon
  - Tooltip: "MIDI linked"
  - Visual confirmation that song has MIDI data

• **Link/Re-link MIDI Button:**
  - **If no MIDI linked:**
    - Button text: "Link MIDI"
    - Amber background (`bg-amber-600`)
    - Positioned below status badge
  - **If MIDI already linked:**
    - Button text: "Re-link" with refresh icon
    - Slate background (`bg-slate-600`)
    - Allows replacing existing MIDI file
  - Click handler uses refs to preserve user gesture chain
  - Prevents card click navigation via `stopPropagation()`

• **Delete Button:**
  - Only visible on hover (`opacity-0 group-hover:opacity-100`)
  - Red hover state
  - Positioned next to status badge
  - Confirmation dialog before deletion

• **Edit Mode:**
  - Double-click on title or icon to enter edit mode
  - Inline editing for:
    - Title (text input)
    - BPM (number input, clamped 1-999)
  - Save on Enter key or blur
  - Cancel on Escape key
  - Updates saved via `onUpdate` callback

• **Stats Grid:**
  - Three columns displaying:
    - **BPM:** Song tempo (monospace font)
    - **Rating:** Performance rating out of 100 (e.g., "88/100")
    - **Practiced:** Total practice time in hours and minutes
  - Small text, muted colors

• **Action Buttons:**
  - **Editor:** Blue button, navigates to `/workbench?songId={songId}`
  - **Analyze:** Purple button, navigates to `/event-analysis?songId={songId}`
  - **Practice:** Green button (placeholder, no handler yet)
  - All buttons have icons and rounded-full styling
  - Hover effects with shadow and color transitions

• **Card Styling:**
  - Dark slate background with border
  - Hover effects: slight lift (`-translate-y-1`), shadow, border color change
  - Responsive grid layout (1-4 columns based on screen size)
  - Smooth transitions on all interactive elements

### Event Handlers

• **`handleDeleteClick(e)`**
  - Stops event propagation to prevent card navigation
  - Calls `onDelete(song.id, song.title)`
  - Dashboard shows confirmation dialog

• **`handleLinkMidiClick(e)`**
  - Stops event propagation
  - Uses ref to click file input synchronously (preserves user gesture)
  - Stores song ID in data attribute for later retrieval
  - Critical: Must be synchronous to avoid browser security restrictions

• **`handleWorkbenchClick(e)`**
  - Stops event propagation
  - Navigates to `/workbench?songId={songId}`

• **`handleAnalyzeEventsClick(e)`**
  - Stops event propagation
  - Navigates to `/event-analysis?songId={songId}`

• **`handleDoubleClick(e)`**
  - Enters edit mode
  - Sets `isEditing` state to `true`

• **`handleSaveEdit()`**
  - Validates and clamps BPM (1-999)
  - Trims title whitespace
  - Only updates if values changed
  - Calls `onUpdate(song.id, { title, bpm })`
  - Exits edit mode

• **`handleCancelEdit()`**
  - Resets edited values to original
  - Exits edit mode without saving

---

## Summary

The Dashboard provides a song portfolio interface where users can:
- View all songs with metadata and status indicators
- Import new MIDI files to create songs
- Link MIDI files to existing songs
- Navigate to Workbench for editing and analysis
- Edit song metadata inline
- Delete songs (with confirmation)

SongService manages all persistence using LocalStorage with two storage keys:
- `'push_perf_songs'` for song metadata and MIDI data
- `'push_perf_project_{id}'` for project states

SongCard renders individual songs with status badges, MIDI indicators, and action buttons, using props to handle user interactions and maintain separation of concerns.

