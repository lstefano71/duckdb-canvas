import { useEditor } from 'tldraw'
import { useCallback, useRef, useEffect, useState } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { sql, PostgreSQL } from '@codemirror/lang-sql'
import { Coordinator, wasmConnector } from '@uwdata/mosaic-core'
import { datatable } from '../vendor/quak'
import { ensureWasmReady, executeAndMaterialize } from '../lib/duckdb-client'
import type { QueryCellShape } from './types'

export function QueryCellComponent({ shape }: { shape: QueryCellShape }) {
  const { queryVisible, splitRatio, w, h } = shape.props

  const dragBarHeight = 20
  // Panel widths
  const queryWidth = queryVisible ? Math.round(w * splitRatio) : 0
  const resultWidth = queryVisible ? w - queryWidth : w
  const contentHeight = h - dragBarHeight

  return (
    <div
      style={{
        width: w,
        height: h,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid #dee2e6',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        background: '#ffffff',
        pointerEvents: 'all',
      }}
    >
      {/* Drag handle — does NOT stop propagation so tldraw can move */}
      <div
        style={{
          height: dragBarHeight,
          flexShrink: 0,
          background: '#f1f3f5',
          borderBottom: '1px solid #dee2e6',
          cursor: 'grab',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
        }}
      >
        <span style={{ color: '#adb5bd', fontSize: 10, letterSpacing: 2 }}>⋯⋯⋯</span>
      </div>
      {/* Content row */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Query Panel */}
        {queryVisible && (
          <QueryPanel
            shape={shape}
            width={queryWidth}
            height={contentHeight}
          />
        )}
        {/* Draggable Divider */}
        {queryVisible && (
          <DividerHandle shape={shape} />
        )}
        {/* Result Panel */}
        <ResultPanel
          shape={shape}
          width={resultWidth}
          height={contentHeight}
          showExpandButton={!queryVisible}
        />
      </div>
    </div>
  )
}

