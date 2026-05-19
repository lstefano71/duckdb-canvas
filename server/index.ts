import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACES_DIR = path.join(__dirname, '..', 'workspaces')

const app = express()
app.use(express.json({ limit: '50mb' }))

// Ensure workspaces directory exists
await fs.mkdir(WORKSPACES_DIR, { recursive: true })

// --- DuckDB + Quack Setup ---
// Note: @duckdb/node-api is the "neo" bindings. We'll initialize DuckDB
// and start quack_serve so the browser WASM client can connect.

let duckdbReady = false
let duckdbConnection: any = null
const QUACK_TOKEN = 'duckdb-canvas-dev'

async function initDuckDB() {
  try {
    const { DuckDBInstance } = await import('@duckdb/node-api')
    const instance = await DuckDBInstance.create()
    duckdbConnection = await instance.connect()

    await duckdbConnection.run('INSTALL quack FROM core_nightly')
    await duckdbConnection.run('LOAD quack')
    await duckdbConnection.run(`CALL quack_serve('quack:localhost:9494', token := '${QUACK_TOKEN}')`)

    console.log('[server] DuckDB + Quack serving on port 9494 (token:', QUACK_TOKEN, ')')
    duckdbReady = true
  } catch (err) {
    console.error('[server] DuckDB/Quack init failed:', err)
    console.warn('[server] Running without DuckDB — workspace API still available')
  }
}

// --- Query API (REST fallback for when WASM can't use Quack directly) ---

app.post('/api/query', async (req, res) => {
  if (!duckdbReady || !duckdbConnection) {
    res.status(503).json({ error: 'DuckDB not available' })
    return
  }

  const { sql } = req.body
  if (!sql || typeof sql !== 'string') {
    res.status(400).json({ error: 'Missing or invalid "sql" field' })
    return
  }

  try {
    const result = await duckdbConnection.run(sql)
    const rows = await result.getRows()
    const columns = result.columnNames().map((name: string, i: number) => ({
      name,
      type: String(result.columnTypes()[i]),
    }))

    // Convert to columnar format, coercing BigInt to Number
    const numCols = columns.length
    const data: unknown[][] = Array.from({ length: numCols }, () => [])
    for (const row of rows) {
      for (let c = 0; c < numCols; c++) {
        const val = row[c]
        data[c].push(typeof val === 'bigint' ? Number(val) : val)
      }
    }

    res.json({ columns, data, rowCount: data[0]?.length ?? 0 })
  } catch (err: any) {
    res.status(400).json({ error: err.message || String(err) })
  }
})

// --- Workspace API ---

// List workspaces
app.get('/api/workspaces', async (_req, res) => {
  try {
    const entries = await fs.readdir(WORKSPACES_DIR, { withFileTypes: true })
    const slugs = entries.filter((e) => e.isDirectory()).map((e) => e.name)
    res.json(slugs)
  } catch {
    res.json([])
  }
})

// Load workspace (prefer draft for crash recovery, fallback to saved)
app.get('/api/workspaces/:slug', async (req, res) => {
  const dir = path.join(WORKSPACES_DIR, req.params.slug)
  const draftPath = path.join(dir, 'canvas.draft.json')
  const savedPath = path.join(dir, 'canvas.json')

  try {
    // Try draft first (crash recovery)
    const draft = await fs.readFile(draftPath, 'utf-8').catch(() => null)
    if (draft) {
      res.json(JSON.parse(draft))
      return
    }
    // Fall back to saved
    const saved = await fs.readFile(savedPath, 'utf-8').catch(() => null)
    if (saved) {
      res.json(JSON.parse(saved))
      return
    }
    res.status(404).json({ error: 'Workspace not found' })
  } catch {
    res.status(500).json({ error: 'Failed to load workspace' })
  }
})

// Save workspace (explicit save — promote draft to saved)
app.put('/api/workspaces/:slug', async (req, res) => {
  const dir = path.join(WORKSPACES_DIR, req.params.slug)
  await fs.mkdir(dir, { recursive: true })

  const savedPath = path.join(dir, 'canvas.json')
  const draftPath = path.join(dir, 'canvas.draft.json')

  await fs.writeFile(savedPath, JSON.stringify(req.body, null, 2))
  // Remove draft since saved is now up-to-date
  await fs.rm(draftPath, { force: true })

  res.json({ ok: true })
})

// Auto-save draft
app.put('/api/workspaces/:slug/draft', async (req, res) => {
  const dir = path.join(WORKSPACES_DIR, req.params.slug)
  await fs.mkdir(dir, { recursive: true })

  const draftPath = path.join(dir, 'canvas.draft.json')
  await fs.writeFile(draftPath, JSON.stringify(req.body))

  res.json({ ok: true })
})

// Quack token endpoint — WASM client fetches this to ATTACH with TOKEN
app.get('/api/quack-token', (_req, res) => {
  if (!duckdbReady) {
    res.status(503).json({ error: 'DuckDB not ready' })
    return
  }
  res.json({ token: QUACK_TOKEN, uri: 'quack:localhost:9494' })
})

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, duckdb: duckdbReady })
})

// --- Start ---
const PORT = 3001
app.listen(PORT, () => {
  console.log(`[server] API listening on http://localhost:${PORT}`)
})

// Init DuckDB in background (don't block server startup)
initDuckDB()
