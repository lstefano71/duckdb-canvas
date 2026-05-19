import * as duckdb from '@duckdb/duckdb-wasm'

let db: duckdb.AsyncDuckDB | null = null
let conn: duckdb.AsyncDuckDBConnection | null = null
let initialized = false
let quackAvailable = false

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
    quackAvailable = true
    console.log('[duckdb-wasm] Connected to remote via Quack')
  } catch (err) {
    console.warn('[duckdb-wasm] Quack not available, using REST fallback for server queries:', err)
  }

  initialized = true
}

// Fallback: execute via REST API on the server when Quack isn't available in WASM
async function executeViaRest(sqlText: string): Promise<QueryResult> {
  const res = await fetch('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql: sqlText }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `Server error: ${res.status}`)
  }
  return await res.json()
}

export async function executeQuery(
  sqlText: string,
  mode: 'server' | 'local'
): Promise<QueryResult> {
  await initDuckDB()
  if (!conn) throw new Error('DuckDB not initialized')

  // Server mode: try Quack first, fallback to REST
  if (mode === 'server') {
    if (quackAvailable) {
      const effectiveSql = `FROM remote.query('${sqlText.replace(/'/g, "''")}')`
      const result = await conn.query(effectiveSql)
      return arrowToResult(result)
    } else {
      return executeViaRest(sqlText)
    }
  }

  // Local mode: run directly in WASM
  const result = await conn.query(sqlText)
  return arrowToResult(result)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function arrowToResult(result: any): QueryResult {
  const schema = result.schema.fields
  const columns = schema.map((f: any) => ({ name: f.name, type: String(f.type) }))
  const rowCount = result.numRows

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
