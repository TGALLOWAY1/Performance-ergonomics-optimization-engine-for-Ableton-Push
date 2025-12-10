# Biomechanical Performability Engine Documentation

## Overview

The biomechanical performability engine is a sophisticated optimization system that assigns fingers to musical notes based on ergonomic constraints and movement costs. It models the human hand as a biomechanical system with physical limits, fatigue accumulation, and natural movement patterns.

---

## Engine Entry Points

### Primary Entry Point: `BiomechanicalSolver.solve()`

The main entry point is the `BiomechanicalSolver` class in `src/engine/core.ts`. This facade class delegates to pluggable solver strategies (Beam Search, Genetic Algorithm, Simulated Annealing) while maintaining a consistent API.

**Key Methods:**
- `solve(performance, manualAssignments?)` - Synchronous solving
- `solveAsync(performance, manualAssignments?)` - Asynchronous solving (preferred)

**Input:**
- `Performance` - Array of `NoteEvent` objects with `noteNumber` (MIDI pitch) and `startTime` (seconds)
- `EngineConfiguration` - Beam width, stiffness (attractor force), and resting pose definitions
- Optional `manualAssignments` - Force specific finger assignments for debugging

**Output:**
- `EngineResult` - Complete analysis with score, debug events, finger usage stats, and fatigue maps

### Solver Strategy Pattern

The engine uses the Strategy Pattern to support multiple optimization algorithms:

1. **Beam Search** (default) - Maintains K best candidates at each step, processes events in groups (handles chords)
2. **Genetic Algorithm** - Population-based evolutionary search
3. **Simulated Annealing** - Probabilistic hill-climbing with temperature decay

All solvers implement the `SolverStrategy` interface and produce identical `EngineResult` outputs.

---

## Per-Event Assignment Flow

### Step 1: Voice → Pad Mapping

Each `NoteEvent` contains a `noteNumber` (MIDI pitch, 0-127). The engine maps this to a physical pad position using:

1. **Custom GridMapping** (if available) - User-defined layout where specific MIDI notes map to specific pads
2. **Algorithmic Mapping** (fallback) - Uses `GridMapService.noteToGrid()` with `InstrumentConfig.bottomLeftNote` to calculate row/col position

**Key Function:** `GridMapService.noteToGrid(noteNumber, config)`
- Returns `[row, col]` tuple (0-7 for 8x8 grid)
- Returns `null` if note is outside the 8x8 window

### Step 2: Event Grouping (Chord Detection)

Events are grouped by timestamp (within 1ms tolerance) into `PerformanceGroup` objects. This allows the engine to:
- Handle polyphonic chords as single units
- Generate multi-finger grips for simultaneous notes
- Calculate time deltas between groups (not individual events)

**Key Function:** `groupEventsByTimestamp(events)` in `BeamSolver.ts`

### Step 3: Valid Grip Generation

For each group of simultaneous notes, the engine generates all biomechanically valid hand grips using constraint logic programming.

**Key Function:** `generateValidGripsWithTier(activePads, hand)` in `feasibility.ts`

**Tiered Approach (Always Returns At Least One Grip):**

1. **Tier 1 (Strict):** 
   - Maximum finger span: 5.5 grid units
   - Strict topological ordering (no finger crossovers)
   - Thumb delta tolerance: 1.0

2. **Tier 2 (Relaxed):**
   - Extended span: 7.5 grid units
   - Allows slight topology overlap
   - Thumb delta tolerance: 2.0

3. **Tier 3 (Fallback):**
   - Ignores constraints, assigns by proximity
   - Applies massive penalty (1000 cost units) to discourage use

**Constraints Checked:**
- **Span Constraint:** Euclidean distance between any two active fingers ≤ max span
- **Topological Constraint:** Fingers maintain natural ordering (thumb-index-middle-ring-pinky)
- **Collision Check:** No two fingers can occupy the same pad