// --- Query Panel ---
function QueryPanel({ shape, width, height }: {
  shape: QueryCellShape
  width: number
  height: number
}) {
  const editor = useEditor()
  const editorRef = useRef<HTMLDivElement>(null)
  const cmViewRef = useRef<EditorView | null>(null)
  const runQueryRef = useRef<(() => void) | null>(null)
  const [mode, setMode] = useState<'server' | 'local'>(shape.props.mode)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!editorRef.current) return
    const view = new EditorView({
      doc: shape.props.sql,
      extensions: [
        basicSetup,
        sql({ dialect: PostgreSQL }),
        EditorView.lineWrapping,
        EditorView.theme({
          '&': { backgroundColor: '#ffffff', height: '100%' },
          '.cm-scroller': { overflow: 'auto' },
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
            editor.updateShape<QueryCellShape>({
              id: shape.id,
              type: 'querycell',
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
    if (running) return
    const currentSql = cmViewRef.current?.state.doc.toString() || shape.props.sql
    editor.updateShape<QueryCellShape>({
      id: shape.id,
      type: 'querycell',
      props: { sql: currentSql },
    })
    setRunning(true)
    try {
      const { viewName, rowCount, columns } = await executeAndMaterialize(
        currentSql, shape.props.mode, shape.props.viewName || undefined
      )
      editor.updateShape<QueryCellShape>({
        id: shape.id,
        type: 'querycell',
        props: {
          viewName,
          rowCount,
          columns,
          dataVersion: shape.props.dataVersion + 1,
          error: null,
        },
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      editor.updateShape<QueryCellShape>({
        id: shape.id,
        type: 'querycell',
        props: { error: message },
      })
    } finally {
      setRunning(false)
    }
  }, [editor, shape.id, shape.props.mode, shape.props.viewName, shape.props.dataVersion, running])

  useEffect(() => {
    runQueryRef.current = handleRun
  }, [handleRun])

  const toggleMode = useCallback(() => {
    const newMode = mode === 'server' ? 'local' : 'server'
    setMode(newMode)
    editor.updateShape<QueryCellShape>({
      id: shape.id,
      type: 'querycell',
      props: { mode: newMode },
    })
  }, [editor, shape.id, mode])

  const hideQuery = useCallback(() => {
    editor.updateShape<QueryCellShape>({
      id: shape.id,
      type: 'querycell',
      props: { queryVisible: false },
    })
  }, [editor, shape.id])

  return (
    <div
      style={{ width, height, display: 'flex', flexDirection: 'column', flexShrink: 0 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        background: '#f8f9fa',
        borderBottom: '1px solid #dee2e6',
        flexShrink: 0,
      }}>
        <button onClick={toggleMode} style={toolbarBtnStyle(mode === 'server' ? '#d0ebff' : '#d3f9d8')}>
          {mode === 'server' ? '🖥' : '🌐'}
        </button>
        <button onClick={handleRun} disabled={running} style={toolbarBtnStyle(running ? '#fff3bf' : '#e7f5ff')}>
          {running ? '⏳' : '▶'}
        </button>
        <span style={{ flex: 1 }} />
        <button onClick={hideQuery} style={toolbarBtnStyle('#f1f3f5')} title="Hide query">
          «
        </button>
      </div>
      {/* CodeMirror */}
      <div ref={editorRef} style={{ flex: 1, overflow: 'hidden' }} />
    </div>
  )
}

// --- Result Panel ---
function ResultPanel({ shape, width, height, showExpandButton }: {
  shape: QueryCellShape
  width: number
  height: number
  showExpandButton: boolean
}) {
  const editor = useEditor()
  const containerRef = useRef<HTMLDivElement>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const dtRef = useRef<any>(null)
  const coordinatorRef = useRef<Coordinator | null>(null)

  const showQuery = useCallback(() => {
    editor.updateShape<QueryCellShape>({
      id: shape.id,
      type: 'querycell',
      props: { queryVisible: true },
    })
  }, [editor, shape.id])

  const handleRefresh = useCallback(async () => {
    const currentSql = shape.props.sql
    try {
      const { viewName, rowCount, columns } = await executeAndMaterialize(
        currentSql, shape.props.mode, shape.props.viewName || undefined
      )
      editor.updateShape<QueryCellShape>({
        id: shape.id,
        type: 'querycell',
        props: {
          viewName,
          rowCount,
          columns,
          dataVersion: shape.props.dataVersion + 1,
          error: null,
        },
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      editor.updateShape<QueryCellShape>({
        id: shape.id,
        type: 'querycell',
        props: { error: message },
      })
    }
  }, [editor, shape.id, shape.props.sql, shape.props.mode, shape.props.viewName, shape.props.dataVersion])

  // Mount quak datatable
  useEffect(() => {
    if (!shape.props.viewName || shape.props.error) return
    setLocalError(null)
    let cancelled = false

    async function mount() {
      const { db, conn, wasmInitialized } = await ensureWasmReady()
      if (cancelled) return
      if (!db || !conn || !wasmInitialized) {
        setLocalError('DuckDB WASM failed to initialize')
        return
      }

      try {
        const check = await conn.query(
          `SELECT 1 FROM information_schema.tables WHERE table_name = '${shape.props.viewName}'`
        )
        if (check.numRows === 0) {
          setLocalError('Data expired — click ↻ to refresh')
          return
        }

        const connector = wasmConnector({ duckdb: db as any, connection: conn as any })
        const coordinator = new Coordinator()
        coordinator.databaseConnector(connector)
        coordinatorRef.current = coordinator

        const headerHeight = 32
        const dt = await datatable(shape.props.viewName!, {
          coordinator,
          height: height - headerHeight - 2,
        })

        if (cancelled) return
        dtRef.current = dt

        const container = containerRef.current
        if (container) {
          container.innerHTML = ''
          container.appendChild(dt.node())
        }
      } catch (err: any) {
        if (!cancelled) setLocalError(err.message || String(err))
      }
    }

    mount()
    return () => {
      cancelled = true
      coordinatorRef.current?.clear()
      coordinatorRef.current = null
      dtRef.current = null
    }
  }, [shape.props.viewName, shape.props.dataVersion, shape.props.error, height])

  const headerHeight = 32

  return (
    <div
      style={{ width, height, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        background: '#f8f9fa',
        borderBottom: '1px solid #dee2e6',
        height: headerHeight,
        flexShrink: 0,
      }}>
        {showExpandButton && (
          <button onClick={showQuery} style={toolbarBtnStyle('#f1f3f5')} title="Show query">
            »
          </button>
        )}
        <span style={{ color: '#495057', fontSize: 11 }}>
          {shape.props.viewName
            ? `${shape.props.rowCount.toLocaleString()} rows × ${shape.props.columns.length} cols`
            : 'No results yet'}
        </span>
        <span style={{ flex: 1 }} />
        {shape.props.viewName && (
          <button onClick={handleRefresh} style={toolbarBtnStyle('#f1f3f5')} title="Refresh">
            ↻
          </button>
        )}
      </div>
      {/* Error display */}
      {(shape.props.error || localError) && (
        <div style={{
          padding: 12,
          color: '#c92a2a',
          fontFamily: 'monospace',
          fontSize: 11,
          background: '#fff5f5',
          overflow: 'auto',
          flex: 1,
        }}>
          <strong>Error</strong>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>
            {shape.props.error || localError}
          </pre>
        </div>
      )}
      {/* Quak datatable */}
      {!shape.props.error && !localError && (
        <div ref={containerRef} style={{ flex: 1, overflow: 'hidden' }} />
      )}
    </div>
  )
}

// --- Draggable Divider ---
function DividerHandle({ shape }: { shape: QueryCellShape }) {
  const editor = useEditor()
  const dragging = useRef(false)
  const startX = useRef(0)
  const startRatio = useRef(shape.props.splitRatio)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startRatio.current = shape.props.splitRatio
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [shape.props.splitRatio])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    e.stopPropagation()
    const dx = e.clientX - startX.current
    // Convert dx from screen to shape coords (account for zoom)
    const zoom = editor.getZoomLevel()
    const dxShape = dx / zoom
    const newRatio = Math.max(0.15, Math.min(0.7, startRatio.current + dxShape / shape.props.w))
    editor.updateShape<QueryCellShape>({
      id: shape.id,
      type: 'querycell',
      props: { splitRatio: newRatio },
    })
  }, [editor, shape.id, shape.props.w])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  }, [])

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        width: 6,
        cursor: 'col-resize',
        background: '#dee2e6',
        flexShrink: 0,
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#adb5bd' }}
      onMouseLeave={(e) => { (e.target as HTMLElement).style.background = '#dee2e6' }}
    />
  )
}

// --- Helpers ---
function toolbarBtnStyle(bg: string): React.CSSProperties {
  return {
    padding: '2px 8px',
    borderRadius: 4,
    border: '1px solid #ced4da',
    background: bg,
    color: '#212529',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    lineHeight: '18px',
  }
}
