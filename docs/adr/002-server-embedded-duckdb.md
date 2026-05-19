# ADR-002: Node.js server with embedded DuckDB and Quack protocol

## Status
Accepted

## Context
The architecture requires a server-side DuckDB instance that the browser DuckDB-WASM can communicate with. Need to decide between embedding DuckDB in the app server vs. running it as a sidecar process.

## Decision
Embed DuckDB directly in the Node.js server process using `@duckdb/node-api` (the "neo" bindings). The server loads the Quack extension and calls `quack_serve()` at startup. Express handles static file serving, workspace API, and Vite dev proxy.

## Consequences
- Single process to manage (no IPC, no process lifecycle)
- Can expose REST endpoints (workspace API) from the same server
- Vite dev proxy forwards Quack traffic — no nginx needed locally
- Full filesystem access for DuckDB queries (internal tool, no sandboxing)
- Server-side DuckDB is the data authority; WASM is a smart client
