import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useRef } from 'react'
import { useIsEditing } from 'tldraw'
import { getResultData } from '../lib/result-store'
import type { ResultShape } from './types'

export function ResultShapeComponent({ shape }: { shape: ResultShape }) {
  const isEditing = useIsEditing(shape.id)
  const parentRef = useRef<HTMLDivElement>(null)
  const { columns, rowCount } = shape.props
  const data = shape.props.dataKey ? getResultData(shape.props.dataKey) : null

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 10,
  })

  // Allow scroll interaction when in edit mode
  const stopPropagation = useCallback((e: React.PointerEvent) => {
    if (isEditing) e.stopPropagation()
  }, [isEditing])

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
      {/* Header bar */}
      <div style={{
        padding: '6px 10px',
        background: '#f8f9fa',
        borderBottom: '1px solid #dee2e6',
        color: '#495057',
        fontSize: 11,
      }}>
        {rowCount.toLocaleString()} rows × {columns.length} columns
        {!isEditing && <span style={{ color: '#adb5bd', marginLeft: 8 }}>(double-click to scroll)</span>}
      </div>
      {/* Column headers */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #dee2e6',
        background: '#f1f3f5',
      }}>
        {columns.map((col) => (
          <div key={col.name} style={{
            flex: '1 1 0',
            width: 0,
            minWidth: 60,
            padding: '4px 8px',
            color: '#212529',
            fontSize: 11,
            fontWeight: 600,
            borderRight: '1px solid #e9ecef',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {col.name}
            <span style={{ color: '#868e96', fontWeight: 400, marginLeft: 4 }}>
              {col.type}
            </span>
          </div>
        ))}
      </div>
      {/* Virtualized rows */}
      <div ref={parentRef} style={{ flex: 1, overflow: 'auto' }}>
        <div style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                display: 'flex',
                borderBottom: '1px solid #f1f3f5',
              }}
            >
              {columns.map((col, colIdx) => (
                <div key={col.name} style={{
                  flex: '1 1 0',
                  width: 0,
                  minWidth: 60,
                  padding: '4px 8px',
                  color: '#212529',
                  fontSize: 11,
                  fontFamily: 'monospace',
                  borderRight: '1px solid #f1f3f5',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {data ? String(data[colIdx][virtualRow.index] ?? 'NULL') : ''}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
