import type { TLBaseShape } from 'tldraw'

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

// Register custom shape types with tldraw's type system
declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    querycell: QueryCellProps
  }
}

export type QueryCellShape = TLBaseShape<'querycell', QueryCellProps>
