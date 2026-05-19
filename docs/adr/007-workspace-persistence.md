# ADR-007: Workspace persistence with draft auto-save

## Status
Accepted

## Context
Canvas state needs to survive browser crashes and restarts while giving the user explicit control over "saved" versions. Multiple workspaces should be supported in parallel browser tabs.

## Decision
Server-side workspace persistence with VS Code "hot exit" semantics:

```
workspaces/{slug}/
  canvas.json        ← explicitly saved version
  canvas.draft.json  ← auto-saved dirty state
```

- **Auto-save**: debounced writes to `canvas.draft.json` on every canvas change
- **Explicit save**: user action promotes draft → `canvas.json`
- **Crash recovery**: on load, restore draft if it exists and differs from saved
- **Multi-tab**: URL-routed workspaces (`/workspace/{slug}`), each tab independent
- **Workspace switcher**: list/create/open workspaces

Workspaces identified by user-chosen slug (folder name = slug).

## Consequences
- No data loss on crash or accidental tab close
- User has full control over what constitutes a "saved" state
- Simple file-based storage — debuggable, no database needed
- `workspaces/` directory gitignored
