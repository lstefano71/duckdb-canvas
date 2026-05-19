# ADR-005: CodeMirror 6 as the embedded code editor

## Status
Accepted

## Context
Need a syntax-highlighted code editor embedded inside tldraw custom shapes. Must coexist with tldraw's keyboard shortcuts and support multiple simultaneous instances on canvas.

## Decision
Use CodeMirror 6 with `@codemirror/lang-sql` (DuckDB dialect) for query shapes and `@codemirror/lang-javascript` for future chart shapes.

## Rationale (over Monaco)
- **Keyboard isolation**: CodeMirror is designed for embedding; clean APIs to control keystroke capture vs. bubble-up. Monaco aggressively grabs shortcuts that conflict with tldraw.
- **Size**: ~150KB gzipped vs. Monaco's ~2MB+
- **Multiple instances**: CodeMirror instances are fully independent and lightweight. Monaco was designed as a singleton.
- **DOM embedding**: Attaches to any `<div>` trivially; Monaco requires explicit dimensions and its own layout engine.

## Consequences
- One editor dependency serves both SQL and JavaScript shapes
- Can add DuckDB-powered autocomplete later via custom completion source
- Sacrifices VS Code-level intellisense (acceptable for single-query panels)
