import {
  ShapeUtil,
  HTMLContainer,
  Rectangle2d,
  TLShape,
} from 'tldraw'
import { QueryShapeComponent } from './QueryShapeComponent'

const QUERY_TYPE = 'query'

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    [QUERY_TYPE]: {
      w: number
      h: number
      sql: string
      mode: 'server' | 'local'
      resultShapeId: string | null
    }
  }
}

export type QueryShape = TLShape<typeof QUERY_TYPE>

export class QueryShapeUtil extends ShapeUtil<QueryShape> {
  static override type = QUERY_TYPE

  getDefaultProps(): QueryShape['props'] {
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
}
