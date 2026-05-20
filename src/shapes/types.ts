import type { TLBaseShape, TLShapeId } from 'tldraw'

export type ColumnInfo = {
  name: string
  type: string
}

export type QueryCellProps = {
  w: number
  h: number
  sql: string
  mode: 'server' | 'local'
  queryVisible: boolean
  splitRatio: number
  // Result state
  viewName: string | null
  columns: ColumnInfo[]
  rowCount: number
  dataVersion: number
  error: string | null
}

export type ChartCellProps = {
  w: number
  h: number
  code: string
  sourceShapeId: TLShapeId | null
  codeVisible: boolean
  splitRatio: number
  paused: boolean
  error: string | null
}

// Register custom shape types with tldraw's type system
declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    querycell: QueryCellProps
    chartcell: ChartCellProps
  }
}

export type QueryCellShape = TLBaseShape<'querycell', QueryCellProps>
export type ChartCellShape = TLBaseShape<'chartcell', ChartCellProps>
