import type { Editor } from 'tldraw'
import { createShapeId } from 'tldraw'
import type { QueryShape, ResultShape } from '../shapes/types'
import type { QueryResult } from './duckdb-client'
import { storeResultData, deleteResultData } from './result-store'

export function spawnResultShape(
  editor: Editor,
  queryShape: QueryShape,
  result: QueryResult & { error?: string }
) {
  const existingResultId = queryShape.props.resultShapeId

  // Store columnar data outside of tldraw
  let dataKey: string | null = null
  if (!result.error && result.data.length > 0) {
    dataKey = storeResultData(result.data)
  }

  if (existingResultId) {
    // Update existing result shape
    const existing = editor.getShape(existingResultId as any) as ResultShape | undefined
    if (existing) {
      // Clean up old data
      if (existing.props?.dataKey) deleteResultData(existing.props.dataKey)

      editor.updateShape({
        id: existingResultId as any,
        type: 'result',
        props: {
          columns: result.columns,
          rowCount: result.rowCount,
          dataKey,
          error: result.error || null,
        },
      })
      return
    }
  }

  // Spawn a new result shape to the right of the query shape
  const resultId = createShapeId()
  const arrowId = createShapeId()
  const offsetX = queryShape.props.w + 80

  editor.createShape({
    id: resultId,
    type: 'result',
    x: queryShape.x + offsetX,
    y: queryShape.y,
    props: {
      w: 600,
      h: 350,
      columns: result.columns,
      rowCount: result.rowCount,
      dataKey,
      error: result.error || null,
    },
  })

  // Create a curved arrow shape
  editor.createShape({
    id: arrowId,
    type: 'arrow',
    x: queryShape.x + queryShape.props.w,
    y: queryShape.y + queryShape.props.h / 2,
    props: {
      kind: 'arc',
      bend: -30,
      arrowheadStart: 'none',
      arrowheadEnd: 'arrow',
    },
  })

  // Bind the arrow to both shapes
  editor.createBindings([
    {
      type: 'arrow',
      fromId: arrowId,
      toId: queryShape.id,
      props: {
        terminal: 'start',
        normalizedAnchor: { x: 1, y: 0.5 },
        isPrecise: true,
        isExact: false,
        snap: 'none',
      },
    },
    {
      type: 'arrow',
      fromId: arrowId,
      toId: resultId,
      props: {
        terminal: 'end',
        normalizedAnchor: { x: 0, y: 0.5 },
        isPrecise: true,
        isExact: false,
        snap: 'none',
      },
    },
  ])

  // Link the query to its result
  editor.updateShape<QueryShape>({
    id: queryShape.id,
    type: 'query',
    props: { resultShapeId: resultId as unknown as string },
  })
}
