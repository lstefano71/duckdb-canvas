import { useEditor } from 'tldraw'
import { useCallback, useRef, useEffect, useState } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { javascript } from '@codemirror/lang-javascript'
import * as Plot from '@observablehq/plot'
import * as d3 from 'd3'
import { getColumnarData } from '../lib/duckdb-client'
import type { ChartCellShape, QueryCellShape } from './types'

const stopProp = (e: React.PointerEvent) => e.stopPropagation()

const toolbarBtnStyle = (bg: string): React.CSSProperties => ({
  border: 'none',
  borderRadius: 4,
  padding: '2px 6px',
  cursor: 'pointer',
  fontSize: 12,
  background: bg,
})

export function ChartCellComponent({ shape }: { shape: ChartCellShape }) {
  const { codeVisible, splitRatio, w, h } = shape.props

  const codeWidth = codeVisible ? Math.round(w * splitRatio) : 0
  const chartWidth = codeVisible ? w - codeWidth : w

  return (
    <div
      style={{
        width: w,
        height: h,
        display: 'flex',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid #dee2e6',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        background: '#ffffff',
        pointerEvents: 'all',
      }}
    >
      {codeVisible && (
        <CodePanel
          shape={shape}
          width={codeWidth}
          height={h}
        />
      )}
      {codeVisible && (
        <DividerHandle shape={shape} />
      )}
      <ChartPanel
        shape={shape}
        width={chartWidth}
        height={h}
        showExpandButton={!codeVisible}
      />
    </div>
  )
}

// --- Code Panel ---
function CodePanel({ shape, width, height }: {
  shape: ChartCellShape
  width: number
  height: number
}) {
  const editor = useEditor()
  const editorRef = useRef<HTMLDivElement>(null)
  const cmViewRef = useRef<EditorView | null>(null)

  const hideCode = useCallback(() => {
    editor.updateShape<ChartCellShape>({
      id: shape.id,
      type: 'chartcell',
      props: { codeVisible: false },
    })
  }, [editor, shape.id])

  // Mount CodeMirror
  useEffect(() => {
    if (!editorRef.current) return

    const view = new EditorView({
      doc: shape.props.code,
      extensions: [
        basicSetup,
        javascript(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newCode = update.state.doc.toString()
            editor.updateShape<ChartCellShape>({
              id: shape.id,
              type: 'chartcell',
              props: { code: newCode },
            })
          }
        }),
      ],
      parent: editorRef.current,
    })

    cmViewRef.current = view
    return () => {
      view.destroy()
      cmViewRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      style={{ width, height, display: 'flex', flexDirection: 'column', flexShrink: 0 }}
    >
      {/* Header — draggable */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        background: '#f8f9fa',
        borderBottom: '1px solid #dee2e6',
        flexShrink: 0,
        cursor: 'grab',
      }}>
        <span style={{ color: '#495057', fontSize: 11 }}>JS</span>
        <span style={{ flex: 1 }} />
        <button onPointerDown={stopProp} onClick={hideCode} style={toolbarBtnStyle('#f1f3f5')} title="Hide code">
          «
        </button>
      </div>
      {/* CodeMirror */}
      <div
        ref={editorRef}
        style={{ flex: 1, overflow: 'hidden' }}
        onPointerDown={(e) => {
          if (!editor.getSelectedShapeIds().includes(shape.id)) {
            editor.select(shape.id)
          }
          e.stopPropagation()
        }}
      />
    </div>
  )
}

