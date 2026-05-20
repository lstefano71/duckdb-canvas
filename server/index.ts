import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { createServer as createViteServer } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const WORKSPACES_DIR = path.join(ROOT, 'workspaces')
const isDev = process.env.NODE_ENV !== 'production'

const app = express()
app.use(express.json({ limit: '50mb' }))

// Ensure workspaces directory exists
await fs.mkdir(WORKSPACES_DIR, { recursive: true })

// --- DuckDB + Quack Setup ---

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
    await duckdbConnection.run(`CALL quack_serve('quack:127.0.0.1:9494', token := '${QUACK_TOKEN}')`)

    console.log('[server] DuckDB + Quack serving on 127.0.0.1:9494 (token:', QUACK_TOKEN, ')')
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

app.get('/api/workspaces', (_req, res) => {
  // Return currently active rooms (rooms are created on first connect)
  res.json([...rooms.keys()])
})

app.get('/api/quack-token', (_req, res) => {
  if (!duckdbReady) {
    res.status(503).json({ error: 'DuckDB not ready' })
    return
  }
  res.json({ token: QUACK_TOKEN, uri: 'quack:127.0.0.1:9494' })
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, duckdb: duckdbReady })
})

// --- Vite dev server as middleware (HMR) or static files in production ---

import { createServer as createHttpServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import Database from 'better-sqlite3'
import { TLSocketRoom, NodeSqliteWrapper, SQLiteSyncStorage } from '@tldraw/sync-core'

const PORT = 3000
const httpServer = createHttpServer(app)

// --- tldraw Sync Rooms ---

const ROOMS_DB_PATH = path.join(ROOT, 'workspaces', 'sync-rooms.db')
await fs.mkdir(path.join(ROOT, 'workspaces'), { recursive: true })

const rooms = new Map<string, TLSocketRoom>()

function getOrCreateRoom(slug: string): TLSocketRoom {
  let room = rooms.get(slug)
  if (room) return room

  const db = new Database(ROOMS_DB_PATH)
  const sqlWrapper = new NodeSqliteWrapper(db, { tablePrefix: `room_${slug.replace(/[^a-z0-9_]/gi, '_')}_` })
  const storage = new SQLiteSyncStorage({ sql: sqlWrapper })

  room = new TLSocketRoom({
    storage,
    onSessionRemoved(_room, { numSessionsRemaining }) {
      if (numSessionsRemaining === 0) {
        console.log(`[sync] Room "${slug}" has no sessions, keeping alive for reconnections`)
      }
    },
  })
  rooms.set(slug, room)
  console.log(`[sync] Created room "${slug}"`)
  return room
}

const wss = new WebSocketServer({ noServer: true })

httpServer.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url!, `http://${req.headers.host}`)

  // Only handle /sync/:slug paths
  const match = url.pathname.match(/^\/sync\/([^/]+)$/)
  if (!match) {
    // Let Vite HMR handle its own upgrade
    return
  }

  const slug = match[1]
  const sessionId = url.searchParams.get('sessionId') || crypto.randomUUID()

  wss.handleUpgrade(req, socket, head, (ws) => {
    const room = getOrCreateRoom(slug)
    room.handleSocketConnect({ sessionId, socket: ws as unknown as import('@tldraw/sync-core').WebSocketMinimal })
  })
})

// --- Start ---

if (isDev) {
  const { createLogger } = await import('vite')
  const logger = createLogger()
  const origWarn = logger.warn.bind(logger)
  logger.warn = (msg, opts) => {
    if (msg.includes('outside its package')) return
    origWarn(msg, opts)
  }
  const vite = await createViteServer({
    root: ROOT,
    server: { middlewareMode: true, hmr: { server: httpServer } },
    appType: 'spa',
    customLogger: logger,
  })

  app.use(vite.middlewares)
} else {
  const distPath = path.join(ROOT, 'dist')
  app.use(express.static(distPath))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[duckdb-canvas] ${isDev ? 'Dev' : 'Production'} server on http://0.0.0.0:${PORT}`)
})

// Init DuckDB in background (don't block server startup)
initDuckDB()
