import type { TLBaseShape } from 'tldraw'

export type QueryShapeProps = {
  w: number
  h: number
  sql: string
  mode: 'server' | 'local'
  resultShapeId: string | null
}

// Register custom shape types with tldraw's type system
declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    query: QueryShapeProps
    result: ResultShapeProps
  }
}

export type QueryShape = TLBaseShape<'query', QueryShapeProps>

export type ColumnInfo = {
  name: string
  type: string
}

export type ResultShapeProps = {
  w: number
  h: number
  columns: ColumnInfo[]
  rowCount: number
  dataKey: string | null
  error: string | null
}

export type ResultShape = TLBaseShape<'result', ResultShapeProps>