### Step 4: Hand Selection & Cost Evaluation

For each valid grip, the engine calculates the total biomechanical cost:

**Cost Components:**
1. **Transition Cost** - Movement from previous hand pose to new grip
2. **Attractor Cost** - Distance from resting/home position
3. **Grip Stretch Cost** - Finger spread difficulty
4. **Fallback Penalty** - Applied if using Tier 3 fallback grip

**Key Functions:**
- `calculateTransitionCost(prevPose, currPose, timeDelta)` - Fitts's Law-based movement cost
- `calculateAttractorCost(currentPose, restingPose, stiffness)` - Spring-like force pulling to home
- `calculateGripStretchCost(pose, handSide)` - Penalty for excessive finger spread

### Step 5: Beam Search Expansion

The Beam Search algorithm:
1. Maintains a beam of K best candidates (default: 20)
2. Expands each candidate by trying both hands with all valid grips
3. Calculates total cost (accumulated from start + step cost)
4. Prunes to top K candidates after each group
5. Backtracks from best final node to build assignment path

**Key Function:** `expandNodeForGroup(node, group, prevTimestamp, config)` in `BeamSolver.ts`

### Step 6: Assignment Creation

For each note in the group, creates a `NoteAssignment` record:
- `eventIndex` - Original event index
- `hand` - 'left' or 'right'
- `finger` - Finger type (thumb, index, middle, ring, pinky)
- `grip` - Complete `HandPose` for visualization
- `cost` - Per-note cost (total step cost divided by note count)
- `row`, `col` - Pad coordinates

---

## Cost Components

The engine uses a multi-component cost model that penalizes various ergonomic difficulties:

### 1. Movement Cost

**Function:** `calculateMovementCost(from, to, finger, constants)`

**Parameters:**
- `from` - Starting `GridPosition` (or `null` if finger not placed)
- `to` - Target `GridPosition`
- `finger` - `FingerType` (thumb, index, middle, ring, pinky)
- `constants` - `EngineConstants` with finger strength weights

**What It Penalizes:**
- Physical distance traveled by the finger
- Finger strength differences (pinky = 2.5x cost, thumb = 2.0x, index = 1.0x baseline)
- Activation cost (5.0) if finger is not currently placed

**Formula:**
```
cost = distance × fingerWeight
if (from === null) cost = activationCost
```

**Neutral Bias (Optional):**
- Small penalty (10% weight) for moving away from finger's neutral pad position
- Encourages staying near natural resting position

### 2. Stretch Penalty

**Function:** `calculateStretchPenalty(handState, newPos, finger, handSide, constants)`

**Parameters:**
- `handState` - Current `HandState` with all finger positions
- `newPos` - New position being considered
- `finger` - Finger type being assigned
- `handSide` - 'left' or 'right'
- `constants` - Engine constants with `idealReach` and `maxSpan`

**What It Penalizes:**
- Hand span expansion beyond comfortable zone
- Uses neutral finger spacing to define "comfortable spread" (typically 2.0-2.5 grid units)
- Non-linear penalty: exponential increase as span exceeds comfortable zone

**Formula:**
```
if (newSpan <= comfortableSpan) return 0
excessSpan = newSpan - comfortableSpan
normalizedExcess = excessSpan / maxExcess
penalty = (normalizedExcess²) × 10
```

### 3. Drift Penalty

**Function:** `calculateDriftPenalty(handState, handSide, constants, neutralHandCenters)`

**Parameters:**
- `handState` - Current `HandState`
- `handSide` - 'left' or 'right'
- `constants` - Engine constants
- `neutralHandCenters` - Optional neutral hand centers (from `handPose.ts`)

**What It Penalizes:**
- Distance of hand's center of gravity from neutral/home position
- Encourages hands to stay near their natural resting area
- Linear penalty: increases proportionally with distance

**Formula:**
```
cog = centerOfGravity(handState)
distance = euclideanDistance(cog, neutralCenter)
penalty = distance × driftMultiplier (default: 0.5)
```

