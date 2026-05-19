import * as duckdb from '@duckdb/duckdb-wasm'
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'

let db: duckdb.AsyncDuckDB | null = null
let conn: duckdb.AsyncDuckDBConnection | null = null
let wasmInitialized = false
let wasmInitFailed = false
let quackAvailable = false

export interface QueryResult {
  columns: Array<{ name: string; type: string }>
  data: Array<ArrayLike<unknown>>
  rowCount: number
  error?: string
}

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: duckdb_wasm,
    mainWorker: mvp_worker,
  },
  eh: {
    mainModule: duckdb_wasm_eh,
    mainWorker: eh_worker,
  },
}

async function initDuckDBWasm() {
  if (wasmInitialized || wasmInitFailed) return

  try {
    const bundle = await duckdb.selectBundle(MANUAL_BUNDLES)
    const worker = new Worker(bundle.mainWorker!, { type: 'module' })
    const logger = new duckdb.ConsoleLogger()
    db = new duckdb.AsyncDuckDB(logger, worker)
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker)

    conn = await db.connect()

    // Try to load quack and attach remote server with auth token
    try {
      // Fetch the auth token from the server
      const tokenRes = await fetch('/api/quack-token')
      if (!tokenRes.ok) throw new Error('Token endpoint not available')
      const { token, uri } = await tokenRes.json()

      await conn.query(`INSTALL quack FROM core_nightly`)
      await conn.query(`LOAD quack`)
      await conn.query(`ATTACH '${uri}' AS remote (TOKEN '${token}')`)
      quackAvailable = true
      console.log('[duckdb-wasm] Connected to remote via Quack')
    } catch (err) {
      console.warn('[duckdb-wasm] Quack not available:', err)
    }

    wasmInitialized = true
  } catch (err) {
    console.warn('[duckdb-wasm] WASM init failed, server mode will use REST:', err)
    wasmInitFailed = true
  }
}

// Execute via REST API on the server
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
  // Server mode: try Quack via WASM first, fallback to REST
  if (mode === 'server') {
    if (!wasmInitFailed && !wasmInitialized) {
      await initDuckDBWasm()
    }
    if (quackAvailable && conn) {
      const effectiveSql = `FROM remote.query('${sqlText.replace(/'/g, "''")}')`
      const result = await conn.query(effectiveSql)
      return arrowToResult(result)
    }
    // Fallback to REST
    return executeViaRest(sqlText)
  }

  // Local mode: must use WASM
  await initDuckDBWasm()
  if (!conn) throw new Error('DuckDB WASM failed to initialize')
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
