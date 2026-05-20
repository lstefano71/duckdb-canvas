import { StateNode, TLPointerEventInfo, createShapeId } from 'tldraw'

export class QueryTool extends StateNode {
  static override id = 'query'

  override onPointerDown(_info: TLPointerEventInfo) {
    const { currentPagePoint } = this.editor.inputs
    const id = createShapeId()

    this.editor.createShape({
      id,
      type: 'querycell',
      x: currentPagePoint.x,
      y: currentPagePoint.y,
    })

    this.editor.select(id)
    this.editor.setEditingShape(id)
    this.editor.setCurrentTool('select')
  }
}
