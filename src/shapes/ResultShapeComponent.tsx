import { useCallback, useRef, useEffect, useState } from 'react'
import { useIsEditing } from 'tldraw'
import { Coordinator } from '@uwdata/mosaic-core'
import { wasmConnector } from '@uwdata/mosaic-core'
import { datatable } from '../vendor/quak'
import { ensureWasmReady } from '../lib/duckdb-client'
import type { ResultShape } from './types'

export function ResultShapeComponent({ shape }: { shape: ResultShape }) {
  const isEditing = useIsEditing(shape.id)
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const dtRef = useRef<any>(null)
  const coordinatorRef = useRef<Coordinator | null>(null)

  const stopPropagation = useCallback((e: React.PointerEvent) => {
    if (isEditing) e.stopPropagation()
  }, [isEditing])

  // Mount quak datatable when viewName is available
  useEffect(() => {
    if (!shape.props.viewName || shape.props.error) return

    setError(null) // Clear any stale local error
    let cancelled = false

    async function mount() {
      // Wait for DuckDB-WASM to initialize
      const { db, conn, wasmInitialized } = await ensureWasmReady()
      if (cancelled) return
      if (!db || !conn || !wasmInitialized) {
        setError('DuckDB WASM failed to initialize')
        return
      }

      try {
        // Check if the view/table still exists (lost on page reload)
        const check = await conn.query(
          `SELECT 1 FROM information_schema.tables WHERE table_name = '${shape.props.viewName}'`
        )
        if (check.numRows === 0) {
          setError('Data expired — re-run the query (Ctrl+Enter)')
          return
        }

        const connector = wasmConnector({ duckdb: db as any, connection: conn as any })
        const coordinator = new Coordinator()
        coordinator.databaseConnector(connector)
        coordinatorRef.current = coordinator

        const dt = await datatable(shape.props.viewName!, {
          coordinator,
          height: shape.props.h - 40,
        })

        if (cancelled) return
        dtRef.current = dt

        const container = containerRef.current
        if (container) {
          container.innerHTML = ''
          container.appendChild(dt.node())
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || String(err))
      }
    }

    mount()

    return () => {
      cancelled = true
      coordinatorRef.current?.clear()
      coordinatorRef.current = null
      dtRef.current = null
    }
  }, [shape.props.viewName, shape.props.dataVersion, shape.props.error])

  // Resize quak when shape dimensions change
  useEffect(() => {
    if (dtRef.current) {
      dtRef.current.resize(shape.props.h - 40)
    }
  }, [shape.props.h])

  if (shape.props.error) {
    return (
      <div style={{
        width: shape.props.w,
        height: shape.props.h,
        background: '#fff5f5',
        borderRadius: 8,
        border: '1px solid #ffc9c9',
        padding: 12,
        color: '#c92a2a',
        fontFamily: 'monospace',
        fontSize: 12,
        overflow: 'auto',
        pointerEvents: isEditing ? 'all' : 'none',
      }}
        onPointerDown={stopPropagation}
        onPointerMove={stopPropagation}
        onPointerUp={stopPropagation}
      >
        <strong>Error</strong>
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{shape.props.error}</pre>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        width: shape.props.w,
        height: shape.props.h,
        background: '#fff9db',
        borderRadius: 8,
        border: '1px solid #ffd43b',
        padding: 12,
        color: '#664d03',
        fontFamily: 'monospace',
        fontSize: 12,
        pointerEvents: isEditing ? 'all' : 'none',
      }}
        onPointerDown={stopPropagation}
        onPointerMove={stopPropagation}
        onPointerUp={stopPropagation}
      >
        <strong>Quak error</strong>
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{error}</pre>
      </div>
    )
  }

  return (
    <div style={{
      width: shape.props.w,
      height: shape.props.h,
      background: '#ffffff',
      borderRadius: 8,
      border: '1px solid #dee2e6',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      pointerEvents: isEditing ? 'all' : 'none',
    }}
      onPointerDown={stopPropagation}
      onPointerMove={stopPropagation}
      onPointerUp={stopPropagation}
    >
      {/* Header */}
      <div style={{
        padding: '6px 10px',
        background: '#f8f9fa',
        borderBottom: '1px solid #dee2e6',
        color: '#495057',
        fontSize: 11,
        flexShrink: 0,
      }}>
        {shape.props.viewName
          ? `${shape.props.rowCount.toLocaleString()} rows × ${shape.props.columns.length} cols`
          : 'Waiting for data...'}
        {!isEditing && <span style={{ color: '#adb5bd', marginLeft: 8 }}>(double-click to interact)</span>}
      </div>
      {/* Quak datatable mounts here */}
      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden' }} />
    </div>
  )
}
