# Performance-ergonomics-optimization-engine-for-Ableton-Push
Analyzes MIDI, evaluates playability, and generates musician-adaptive pad layouts with a visual remapping workbench

## Features & Views

### Workbench (Layout Editor)
Interactive grid to assign sounds, run the ergonomic optimization solver, and visualize the generated finger assignments.

### Event Analysis
Review the physical difficulty of the pad layout, with detailed transition metrics, hand balance constraint tracking, and ergonomic scores.

### Timeline View
Review the generated layout chronologically, analyzing the sequence of grip transitions over the performance.

### Architecture 
<img width="1408" height="768" alt="image" src="https://github.com/user-attachments/assets/51c6b719-9db4-4126-b5ff-54f4e449e1d4" />

The Performability Engine is an ergonomics-driven optimization system for performing electronic music on the Ableton Push.

It analyzes MIDI performances, evaluates the physical difficulty of pad layouts, and uses a modular cost engine (movement, simultaneity, gesture naturalness, cognitive grouping, and muscle-memory stability) to recommend musician-adaptive remappings.

System Inputs
  Performance object (MIDI → NoteEvent[]) from existing services
  Initial grid mapping (random or default layout)
  Tempo / BPM

System Outputs
  Optimized results include:
  Sound → Pad map
  Hand assignment
  Fingering assignment
  Full cost breakdown (static, transition, drumming costs)
  Charts and metrics for visualization


**Cost Metrics** 
h<img width="1408" height="768" alt="image" src="https://github.com/user-attachments/assets/bead6244-0240-4b52-8057-79b3eb5951fd" />
