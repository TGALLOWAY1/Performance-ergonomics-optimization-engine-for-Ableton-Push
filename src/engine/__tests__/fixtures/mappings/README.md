# Mapping Fixtures

Layout fixtures for testing different pad configurations.

## L01 - Standard Chromatic (null mapping)
- Use `null` GridMapping in tests
- Solver falls back to `GridMapService.noteToGrid(noteNumber, instrumentConfig)`
- This is the production default behavior
- **Do NOT hand-roll a mapping for L01**

## L02 - Rotated/Inverted
- Tests geometry correctness when pads are rearranged
- Voices swapped: notes that were at bottom-left are now at top-right

## L03 - Sparse/Empty Pads
- Only a subset of pads have voices mapped
- Tests unmapped note handling

## L04 - Clustered Mapping
- Voices clustered in one region of the grid
- Tests movement penalties (should be higher than L01)

## L05 - Non-Contiguous Mapping
- Voices scattered non-contiguously across the grid
- Tests lookup correctness and indexing
