# ADR-010: Hybrid drag/resize/edit interaction for QueryCell

## Status
Accepted

## Context
The QueryCell needs to behave like a canvas object and like an embedded editor at the same time:

- the shape must be draggable and resizable with native tldraw handles
- the SQL editor and result table must remain directly interactive
- the shape should feel "ready" as soon as it is placed on the canvas

Using tldraw edit mode for the whole shape made move/resize unreliable. Blocking pointer events everywhere made the content usable but prevented moving the shape. The usable state appeared when pointer handling was split by region.

## Decision
Use pointer-event partitioning instead of tldraw edit mode:

- the outer QueryCell stays in normal tldraw selection mode
- the query header and result header remain drag-friendly
- the editor/table regions stop propagation so they can receive typing, scrolling, and clicks
- header buttons stop propagation individually
- clicking content also selects the shape, so the handles appear immediately

## Result
This yields the "hybrid" behavior:

- drag from either header
- resize with native tldraw handles
- edit and scroll content without extra mode switches

## Notes
This pattern is intentionally simple and uses tldraw as-is. If a future tldraw upgrade changes pointer behavior, the first thing to preserve is the split between draggable headers and interactive content.
