FLEXIBLE GRID COMPONENT PRD

# **PRD — Grid Visualization Component v3**

### **(Flexible, Layered, Declarative, High-Performance Grid Rendering System)**

### **Owner: TJ Galloway**

### **Version: 3.0**

---

# **0\. Purpose**

The Grid Visualization Component v3 replaces the legacy monolithic grid rendering logic.  
 Its role is to provide a **single, reusable, flexible** visualization engine for:

* Event Snapshot View

* Onion Skinning (N → N+1)

* Timeline/Playback View

* Performance View (live visualization)

* Layout Editor mode

* Difficulty Heatmaps

* Reachability / finger constraints

* Practice Mode transitions

* Any new pipeline within the Performability Engine

The new grid must be **layer-based, declarative, and performant**, with all visualization logic isolated from editing, playback, or engine logic.

---

# **1\. Summary**

The new grid consists of:

### **1\. A declarative data model**

(Instead of passing raw engine data, we pass normalized view-models.)

### **2\. A layered rendering system**

(Base grid, ghost pads, solid pads, vectors, overlays)

### **3\. A reusable API**

(Easy to plug into analysis, playback, editing, diagnostics)

### **4\. High-performance architecture**

(memoized selectors, cached SVG paths, zero unnecessary re-renders)

---

# **2\. Goals**

### **Primary Goals**

1. Build a **modular, composable** grid renderer with multiple layers.

2. Decouple rendering from editing, engine logic, or data shaping.

3. Support Event Analysis (Snapshot \+ Onion Skin) out of the box.

4. Support performance timeline visualization (scrolling events).

5. Support Layout Editing (interaction hooks).

6. Provide a single source of truth for pad geometry & coordinate mapping.

7. Avoid O(pads × events) rendering loops entirely.

### **Secondary Goals**

* Easy extensibility (new overlays, heatmaps, ML annotations).

* Easy debugging.

* Fully Storybook-testable.

* Minimal re-render patterns.

---

# **3\. Non-Goals**

* Audio playback.

* Finger/hand AI modeling (covered by another module).

* DAW integration.

* 3D visuals or animation rigs.

---

# **4\. Component Architecture**

## **4.1 Layered Grid Container**

`<GridVisContainer>`  
  `<BaseGridLayer />`  
  `<PadLayer variant="ghost" />`  
  `<VectorLayer />`  
  `<PadLayer variant="solid" />`  
  `<OverlayLayer />`  
`</GridVisContainer>`

### **Layer Responsibilities:**

#### **BaseGridLayer**

* Renders gridlines and empty pads

* Responsible only for static layout

* Fully memoized (never re-renders)

#### **PadLayer**

* Renders solid or ghost pads

* Supports overlays:

  * finger number

  * hand color

  * sound name

  * note name

  * difficulty halo

  * sustain pulse

* Accepts a list of `PadActivation[]`

#### **VectorLayer**

* Draws movement paths (Bezier → onion skinning)

* Draws finger trajectories

* Draws reachability lines or tension guides

* Accepts `VectorPrimitive[]`

* Cached by event-pair hash

#### **OverlayLayer**

* Tooltips

* Context menus

* Badges

* Bank guides

* Hotspots

* Single portal to avoid stacking problems

---

# **5\. Data Model (Declarative)**

## **5.1 Pad Activation Model**

`interface PadActivation {`  
  `id: PadId;`  
  `row: number;`  
  `col: number;`

  `isCurrent?: boolean;`  
  `isNext?: boolean;`  
  `isShared?: boolean;`

  `finger?: FingerId;`  
  `hand?: HandId;`

  `state?: "idle" | "active" | "ghost" | "shared";`

  `label?: string; // note, sample, sound, finger, etc.`  
  `intensity?: number; // velocity or difficulty`  
`}`

---

## **5.2 Vector Model**

`interface VectorPrimitive {`  
  `id: string;`  
  `type: "arrow" | "arc" | "line";`

  `from: { row: number; col: number };`  
  `to:   { row: number; col: number };`

  `color?: string;`  
  `width?: number;`  
  `opacity?: number;`

  `difficulty?: number; // anatomical stretch weighting`  