### 4. Bounce Penalty (Stickiness Heuristic)

**Function:** `getFingerBouncePenalty(noteNumber, assignedFinger, currentTime, recencyWindow)`

**Parameters:**
- `noteNumber` - MIDI note number
- `assignedFinger` - Finger being assigned
- `currentTime` - Current timestamp
- `recencyWindow` - Time window for history (default: 5.0 seconds)

**What It Penalizes:**
- Switching fingers for the same note within a short time window
- Encourages "stickiness" - using the same finger for repeated notes
- Recency-weighted: more recent switches get higher penalties

**Formula:**
```
if (same finger as before) return 0
if (timeSinceLastPlay > recencyWindow) return 0
recencyFactor = 1.0 - (timeSinceLastPlay / recencyWindow)
penalty = basePenalty (2.0) × recencyFactor
```

### 5. Fatigue Cost

**Function:** (Calculated during hand state updates, not a separate function)

**What It Penalizes:**
- Accumulated fatigue from repeated finger use
- Each finger movement adds fatigue (rate: 0.1 per use)
- Fatigue decays over time (rate: 0.05 per second)
- Maximum fatigue: 5.0

**Update Rules:**
```
fatigue = min(MAX_FATIGUE, currentFatigue + FATIGUE_ACCUMULATION_RATE)
fatigue = max(0, currentFatigue - FATIGUE_DECAY_RATE × timeDelta)
```

### 6. Crossover Penalty

**Function:** `calculateCrossoverCost(handState, newPos, finger, handSide, constants)`

**Parameters:**
- `handState` - Current hand state
- `newPos` - New position
- `finger` - Finger type
- `handSide` - 'left' or 'right'
- `constants` - Engine constants with `crossoverPenaltyWeight` (default: 20.0)

**What It Penalizes:**
- Geometric finger crossovers (e.g., index crossing over pinky)
- Thumb crossing above middle finger
- Finger sequence violations (fingers out of natural order)

**Rules:**
- Right hand: thumb should be left/bottom of pinky
- Left hand: thumb should be right/bottom of pinky
- Index should not cross over pinky
- Thumb should not cross above middle finger
- Finger sequence must maintain natural ordering

**Formula:**
```
penalty = crossoverPenaltyWeight × violationCount
```

### 7. Transition Cost (Beam Search Model)

**Function:** `calculateTransitionCost(prev, curr, timeDelta)`

**Parameters:**
- `prev` - Previous `HandPose` (centroid + finger positions)
- `curr` - Current `HandPose`
- `timeDelta` - Time available for transition (seconds)

