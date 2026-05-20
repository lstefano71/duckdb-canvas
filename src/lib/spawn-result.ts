import type { Editor } from 'tldraw'
import { createShapeId } from 'tldraw'
import type { QueryShape, ResultShape } from '../shapes/types'
import { executeAndMaterialize } from './duckdb-client'

export async function spawnResultShape(
  editor: Editor,
  queryShape: QueryShape,
) {
  const sqlText = queryShape.props.sql
  const mode = queryShape.props.mode
  const existingResultId = queryShape.props.resultShapeId

  // Get existing view name to reuse it
  let existingViewName: string | undefined
  if (existingResultId) {
    const existing = editor.getShape(existingResultId as any) as ResultShape | undefined
    if (existing?.props.viewName) {
      existingViewName = existing.props.viewName
    }
  }

  try {
    const { viewName, rowCount, columns } = await executeAndMaterialize(sqlText, mode, existingViewName)

    if (existingResultId) {
      const existing = editor.getShape(existingResultId as any) as ResultShape | undefined
      if (existing) {
        editor.updateShape({
          id: existingResultId as any,
          type: 'result',
          props: {
            columns,
            rowCount,
            viewName,
            dataKey: null,
            dataVersion: (existing.props.dataVersion || 0) + 1,
            error: null,
          },
        })
        return
      }
    }

    // Spawn new result shape
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
        h: 400,
        columns,
        rowCount,
        viewName,
        dataKey: null,
        dataVersion: 0,
        error: null,
      },
    })

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

    editor.updateShape<QueryShape>({
      id: queryShape.id,
      type: 'query',
      props: { resultShapeId: resultId as unknown as string },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)

    if (existingResultId) {
      editor.updateShape({
        id: existingResultId as any,
        type: 'result',
        props: { error: message },
      })
      return
    }

    // Spawn error result
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
        h: 200,
        columns: [],
        rowCount: 0,
        viewName: null,
        dataKey: null,
        dataVersion: 0,
        error: message,
      },
    })

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

    editor.updateShape<QueryShape>({
      id: queryShape.id,
      type: 'query',
      props: { resultShapeId: resultId as unknown as string },
    })
  }
}
