import { useEditor } from 'tldraw'
import { useCallback, useRef, useEffect, useState } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { sql, PostgreSQL } from '@codemirror/lang-sql'
import { executeQuery } from '../lib/duckdb-client'
import { spawnResultShape } from '../lib/spawn-result'
import type { QueryShape } from './QueryShape'

export function QueryShapeComponent({ shape }: { shape: QueryShape }) {
  const editor = useEditor()
  const editorRef = useRef<HTMLDivElement>(null)
  const cmViewRef = useRef<EditorView | null>(null)
  const [mode, setMode] = useState<'server' | 'local'>(shape.props.mode)

  // Initialize CodeMirror
  useEffect(() => {
    if (!editorRef.current) return
    const view = new EditorView({
      doc: shape.props.sql,
      extensions: [
        basicSetup,
        sql({ dialect: PostgreSQL }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newSql = update.state.doc.toString()
            editor.updateShape<QueryShape>({
              id: shape.id,
              type: 'query',
              props: { sql: newSql },
            })
          }
        }),
      ],
      parent: editorRef.current,
    })
    cmViewRef.current = view
    return () => view.destroy()
  }, [])

  const handleRun = useCallback(async () => {
    const currentSql = cmViewRef.current?.state.doc.toString() || shape.props.sql
    try {
      const result = await executeQuery(currentSql, mode)
      spawnResultShape(editor, shape, result)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      spawnResultShape(editor, shape, { error: message, columns: [], data: [], rowCount: 0 })
    }
  }, [editor, shape, mode])

  const toggleMode = useCallback(() => {
    const newMode = mode === 'server' ? 'local' : 'server'
    setMode(newMode)
    editor.updateShape<QueryShape>({
      id: shape.id,
      type: 'query',
      props: { mode: newMode },
    })
  }, [editor, shape, mode])

  // Stop pointer events from reaching tldraw when interacting with editor
  const stopPropagation = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
  }, [])

  return (
    <div
      style={{
        width: shape.props.w,
        height: shape.props.h,
        display: 'flex',
        flexDirection: 'column',
        background: '#1e1e2e',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid #45475a',
      }}
      onPointerDown={stopPropagation}
      onPointerMove={stopPropagation}
    >
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        background: '#313244',
        borderBottom: '1px solid #45475a',
      }}>
        <button
          onClick={toggleMode}
          style={{
            padding: '2px 8px',
            borderRadius: 4,
            border: 'none',
            background: mode === 'server' ? '#89b4fa' : '#a6e3a1',
            color: '#1e1e2e',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {mode === 'server' ? '🖥 Server' : '🌐 Local'}
        </button>
        <button
          onClick={handleRun}
          style={{
            padding: '2px 10px',
            borderRadius: 4,
            border: 'none',
            background: '#f38ba8',
            color: '#1e1e2e',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ▶ Run
        </button>
        <span style={{ color: '#6c7086', fontSize: 10, marginLeft: 'auto' }}>Ctrl+Enter</span>
      </div>
      {/* Editor */}
      <div ref={editorRef} style={{ flex: 1, overflow: 'auto' }} />
    </div>
  )
}
