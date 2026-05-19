# ADR-004: Query execution mode toggle (Server vs Local)

## Status
Accepted

## Context
Users need to run SQL against server-side files (CSV, Parquet via `read_parquet(...)`) which aren't in the remote catalog, and also run local queries in WASM DuckDB. Need to decide how routing works.

## Decision
Each QueryShape has a visible mode toggle: **Server** or **Local**.
- **Server mode**: SQL is wrapped in `remote.query('...')` and executed on the server-side DuckDB
- **Local mode**: SQL runs directly in the WASM DuckDB instance

No magic SQL parsing or automatic routing.

## Rationale
- Transparent — user always knows where their query runs
- No fragile SQL rewriting heuristics
- SQL in the editor stays clean and portable
- Can add "Auto" mode later once heuristics are proven

## Consequences
- Server mode can access any file path on the server filesystem
- Local mode operates on data already materialized in WASM (e.g., previous query results)
- Users must explicitly choose; no surprises
