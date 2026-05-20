# ADR-011: ChartCell design — spawning, data flow, and rendering

## Status
Accepted

## Context
Need a shape type for visualising QueryCell results with Observable Plot. Key tensions:
- Should it be a free-floating shape or spawned from a specific QueryCell?
- How to show the data-flow relationship without repeating the fragility of the old arrow-based connections?
- Should chart re-render be explicit (like SQL execution) or automatic (like a reactive notebook)?

## Decision

### Spawning and placement
- ChartCell is spawned via a 📊 button in the QueryCell's result pane header (only visible when data exists)
- Appears to the right of the source QueryCell, with a 20px gap
- Multiple ChartCells from the same source stack vertically
- tldraw duplicate also creates a ChartCell connected to the same source

### Connection model
- `sourceShapeId` prop holds the reference to the source QueryCell — this is the real data link
- A cosmetic tldraw arrow is auto-created on spawn (source → chart)
- Deleting the arrow has no effect on data flow
- Deleting the source QueryCell orphans the ChartCell ("Source deleted" error state)

### Layout
- Same split-pane pattern as QueryCell: code panel (left) + chart panel (right)
- Default split ratio: 0.3 code / 0.7 chart
- Default dimensions: 800×500
- Code panel hideable (same « / » toggle as QueryCell's query pane)
- Chart constrained to pane dimensions (no auto-resize of shape)
- Same hybrid drag/resize/edit interaction (ADR-010)

### Code execution
- `new Function('data', 'columns', 'width', 'height', 'Plot', 'd3', code)` — user returns a Plot node
- Data injected as columnar typed arrays (ADR-008): `{ colName: TypedArray, ... }`
- `columns` is the array of column names
- `width` and `height` are the chart pane dimensions
- Errors displayed in chart pane (red/monospace, same as QueryCell)
- Extensible: add more libraries to scope later

### Rendering triggers
- Code edits: debounced auto-render (~300ms)
- Upstream data change (`dataVersion` increment): auto-re-render
- Pause toggle (⏸) in chart header: suspends upstream data cascade only (code edits still render)

### Page reload
- Data is ephemeral — chart shows "Data expired — run the source query"
- Once source QueryCell is re-run, ChartCell auto-re-renders (no user action needed on ChartCell)

### Default template
```js
return Plot.plot({
  width,
  height,
  marks: [Plot.dot(data, {x: columns[0], y: columns[1]})]
})
```

## Consequences
- No ▶ button in ChartCell — rendering is always automatic
- Cosmetic arrows can accumulate if user spawns many charts (acceptable: user can delete them)
- Future: serialised results could make charts viewable offline (not implemented now)
- Future: reconnect orphaned ChartCell to a different source (not implemented now)
