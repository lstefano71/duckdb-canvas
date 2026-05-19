import {
  ShapeUtil,
  HTMLContainer,
  Rectangle2d,
  TLResizeInfo,
} from 'tldraw'
import { QueryShapeComponent } from './QueryShapeComponent'
import type { QueryShape, QueryShapeProps } from './types'

export type { QueryShape, QueryShapeProps }

export class QueryShapeUtil extends ShapeUtil<QueryShape> {
  static override type = 'query' as const

  getDefaultProps(): QueryShapeProps {
    return {
      w: 500,
      h: 300,
      sql: 'SELECT 1 AS hello;',
      mode: 'server',
      resultShapeId: null,
    }
  }

  getGeometry(shape: QueryShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  component(shape: QueryShape) {
    return (
      <HTMLContainer>
        <QueryShapeComponent shape={shape} />
      </HTMLContainer>
    )
  }

  getIndicatorPath(shape: QueryShape) {
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

  override onResize(_shape: QueryShape, info: TLResizeInfo<QueryShape>) {
    return {
      props: {
        w: Math.max(200, info.initialBounds.w * info.scaleX),
        h: Math.max(150, info.initialBounds.h * info.scaleY),
      },
    }
  }
}
