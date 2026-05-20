import { ShapeUtil, HTMLContainer, TLResizeInfo, resizeBox, Rectangle2d } from 'tldraw'
import type { QueryCellShape, QueryCellProps } from './types'
import { QueryCellComponent } from './QueryCellComponent'

export class QueryCellUtil extends ShapeUtil<QueryCellShape> {
  static override type = 'querycell' as const

  getDefaultProps(): QueryCellProps {
    return {
      w: 1000,
      h: 400,
      sql: 'SELECT 42 AS answer',
      mode: 'local',
      queryVisible: true,
      splitRatio: 0.4,
      viewName: null,
      columns: [],
      rowCount: 0,
      dataVersion: 0,
      error: null,
    }
  }

  override canEdit() { return true }
  override canResize() { return true }
  override isAspectRatioLocked() { return false }

  override onResize(shape: QueryCellShape, info: TLResizeInfo<QueryCellShape>) {
    return resizeBox(shape, info)
  }

  getGeometry(shape: QueryCellShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  getIndicatorPath(shape: QueryCellShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }

  component(shape: QueryCellShape) {
    return (
      <HTMLContainer>
        <QueryCellComponent shape={shape} />
      </HTMLContainer>
    )
  }
}