**What It Penalizes:**
- Hand movement speed (Fitts's Law principle)
- Fast movements are more difficult and error-prone
- Movements exceeding physiological limits (12 grid units/second) are impossible

**Formula:**
```
distance = euclideanDistance(prev.centroid, curr.centroid)
speed = distance / timeDelta
if (speed > MAX_HAND_SPEED) return Infinity
cost = distance + (speed × SPEED_COST_WEIGHT)
```

### 8. Attractor Cost (Beam Search Model)

**Function:** `calculateAttractorCost(current, resting, stiffness)`

**Parameters:**
- `current` - Current `HandPose`
- `resting` - Resting/home `HandPose`
- `stiffness` - Spring stiffness coefficient (0-1, default: 0.3)

**What It Penalizes:**
- Distance from resting/home position
- Implements spring-like force: hands naturally want to return to neutral position
- Higher stiffness = stronger pull back to home

**Formula:**
```
distance = euclideanDistance(current.centroid, resting.centroid)
cost = distance × stiffness
```

### 9. Grip Stretch Cost (Beam Search Model)

**Function:** `calculateGripStretchCost(pose, handSide, idealSpan, maxSpan, neutralHandCenters)`

**Parameters:**
- `pose` - Current `HandPose` with finger positions
- `handSide` - 'left' or 'right'
- `idealSpan` - Comfortable span (default: 2.0)
- `maxSpan` - Maximum span (default: 5.5)
- `neutralHandCenters` - Optional neutral pad positions

**What It Penalizes:**
- Maximum finger spread in the grip
- Compares to comfortable spread based on neutral finger spacing
- Non-linear penalty for excessive spread

**Formula:**
```
maxDistance = max(euclideanDistance between any two fingers)
if (maxDistance <= comfortableSpan) return 0
excessSpan = maxDistance - comfortableSpan
normalizedExcess = excessSpan / maxExcess
penalty = (normalizedExcess²) × 10
```

---

## Hand State & Fatigue Model

### Hand State Structure

The engine maintains `HandState` objects for each hand:

```typescript
interface HandState {
  fingers: Record<FingerType, FingerState>;
  centerOfGravity: GridPosition | null;
  spanWidth: number;
}

interface FingerState {
  currentGridPos: GridPosition | null;
  fatigueLevel: number;
}
```

### Hand Pose (Beam Search Model)

The Beam Search solver uses `HandPose` objects for more sophisticated tracking:

```typescript
interface HandPose {
  centroid: FingerCoordinate;  // Center of gravity (continuous coordinates)
  fingers: Partial<Record<FingerType, FingerCoordinate>>;
}
```

### Hand State Updates

**After Each Assignment:**
1. Update finger position: `finger.currentGridPos = newPosition`
2. Accumulate fatigue: `finger.fatigueLevel += FATIGUE_ACCUMULATION_RATE`
3. Recalculate center of gravity: average of all placed finger positions
4. Recalculate span width: distance between thumb and pinky

**Between Events (Time-Based Decay):**
1. Calculate time delta: `timeDelta = currentTime - previousTime`
2. Decay fatigue: `fatigueLevel = max(0, fatigueLevel - FATIGUE_DECAY_RATE × timeDelta)`

**Key Functions:**
- `decayFatigue(currentFatigue, timeDelta)` in `ergonomics.ts`
- `accumulateFatigue(currentFatigue)` in `ergonomics.ts`

### Neutral Hand Pose System

The engine defines a "neutral" or "resting" hand pose based on natural Push 3 positioning:

**Default Neutral Pose** (from `handPose.ts`):
- **Left Hand:**
  - L1 (Thumb): D#-2
  - L2 (Index): G-1
  - L3 (Middle): D0
  - L4 (Ring): C#0
  - L5 (Pinky): C0

- **Right Hand:**
  - R1 (Thumb): E-2
  - R2 (Index): G#-1
  - R3 (Middle): F0
  - R4 (Ring): F#0
  - R5 (Pinky): G0

**Resolution Process:**
1. Neutral pose defined in MIDI note space
2. `resolveNeutralPadPositions(layout, instrumentConfig)` maps to actual pad positions
3. `computeNeutralHandCenters(neutralPads)` calculates centroid for each hand
4. Used for drift penalty and attractor cost calculations

**Key Functions:**
- `getNeutralHandCenters(layout, instrumentConfig)` in `handPose.ts`
- `resolveNeutralPadPositions(layout, instrumentConfig)` in `handPose.ts`

---

## Outputs and Metrics

### EngineResult Structure

The engine returns a comprehensive `EngineResult` object:

```typescript
interface EngineResult {
  score: number;                    // Overall performability score (0-100)
  unplayableCount: number;          // Number of events that couldn't be assigned
  hardCount: number;                 // Number of "Hard" difficulty events
  debugEvents: EngineDebugEvent[];  // Per-event analysis
  fingerUsageStats: FingerUsageStats; // Usage count per finger
  fatigueMap: FatigueMap;            // Fatigue level per finger
  averageDrift: number;              // Average distance from home positions
  averageMetrics: CostBreakdown;    // Average cost components
}
```

### EngineDebugEvent Structure

Each event in the performance gets a detailed debug record:

```typescript
interface EngineDebugEvent {
  noteNumber: number;               // MIDI note number
  startTime: number;                 // Timestamp in seconds
  assignedHand: 'left' | 'right' | 'Unplayable';
  finger: FingerType | null;        // Assigned finger (or null if unplayable)
  cost: number;                     // Total cost for this event
  costBreakdown: CostBreakdown;     // Component-wise cost breakdown
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Unplayable';
  row?: number;                     // Pad row (0-7)
  col?: number;                     // Pad column (0-7)
  eventIndex?: number;              // Original event index
  padId?: string;                   // Pad identifier "row,col"
}
```

### CostBreakdown Structure

Detailed cost component breakdown:

```typescript
interface CostBreakdown {
  movement: number;    // Movement cost
  stretch: number;     // Stretch penalty
  drift: number;       // Drift penalty
  bounce: number;      // Finger bounce penalty
  fatigue: number;     // Fatigue cost
  crossover: number;   // Crossover penalty
  total: number;       // Sum of all components
}
```

### Score Calculation

**Formula:**
```
score = 100 - (5 × hardCount) - (20 × unplayableCount)
score = max(0, score)  // Clamp to 0-100
```

**Interpretation:**
- 100 = Perfect (all events Easy)
- 80-99 = Good (some Medium events)
- 60-79 = Moderate (some Hard events)
- 0-59 = Poor (many Hard or Unplayable events)

### Finger Usage Statistics

**Format:** `FingerUsageStats` is a record mapping finger keys to usage counts:
- Keys: `"L-Thumb"`, `"L-Index"`, `"L-Middle"`, `"L-Ring"`, `"L-Pinky"`, `"R-Thumb"`, etc.
- Values: Number of times that finger was used

**Usage:** UI can visualize finger usage distribution to identify overuse patterns.

### Fatigue Map

**Format:** `FatigueMap` is a record mapping finger keys to fatigue levels:
- Keys: Same as `FingerUsageStats`
- Values: Fatigue level (0.0 = no fatigue, 5.0 = maximum fatigue)

**Usage:** UI can create heat maps showing which fingers are most fatigued.

### Average Metrics

**Format:** `CostBreakdown` with average values across all playable events:
- Each component is the mean cost for that component type
- Used for summary statistics and comparison between different layouts

### Difficulty Classification

**Function:** `getDifficulty(cost)` in `BeamSolver.ts`

**Thresholds:**
- `cost === Infinity` or `cost > 100` → `'Unplayable'`
- `cost > 10` → `'Hard'`
- `cost > 3` → `'Medium'`
- `cost ≤ 3` → `'Easy'`

### Extended Metrics (Event Analysis)

The `eventMetrics.ts` module extends `EngineDebugEvent` into `AnalyzedEvent` for visualization:

**Additional Metrics:**
- `polyphony` - Number of simultaneous notes
- `spreadX`, `spreadY` - Spatial spread of chord
- `anatomicalStretchScore` - Normalized stretch difficulty (0-1)
- `compositeDifficultyScore` - Combined difficulty for heatmaps (0-1)

**Key Functions:**
- `analyzeEvents(engineResult)` - Groups events into moments and computes metrics
- `computeEventAnatomicalStretchScore(event)` - Calculates stretch score
- `computeCompositeDifficultyScore(event, stretchScore)` - Combines factors

---

## Summary

The biomechanical performability engine transforms a sequence of MIDI note events into an optimized finger assignment plan. It models human hand biomechanics, including physical constraints, movement costs, fatigue accumulation, and natural movement patterns. The engine uses sophisticated optimization algorithms (primarily Beam Search) to find near-optimal solutions that minimize ergonomic difficulty while respecting hard physical constraints.

The output provides comprehensive metrics for visualization, debugging, and comparison, enabling musicians and developers to understand the performability characteristics of different musical patterns and grid layouts.

