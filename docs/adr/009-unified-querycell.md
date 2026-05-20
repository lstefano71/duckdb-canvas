# ADR-009: Unified QueryCell shape (replaces spawn-on-action)

## Status
Accepted (supersedes ADR-006)

## Context
The original design (ADR-006) used separate QueryShape and ResultShape connected by tldraw arrows. In practice this was awkward:
- Two shapes to manage for one logical unit of work
- Arrows added visual clutter without adding information
- Double-click-to-edit the result shape was confusing (users expected scrolling to just work)
- The result shape could be accidentally disconnected or orphaned

Observable Canvas (built on tldraw) demonstrates that a single-click-to-edit shape with resize handles is achievable and is the superior UX for "notebook cell" patterns.

## Decision
Replace QueryShape + ResultShape + arrow with a single **QueryCell** shape type:

- Two internal panels: query editor (left) + result datatable (right)
- Result pane is **always visible** (empty until first run)
- Query pane is **toggleable** via a collapse button
- A **draggable divider** separates the panels; position stored as `splitRatio` (0.0–1.0, default 0.4)
- Shape `w` changes when query panel is hidden/shown
- Single click enters edit mode (both panels interactive + resize handles stay visible)
- Proportional resize: splitRatio preserved when shape is resized via handles

### Controls placement
- Query visible: toolbar has mode toggle, Run button, collapse button
- Query hidden: result header has expand-query button, refresh button, row/column count

### Future shapes
- **ChartCell** is a separate shape type referencing a QueryCell's `viewName`
- No arrows between them (ChartCell holds a `sourceShapeId`)

## Consequences
- `ResultShape`, `ResultShapeComponent`, `spawn-result.ts` are deleted
- The arrow binding logic is removed
- `resultShapeId` prop removed from shape
- One shape type to manage, simpler undo/redo, simpler persistence
- Ephemeral DuckDB views are not cleaned up on shape delete (acceptable: lost on reload anyway; GC deferred to future work)
- ADR-006's "implicit DAG via arrows" pattern no longer applies; data-flow is internal to cells or via explicit `sourceShapeId` references
