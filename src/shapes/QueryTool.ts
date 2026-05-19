import { StateNode, TLPointerEventInfo, createShapeId } from 'tldraw'

export class QueryTool extends StateNode {
  static override id = 'query'

  override onPointerDown(_info: TLPointerEventInfo) {
    const { currentPagePoint } = this.editor.inputs
    const id = createShapeId()

    this.editor.createShape({
      id,
      type: 'query',
      x: currentPagePoint.x,
      y: currentPagePoint.y,
      props: {
        w: 500,
        h: 300,
        sql: 'SELECT 1 AS hello;',
        mode: 'server',
        resultShapeId: null,
      },
    })

    this.editor.select(id)
    this.editor.setCurrentTool('select')
  }
}
