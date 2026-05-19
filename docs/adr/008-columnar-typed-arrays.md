# ADR-008: Columnar typed arrays as the data bridge

## Status
Accepted

## Context
Query results (up to 100k+ rows) need to flow from DuckDB-WASM to the virtualized table display and (future) Observable Plot charts. Need to choose a data representation that is memory-efficient and avoids unnecessary copies.

## Decision
Use columnar typed arrays as the canonical in-memory representation for result data:
- DuckDB-WASM exports results via Arrow IPC stream
- Arrow columns are exposed as typed arrays (`Float64Array`, `Int32Array`, etc.) with zero-copy views over the WASM `ArrayBuffer`
- The virtualized table reads from these column arrays
- (Future) Observable Plot consumes the same typed arrays directly via channel API

## Rationale
- Avoids materializing 100k JavaScript objects (saves memory, avoids GC pressure)
- Arrow IPC from DuckDB-WASM is near-zero-copy (views over existing memory)
- Observable Plot's most efficient path is typed arrays for quantitative channels
- ~50ms vs ~500ms+ for 100k rows compared to row-object materialization

## Consequences
- Need `apache-arrow` JS library to decode IPC streams
- String columns remain as regular arrays (no typed array for strings)
- Table virtualization must work with columnar data (index-based access)
- Future Plot integration shares the same memory — no additional copies