// --- Chart Panel ---
function ChartPanel({ shape, width, height, showExpandButton }: {
  shape: ChartCellShape
  width: number
  height: number
  showExpandButton: boolean
}) {
  const editor = useEditor()
  const containerRef = useRef<HTMLDivElement>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const renderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showCode = useCallback(() => {
    editor.updateShape<ChartCellShape>({
      id: shape.id,
      type: 'chartcell',
      props: { codeVisible: true },
    })
  }, [editor, shape.id])

  const togglePause = useCallback(() => {
    editor.updateShape<ChartCellShape>({
      id: shape.id,
      type: 'chartcell',
      props: { paused: !shape.props.paused },
    })
  }, [editor, shape.id, shape.props.paused])

  // Resolve source QueryCell's dataVersion for reactivity
  const sourceShape = shape.props.sourceShapeId
    ? editor.getShape<QueryCellShape>(shape.props.sourceShapeId)
    : null
  const sourceViewName = sourceShape?.props.viewName ?? null
  const sourceDataVersion = sourceShape?.props.dataVersion ?? 0
  const sourceDeleted = shape.props.sourceShapeId !== null && !sourceShape

  const headerHeight = 32
  const chartHeight = height - headerHeight
  const chartWidth = width

  // Debounced render
  useEffect(() => {
    if (sourceDeleted) {
      setLocalError('Source query deleted')
      return
    }
    if (!sourceViewName) {
      setLocalError('Data expired — run the source query')
      return
    }
    if (shape.props.paused) return

    // Debounce code changes
    if (renderTimerRef.current) clearTimeout(renderTimerRef.current)
    renderTimerRef.current = setTimeout(() => {
      renderChart()
    }, 300)

    return () => {
      if (renderTimerRef.current) clearTimeout(renderTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape.props.code, sourceViewName, sourceDataVersion, shape.props.paused, sourceDeleted, chartWidth, chartHeight])

  async function renderChart() {
    if (!sourceViewName) return
    const container = containerRef.current
    if (!container) return

    try {
      const { data: columnar, columns } = await getColumnarData(sourceViewName)
      const rowCount = columns.length > 0 ? (columnar[columns[0]] as ArrayLike<unknown>).length : 0

      // Proxy that presents columnar typed arrays as a virtual array of row objects.
      // Row objects are built lazily on index access — no upfront 150k allocation.
      // Array.isArray returns true because target is a real array.
      const target = new Array(rowCount)
      const data = new Proxy(target, {
        get(t, prop, receiver) {
          if (prop === 'length') return rowCount
          if (prop === Symbol.iterator) {
            return function* () {
              for (let i = 0; i < rowCount; i++) yield receiver[i]
            }
          }
          if (typeof prop === 'string') {
            const idx = Number(prop)
            if (Number.isInteger(idx) && idx >= 0 && idx < rowCount) {
              const row: Record<string, unknown> = {}
              for (const col of columns) {
                row[col] = (columnar[col] as ArrayLike<unknown>)[idx]
              }
              return row
            }
          }
          return Reflect.get(t, prop, receiver)
        },
        // Array methods like .map/.filter check "i in array" before accessing —
        // must report all valid indices as present.
        has(_t, prop) {
          if (typeof prop === 'string') {
            const idx = Number(prop)
            if (Number.isInteger(idx) && idx >= 0 && idx < rowCount) return true
          }
          return prop in target
        },
      })

      const fn = new Function('data', 'columns', 'width', 'height', 'Plot', 'd3', shape.props.code)
      const node = fn(data, columns, chartWidth, chartHeight, Plot, d3)

      if (node instanceof Node) {
        container.innerHTML = ''
        container.appendChild(node)
        setLocalError(null)
        // Clear shape-level error if any
        if (shape.props.error) {
          editor.updateShape<ChartCellShape>({
            id: shape.id,
            type: 'chartcell',
            props: { error: null },
          })
        }
      } else {
        setLocalError('Code must return a DOM node (e.g., Plot.plot(...))')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setLocalError(message)
    }
  }

  const displayError = shape.props.error || localError

  return (
    <div
      style={{ width, height, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* Header — draggable */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        background: shape.props.paused ? '#fff9db' : '#f8f9fa',
        borderBottom: '1px solid #dee2e6',
        height: headerHeight,
        flexShrink: 0,
        cursor: 'grab',
      }}>
        {showExpandButton && (
          <button onPointerDown={stopProp} onClick={showCode} style={toolbarBtnStyle('#f1f3f5')} title="Show code">
            »
          </button>
        )}
        <span style={{ color: '#495057', fontSize: 11 }}>
          {sourceShape
            ? `from: ${sourceShape.props.viewName || 'pending'}`
            : 'no source'}
        </span>
        <span style={{ flex: 1 }} />
        <button
          onPointerDown={stopProp}
          onClick={togglePause}
          style={toolbarBtnStyle(shape.props.paused ? '#fff3bf' : '#f1f3f5')}
          title={shape.props.paused ? 'Resume auto-render' : 'Pause auto-render'}
        >
          {shape.props.paused ? '▶' : '⏸'}
        </button>
      </div>
      {/* Error */}
      {displayError && (
        <div
          style={{
            padding: 12,
            color: '#c92a2a',
            fontFamily: 'monospace',
            fontSize: 11,
            background: '#fff5f5',
            overflow: 'auto',
            flex: 1,
          }}
          onPointerDown={(e) => {
            if (!editor.getSelectedShapeIds().includes(shape.id)) {
              editor.select(shape.id)
            }
            e.stopPropagation()
          }}
        >
          <strong>Error</strong>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>
            {displayError}
          </pre>
        </div>
      )}
      {/* Chart render */}
      {!displayError && (
        <div
          ref={containerRef}
          style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onPointerDown={(e) => {
            if (!editor.getSelectedShapeIds().includes(shape.id)) {
              editor.select(shape.id)
            }
            e.stopPropagation()
          }}
        />
      )}
    </div>
  )
}

// --- Draggable Divider ---
function DividerHandle({ shape }: { shape: ChartCellShape }) {
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
    const dx = e.clientX - startX.current
    const newRatio = Math.max(0.15, Math.min(0.7, startRatio.current + dx / shape.props.w))
    editor.updateShape<ChartCellShape>({
      id: shape.id,
      type: 'chartcell',
      props: { splitRatio: newRatio },
    })
  }, [editor, shape.id, shape.props.w])

  const onPointerUp = useCallback(() => {
    dragging.current = false
  }, [])

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        width: 6,
        cursor: 'col-resize',
        background: '#e9ecef',
        flexShrink: 0,
        touchAction: 'none',
      }}
    />
  )
}
