# ADR-003: DuckDB Quack protocol for WASM-to-server communication

## Status
Accepted

## Context
Need a protocol for the browser DuckDB-WASM to execute queries on the server-side DuckDB. Options considered: custom REST API, Arrow Flight SQL, Quack protocol.

## Decision
Use the Quack protocol — DuckDB's native client-server protocol over HTTP. The WASM client attaches the remote via `ATTACH 'quack:localhost:9494' AS remote` and uses `remote.query('...')` for ad-hoc SQL execution on the server.

## Rationale
- Native DuckDB-to-DuckDB communication — no translation layer
- DuckDB-WASM supports Quack natively over HTTP
- Single round-trip per query with chunked streaming for large results
- Uses DuckDB's internal serialization (`application/duckdb`) — lossless for all types
- No separate client SDK needed — the client IS DuckDB

## Consequences
- Depends on Quack extension (currently beta in DuckDB v1.5.2, core_nightly)
- No TLS needed for localhost (internal tool)
- Fallback plan: chunked LZ4-compressed Arrow tables served via REST (like duckdb-kernel)
- Results materialized locally in WASM DuckDB for downstream use
