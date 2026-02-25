# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Client-side React/TypeScript SPA (Vite) for analyzing ergonomic difficulty of playing musical patterns on an Ableton Push 3. No backend, no database, no external services. All state is in browser `localStorage`.

### Running the app

- `npm run dev` starts the Vite dev server on port 5173.
- The app is a single-page application with routes: `/` (Dashboard), `/workbench`, `/timeline`, `/event-analysis`, `/cost-debug`.

### Build

- `npm run build` runs `tsc && vite build`. Pre-existing TS errors (unused variables, missing type exports) will cause `tsc` to fail. Vite dev server works fine since it uses esbuild for transpilation without full type checking.

### Linting

- No ESLint is configured in this project. No lint script exists in `package.json`.

### Testing

- Test files exist in `src/engine/__tests__/` and `src/workbench/__tests__/` but no test runner (vitest/jest) is installed as a dependency and no `test` script is defined in `package.json`. Test files import from `vitest`.

### Test MIDI data

- Sample MIDI files live in `public/TEST DATA/` and `test-data/`. Use these for manual testing of MIDI import and pad grid visualization.

### Key domain terminology

See `docs/TERMINOLOGY.md` and `.cursorrules` for the mandatory glossary (Voice, Cell, Pad, Assignment, etc.).
