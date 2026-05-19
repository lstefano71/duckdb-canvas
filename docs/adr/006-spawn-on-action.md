# ADR-006: Spawn-on-action shape creation with tldraw arrows

## Status
Accepted

## Context
Need to decide how connected shapes (Query → Result → Chart) are created and linked on the canvas.

## Decision
Shapes are **spawned on action** — not created independently then connected:
1. User creates a QueryShape and writes SQL
2. Pressing Run spawns a ResultShape already connected via a tldraw arrow
3. (Future) Interacting with ResultShape spawns a ChartShape already connected

The tldraw arrow visually represents data flow. The actual data-flow link is stored in shape metadata (parent/child relationship).

## Rationale
- Most "tldraw-native" UX — arrows are familiar
- tldraw's binding system handles move/resize/delete propagation for free
- No manual wiring step — reduces friction
- Arrow graph can be queried for execution order

## Consequences
- Shapes form an implicit DAG
- Re-running a query updates the existing connected ResultShape (no new spawn)
- Deleting a QueryShape could optionally delete its downstream shapes (TBD)
- Manual trigger on query, automatic cascade to result; cascade to chart (future) can be paused
