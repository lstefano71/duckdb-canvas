import { Tldraw, Editor } from 'tldraw'
import 'tldraw/tldraw.css'
import { useCallback, useEffect, useState } from 'react'
import { customShapes } from './shapes'
import { QueryTool } from './shapes/QueryTool'
import { CanvasToolbar } from './components/CanvasToolbar'
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
        components={{
          InFrontOfTheCanvas: CanvasToolbar,
        }}
      />
    </div>
  )
}
