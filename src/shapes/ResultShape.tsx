import {
  ShapeUtil,
  HTMLContainer,
  Rectangle2d,
  TLResizeInfo,
} from 'tldraw'
import { ResultShapeComponent } from './ResultShapeComponent'
import type { ResultShape, ResultShapeProps } from './types'

export type { ResultShape, ResultShapeProps, ColumnInfo } from './types'

export class ResultShapeUtil extends ShapeUtil<ResultShape> {
  static override type = 'result' as const

  getDefaultProps(): ResultShapeProps {
    return {
      w: 600,
      h: 400,
      columns: [],
      rowCount: 0,
      dataKey: null,
      viewName: null,
      dataVersion: 0,
      error: null,
    }
  }

  getGeometry(shape: ResultShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  component(shape: ResultShape) {
    return (
      <HTMLContainer>
        <ResultShapeComponent shape={shape} />
      </HTMLContainer>
    )
  }

  getIndicatorPath(shape: ResultShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }

  override canResize() {
    return true
  }

  override canEdit() {
    return true
  }

  override onResize(_shape: ResultShape, info: TLResizeInfo<ResultShape>) {
    return {
      props: {
        w: Math.max(200, info.initialBounds.w * info.scaleX),
        h: Math.max(150, info.initialBounds.h * info.scaleY),
      },
    }
  }
}
