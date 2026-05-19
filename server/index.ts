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

async function initDuckDB() {
  try {
    // Dynamic import — @duckdb/node-api may not be installed yet
    const { DuckDBInstance } = await import('@duckdb/node-api')
    const instance = await DuckDBInstance.create()
    const connection = await instance.connect()

    await connection.run('INSTALL quack FROM core_nightly')
    await connection.run('LOAD quack')
    await connection.run(`CALL quack_serve('quack:0.0.0.0:9494')`)

    console.log('[server] DuckDB + Quack serving on port 9494')
    duckdbReady = true
  } catch (err) {
    console.error('[server] DuckDB/Quack init failed:', err)
    console.warn('[server] Running without DuckDB — workspace API still available')
  }
}

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
