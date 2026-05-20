import { Tldraw, inlineBase64AssetStore, defaultShapeUtils, defaultBindingUtils } from 'tldraw'
import { useSync } from '@tldraw/sync'
import 'tldraw/tldraw.css'
import { customShapes } from './shapes'
import { QueryTool } from './shapes/QueryTool'
import { CustomContextMenu } from './components/CustomContextMenu'

const WORKSPACE_SLUG = new URLSearchParams(window.location.search).get('workspace') || 'default'

const customTools = [QueryTool]
const allShapeUtils = [...defaultShapeUtils, ...customShapes]
const allBindingUtils = [...defaultBindingUtils]

const syncUri = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/sync/${WORKSPACE_SLUG}`

export default function App() {
  const store = useSync({
    uri: syncUri,
    assets: inlineBase64AssetStore,
    shapeUtils: allShapeUtils,
    bindingUtils: allBindingUtils,
  })

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw
        store={store}
        shapeUtils={customShapes}
        tools={customTools}
        components={{
          ContextMenu: CustomContextMenu,
        }}
      />
    </div>
  )
}
