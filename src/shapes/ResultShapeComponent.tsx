import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'
import { getResultData } from '../lib/result-store'
import type { ResultShape } from './ResultShape'

export function ResultShapeComponent({ shape }: { shape: ResultShape }) {
  const parentRef = useRef<HTMLDivElement>(null)

  if (shape.props.error) {
    return (
      <div style={{
        width: shape.props.w,
        height: shape.props.h,
        background: '#1e1e2e',
        borderRadius: 8,
        border: '1px solid #f38ba8',
        padding: 12,
        color: '#f38ba8',
        fontFamily: 'monospace',
        fontSize: 12,
        overflow: 'auto',
      }}>
        <strong>Error</strong>
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{shape.props.error}</pre>
      </div>
    )
  }

  const data = shape.props.dataKey ? getResultData(shape.props.dataKey) : null
  const { columns, rowCount } = shape.props

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 10,
  })

  return (
    <div style={{
      width: shape.props.w,
      height: shape.props.h,
      background: '#1e1e2e',
      borderRadius: 8,
      border: '1px solid #45475a',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header bar */}
      <div style={{
        padding: '6px 10px',
        background: '#313244',
        borderBottom: '1px solid #45475a',
        color: '#a6adc8',
        fontSize: 11,
      }}>
        {rowCount.toLocaleString()} rows × {columns.length} columns
      </div>
      {/* Column headers */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #45475a',
        background: '#181825',
        minWidth: 'fit-content',
      }}>
        {columns.map((col) => (
          <div key={col.name} style={{
            minWidth: 120,
            padding: '4px 8px',
            color: '#cdd6f4',
            fontSize: 11,
            fontWeight: 600,
            borderRight: '1px solid #313244',
          }}>
            {col.name}
            <span style={{ color: '#6c7086', fontWeight: 400, marginLeft: 4 }}>
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
                borderBottom: '1px solid #313244',
              }}
            >
              {columns.map((col, colIdx) => (
                <div key={col.name} style={{
                  minWidth: 120,
                  padding: '4px 8px',
                  color: '#cdd6f4',
                  fontSize: 11,
                  fontFamily: 'monospace',
                  borderRight: '1px solid #313244',
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
