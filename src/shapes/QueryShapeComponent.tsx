import { useEditor, useIsEditing } from 'tldraw'
import { useCallback, useRef, useEffect, useState } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { sql, PostgreSQL } from '@codemirror/lang-sql'
import { executeQuery } from '../lib/duckdb-client'
import { spawnResultShape } from '../lib/spawn-result'
import type { QueryShape } from './types'

export function QueryShapeComponent({ shape }: { shape: QueryShape }) {
  const editor = useEditor()
  const isEditing = useIsEditing(shape.id)
  const editorRef = useRef<HTMLDivElement>(null)
  const cmViewRef = useRef<EditorView | null>(null)
  const runQueryRef = useRef<(() => void) | null>(null)
  const [mode, setMode] = useState<'server' | 'local'>(shape.props.mode)

  // Initialize CodeMirror
  useEffect(() => {
    if (!editorRef.current) return
    const view = new EditorView({
      doc: shape.props.sql,
      extensions: [
        basicSetup,
        sql({ dialect: PostgreSQL }),
        EditorView.lineWrapping,
        EditorView.theme({
          '&': { backgroundColor: '#ffffff' },
          '.cm-gutters': { backgroundColor: '#f8f9fa', borderRight: '1px solid #dee2e6' },
          '.cm-activeLineGutter': { backgroundColor: '#e9ecef' },
          '.cm-activeLine': { backgroundColor: '#f1f3f5' },
        }),
        Prec.highest(keymap.of([{
          key: 'Ctrl-Enter',
          mac: 'Cmd-Enter',
          run: () => {
            runQueryRef.current?.()
            return true
          },
        }])),
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

  // Keep ref in sync for Ctrl+Enter handler
  useEffect(() => {
    runQueryRef.current = handleRun
  }, [handleRun])

  const toggleMode = useCallback(() => {
    const newMode = mode === 'server' ? 'local' : 'server'
    setMode(newMode)
    editor.updateShape<QueryShape>({
      id: shape.id,
      type: 'query',
      props: { mode: newMode },
    })
  }, [editor, shape, mode])

  // Stop pointer events from reaching tldraw when in edit mode
  const stopPropagation = useCallback((e: React.PointerEvent) => {
    if (isEditing) e.stopPropagation()
  }, [isEditing])

  return (
    <div
      style={{
        width: shape.props.w,
        height: shape.props.h,
        display: 'flex',
        flexDirection: 'column',
        background: '#ffffff',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid #dee2e6',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        pointerEvents: isEditing ? 'all' : 'none',
      }}
      onPointerDown={stopPropagation}
      onPointerMove={stopPropagation}
      onPointerUp={stopPropagation}
    >
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        background: '#f8f9fa',
        borderBottom: '1px solid #dee2e6',
      }}>
        <button
          onClick={toggleMode}
          style={{
            padding: '2px 8px',
            borderRadius: 4,
            border: '1px solid #ced4da',
            background: mode === 'server' ? '#d0ebff' : '#d3f9d8',
            color: '#212529',
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
            border: '1px solid #ced4da',
            background: '#e7f5ff',
            color: '#212529',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ▶ Run
        </button>
        <span style={{ color: '#868e96', fontSize: 10, marginLeft: 'auto' }}>
          {isEditing ? 'Ctrl+Enter to run' : 'Double-click to edit'}
        </span>
      </div>
      {/* Editor */}
      <div ref={editorRef} style={{ flex: 1, overflow: 'auto' }} />
    </div>
  )
}