`}`

Vectors encode onion skin movement and difficulty.

---

## **5.3 Geometry Model**

`interface GridGeometry {`  
  `padSize: number;`  
  `padGap: number;`  
  `origin: "bottom-left" | "top-left";`

  `getPadCenter(row, col): { x: number; y: number };`  
  `width: number;`  
  `height: number;`  
`}`

This centralizes coordinate math.

---

## **5.4 Unified Props**

`interface GridVisProps {`  
  `rows: number;`  
  `cols: number;`  
  `mode: GridMode;`

  `pads: PadActivation[];`  
  `vectors?: VectorPrimitive[];`  
  `overlays?: OverlayAnnotation[];`

  `geometry?: Partial<GridGeometry>;`  
  `theme?: GridTheme;`

  `onPadClick?: (id: PadId) => void;`  
`}`

---

# **6\. Modes**

### **6.1 Snapshot View**

* Solid pads only

* No vectors

* Label overlays allowed

### **6.2 Onion Skin View**

* Solid pads (Event N)

* Ghost pads (Event N+1)

* Shared pads pulse

* Curved Bezier vectors

* Difficulty halo optional

### **6.3 Playback View**

* Highlight pads based on timeline position

* Smooth pulse on each active pad

* Optional velocity glow

### **6.4 Layout Editor**

* Show grid with interactive pads

* Click \= assign sample/note

* Overlays for bank guides

### **6.5 Heatmap Mode**

* Pads colored by difficulty or frequency

---

# **7\. Required Infrastructure**

## **7.1 Selectors / Adapters**

Codex identified that the legacy system mixes grid logic with engine logic.

We must introduce **adapter functions** to translate engine results → grid view models.

`EngineResult → PadActivation[]`  
`EngineResult → VectorPrimitive[]`  
`MIDI Timeline → Playback PadActivation[]`  
`Transition → OnionSkinModel → PadActivation[] + VectorPrimitive[]`

All adapters must be memoized.

---

## **7.2 Rendering Performance Requirements**

* BaseGridLayer never re-renders

* PadLayer only re-renders for state changes

* VectorLayer caches Beziers paths

* Overlays use a React Portal

* Scrolling timeline never re-renders the whole grid

* Rendering must remain above 60 FPS

---

# **8\. UX Requirements**

* Onion-skin ghost pads must not overpower current pads

* Vectors fade from solid → transparent

* Shared pads have a double-halo pulse

* Colors for L/R hand must use defined theme

* Tooltips show note, sound, finger

* Hover on a vector highlights its path

* Ghost pads are non-interactive unless in editor mode

* Pads animate on activation (Pulse / glow)

---

# **9\. Acceptance Criteria**

### **AC1 — Layer Architecture**

The following components exist and operate independently:

* BaseGridLayer

* PadLayer

* VectorLayer

* OverlayLayer

* GridVisContainer

### **AC2 — Unified API**

Grid accepts declarative PadActivation, VectorPrimitive, and overlay models.

### **AC3 — Onion Skin Support**

Both Event N and Event N+1 render correctly:

* solid layer

* ghost layer

* shared pad detection

* vector arrows

### **AC4 — Performance**

Grid never drops below 60 FPS on Event Analysis transitions.

### **AC5 — No Legacy Coupling**

Grid does not depend on:

* GridEditor

* GridPattern

* EngineResult

* direct event scanning

Adapters handle translation externally.

### **AC6 — Storybook Demo**

A Storybook page demonstrates:

* Snapshot

* Onion Skin

* Playback

* Layout Editor

* Heatmap

---

# **10\. Migration Plan Requirements**

Codex identified:

* Monolithic grid must be decomposed

* Per-pad event scanning must be eliminated

* SVG layers must be introduced

* Editing logic must be decoupled

This PRD requires:

1. Add grid-v3 directory

2. Implement the new components in isolation

3. Add data adapters

4. Integrate into Event Analysis first (lowest friction)

5. Replace GridEditor logic later

6. Delete legacy grid code only after parity testing

