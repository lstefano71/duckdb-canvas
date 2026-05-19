import { Tldraw, Editor } from 'tldraw'
import 'tldraw/tldraw.css'
import { useCallback, useEffect, useState } from 'react'
import { customShapes } from './shapes'
import { QueryTool } from './shapes/QueryTool'
import { loadWorkspace, autoSaveWorkspace } from './lib/workspace'

const WORKSPACE_SLUG = new URLSearchParams(window.location.search).get('workspace') || 'default'

const customTools = [QueryTool]

export default function App() {
  const [editor, setEditor] = useState<Editor | null>(null)

  const handleMount = useCallback((ed: Editor) => {
    setEditor(ed)
  }, [])

  // Load workspace on mount
  useEffect(() => {
    if (!editor) return
    loadWorkspace(WORKSPACE_SLUG).then((snapshot) => {
      if (snapshot) {
        editor.store.loadStoreSnapshot(snapshot)
      }
    })
  }, [editor])

  // Auto-save on changes
  useEffect(() => {
    if (!editor) return
    const unsub = editor.store.listen(() => {
      autoSaveWorkspace(WORKSPACE_SLUG, editor.store.getStoreSnapshot())
    }, { scope: 'document', source: 'user' })
    return unsub
  }, [editor])

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw
        onMount={handleMount}
        shapeUtils={customShapes}
        tools={customTools}
      />
      {/* Floating toolbar outside tldraw's component tree */}
      {editor && (
        <div style={{
          position: 'fixed',
          top: 12,
          right: 12,
          zIndex: 99999,
          display: 'flex',
          gap: 8,
        }}>
          <button
            onClick={() => editor.setCurrentTool('query')}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              border: 'none',
              background: '#89b4fa',
              color: '#1e1e2e',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
            title="Click on canvas to place a query shape"
          >
            + Query
          </button>
          <button
            onClick={() => {
              const snapshot = editor.store.getStoreSnapshot()
              fetch(`/api/workspaces/${encodeURIComponent(WORKSPACE_SLUG)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(snapshot),
              })
            }}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              border: 'none',
              background: '#a6e3a1',
              color: '#1e1e2e',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
            title="Save workspace"
          >
            💾 Save
          </button>
        </div>
      )}
    </div>
  )
}
