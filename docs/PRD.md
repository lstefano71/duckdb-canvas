# DuckDB Canvas — Product Requirements Document

## Overview

DuckDB Canvas is an internal data-wrangling tool built on a tldraw infinite canvas. It lets the user write SQL queries, execute them against a DuckDB backend (local WASM or remote server via the Quack protocol), view results in virtualized tables, and (in future) chart results with Observable Plot — all as connected visual nodes on a canvas.

## Problem Statement

Data exploration workflows involve writing queries, inspecting results, iterating on SQL, and visualizing outputs. Existing tools (notebooks, CLI, GUIs) are linear and disconnected. A canvas-based approach lets you see multiple queries, results, and charts simultaneously, with explicit visual data-flow connections between them.

## Target User

Single developer (internal tool). No multi-user, no auth, no public deployment.

## MVP Scope

### 1. Query Shape
- Custom tldraw shape containing a CodeMirror 6 editor with DuckDB SQL syntax highlighting
- **Mode toggle**: "Server" (executes via `remote.query(...)` on server-side DuckDB) or "Local" (executes directly in WASM DuckDB)
- **Run button / keyboard shortcut** to execute the query
- On execution, spawns a connected ResultShape (or updates an existing one)

### 2. Result Shape
- Custom tldraw shape displaying query results in a virtualized scrollable table
- Handles 100k+ rows efficiently (only renders visible rows via `@tanstack/react-virtual`)
- Shows column names, types, and row count
- Connected to its parent QueryShape via a tldraw arrow (data-flow indicator)
- Result data stored in WASM DuckDB as a local table for downstream use

### 3. DuckDB Architecture
- **Browser**: DuckDB-WASM with the Quack extension, acting as a smart client
- **Server**: Node.js + Express embedding DuckDB via `@duckdb/node-api`, running `quack_serve()` on port 9494
- **Protocol**: Quack over HTTP (localhost, no TLS needed for internal use)
- WASM attaches remote via `ATTACH 'quack:localhost:9494' AS remote`
- Server-mode queries wrapped as `remote.query('...')`
- Results materialized locally in WASM DuckDB for fast downstream access

### 4. Workspace Persistence
- Server exposes REST API for workspace management
- Workspaces identified by user-chosen slug (e.g., `analytics`, `etl-pipeline`)
- Storage structure:
  ```
  workspaces/
    {slug}/
      canvas.json        ← last explicitly saved version
      canvas.draft.json  ← auto-saved dirty state
  ```
- **Auto-save**: debounced writes to `canvas.draft.json` on every canvas change
- **Explicit save**: user action promotes draft to `canvas.json`
- **Crash recovery**: on load, if draft exists and differs from saved, restore draft
- **Workspace switcher**: list available workspaces, create new, open in new tab
- **Multi-tab**: different browser tabs can open different workspaces (URL-routed)

## Future Scope (Post-MVP)

### Chart Shape
- CodeMirror 6 editor for JavaScript (Observable Plot)
- Auto-injected `data` variable (columnar typed arrays from connected ResultShape)
- Direct eval with try/catch, error displayed in shape
- Auto-resize shape to fit Plot SVG output
- Pause toggle to prevent auto-cascade during query iteration

### Enhancements
- File browser shape/sidebar for server-side file discovery
- DuckDB-powered SQL autocomplete (table names, columns)
- Large result streaming fallback (LZ4-compressed Arrow chunks)
- Arrow zero-copy path from WASM DuckDB to Observable Plot

## Technical Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | React + TypeScript |
| Bundler | Vite |
| Canvas | tldraw v2 |
| Code editor | CodeMirror 6 (`@codemirror/lang-sql`, `@codemirror/lang-javascript`) |
| Table virtualization | `@tanstack/react-virtual` |
| Browser DB | DuckDB-WASM + Quack extension |
| Server runtime | Node.js 22 LTS |
| Server framework | Express (or Hono) |
| Server DB | DuckDB via `@duckdb/node-api` + Quack extension |
| Data format (internal) | Columnar typed arrays (Arrow IPC export) |
| Charting (future) | Observable Plot |

## Project Layout

```
duckdb-canvas/
├── src/                 ← React + tldraw frontend
│   ├── shapes/          ← custom shape components
│   ├── lib/             ← DuckDB-WASM client, data utils
│   └── App.tsx
├── server/              ← Express + DuckDB + Quack
│   └── index.ts
├── docs/                ← PRD, ADRs
│   └── adr/
├── workspaces/          ← persisted workspace data (gitignored)
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Execution Model

1. **Manual trigger**: User presses Run on QueryShape
2. **Cascade**: ResultShape updates automatically; downstream ChartShape re-renders (unless paused)
3. **Spawn-on-action**: ResultShape is created already connected when first running a query
4. **Re-run**: Editing SQL and pressing Run again updates the existing connected ResultShape

## Non-Goals

- Multi-user collaboration
- Authentication / authorization
- Production deployment hardening
- Mobile support
