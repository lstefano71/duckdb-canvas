import { ShapeUtil, HTMLContainer, TLResizeInfo, resizeBox, Rectangle2d } from 'tldraw'
import type { ChartCellShape, ChartCellProps } from './types'
import { ChartCellComponent } from './ChartCellComponent'

const DEFAULT_CODE = `return Plot.plot({
  width,
  height,
  marks: [Plot.dot(data, {x: columns[0], y: columns[1]})]
})`

export class ChartCellUtil extends ShapeUtil<ChartCellShape> {
  static override type = 'chartcell' as const

  getDefaultProps(): ChartCellProps {
    return {
      w: 800,
      h: 500,
      code: DEFAULT_CODE,
      sourceShapeId: null,
      codeVisible: true,
      splitRatio: 0.3,
      paused: false,
      error: null,
    }
  }

  override canResize() { return true }
  override isAspectRatioLocked() { return false }

  override onResize(shape: ChartCellShape, info: TLResizeInfo<ChartCellShape>) {
    return resizeBox(shape, info)
  }

  getGeometry(shape: ChartCellShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  getIndicatorPath(shape: ChartCellShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }

  component(shape: ChartCellShape) {
    return (
      <HTMLContainer>
        <ChartCellComponent shape={shape} />
      </HTMLContainer>
    )
  }
}
