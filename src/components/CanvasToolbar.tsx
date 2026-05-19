import { useEditor } from 'tldraw'

export function CanvasToolbar() {
  const editor = useEditor()

  return (
    <div style={{
      position: 'absolute',
      top: 12,
      right: 12,
      display: 'flex',
      gap: 8,
      zIndex: 1000,
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
    </div>
  )
}
