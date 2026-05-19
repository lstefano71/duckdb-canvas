import * as duckdb from '@duckdb/duckdb-wasm'

let db: duckdb.AsyncDuckDB | null = null
let conn: duckdb.AsyncDuckDBConnection | null = null
let initialized = false

export interface QueryResult {
  columns: Array<{ name: string; type: string }>
  data: Array<ArrayLike<unknown>>
  rowCount: number
  error?: string
}

async function initDuckDB() {
  if (initialized) return

  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles()
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES)

  const worker = new Worker(bundle.mainWorker!, { type: 'module' })
  const logger = new duckdb.ConsoleLogger()
  db = new duckdb.AsyncDuckDB(logger, worker)
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker)

  conn = await db.connect()

  // Try to load quack and attach remote server
  try {
    await conn.query(`INSTALL quack FROM core_nightly`)
    await conn.query(`LOAD quack`)
    await conn.query(`ATTACH 'quack:localhost:9494' AS remote`)
    console.log('[duckdb-wasm] Connected to remote via Quack')
  } catch (err) {
    console.warn('[duckdb-wasm] Quack connection failed, local-only mode:', err)
  }

  initialized = true
}

export async function executeQuery(
  sql: string,
  mode: 'server' | 'local'
): Promise<QueryResult> {
  await initDuckDB()
  if (!conn) throw new Error('DuckDB not initialized')

  const effectiveSql = mode === 'server'
    ? `FROM remote.query('${sql.replace(/'/g, "''")}')`
    : sql

  const result = await conn.query(effectiveSql)

  const schema = result.schema.fields
  const columns = schema.map((f) => ({ name: f.name, type: String(f.type) }))
  const rowCount = result.numRows

  // Extract columnar data
  const data: Array<ArrayLike<unknown>> = []
  for (let i = 0; i < schema.length; i++) {
    const col = result.getChildAt(i)
    if (col) {
      data.push(col.toArray())
    } else {
      data.push([])
    }
  }

  return { columns, data, rowCount }
}
