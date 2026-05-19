import {
  ShapeUtil,
  HTMLContainer,
  Rectangle2d,
  TLShape,
} from 'tldraw'
import { ResultShapeComponent } from './ResultShapeComponent'

export type ColumnInfo = {
  name: string
  type: string
}

const RESULT_TYPE = 'result'

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    [RESULT_TYPE]: {
      w: number
      h: number
      columns: ColumnInfo[]
      rowCount: number
      dataKey: string | null
      error: string | null
    }
  }
}

export type ResultShape = TLShape<typeof RESULT_TYPE>

export class ResultShapeUtil extends ShapeUtil<ResultShape> {
  static override type = RESULT_TYPE

  getDefaultProps(): ResultShape['props'] {
    return {
      w: 600,
      h: 350,
      columns: [],
      rowCount: 0,
      dataKey: null,
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
}
