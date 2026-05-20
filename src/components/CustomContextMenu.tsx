import { useEditor, createShapeId } from 'tldraw'
import {
  DefaultContextMenu,
  TLUiContextMenuProps,
  DefaultContextMenuContent,
  TldrawUiMenuGroup,
  TldrawUiMenuItem,
} from 'tldraw'
import { autoSaveWorkspace } from '../lib/workspace'

const WORKSPACE_SLUG = new URLSearchParams(window.location.search).get('workspace') || 'default'

// Work around React types version mismatch
const MenuGroup = TldrawUiMenuGroup as any
const MenuItem = TldrawUiMenuItem as any

export function CustomContextMenu(props: TLUiContextMenuProps) {
  return (
    <DefaultContextMenu {...props}>
      <CanvasMenuItems />
      <DefaultContextMenuContent />
    </DefaultContextMenu>
  )
}

function CanvasMenuItems() {
  const editor = useEditor()

  return (
    <MenuGroup id="canvas-actions">
      <MenuItem
        id="add-query"
        label="New Query"
        onSelect={() => {
          const { x, y } = editor.inputs.currentPagePoint
          const id = createShapeId()
          editor.createShape({
            id,
            type: 'querycell',
            x,
            y,
          })
          editor.select(id)
        }}
        readonlyOk
      />
      <MenuItem
        id="save-workspace"
        label="💾 Save"
        onSelect={() => {
          const snapshot = editor.store.getStoreSnapshot()
          autoSaveWorkspace(WORKSPACE_SLUG, snapshot)
          fetch(`/api/workspaces/${encodeURIComponent(WORKSPACE_SLUG)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(snapshot),
          })
        }}
        readonlyOk
      />
    </MenuGroup>
  )
}
