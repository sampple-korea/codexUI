import { fileURLToPath } from 'node:url'
import { dirname, extname, isAbsolute, join } from 'node:path'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import type { Server as HttpServer, IncomingMessage } from 'node:http'
import express, { type Express } from 'express'
import { createCodexBridgeMiddleware } from './codexAppServerBridge.js'
import { createAuthSession } from './authMiddleware.js'
import { WebSocketServer, type WebSocket } from 'ws'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, '..', 'dist')

function getCodexHomeDir(): string {
  const codexHome = process.env.CODEX_HOME?.trim()
  return codexHome && codexHome.length > 0 ? codexHome : join(homedir(), '.codex')
}

function resolveUserOverrideDir(): string {
  const fromEnv = process.env.CODEXUI_OVERRIDE_DIR?.trim()
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv
  }
  return join(getCodexHomeDir(), 'web-ui-overrides')
}

export type ServerOptions = {
  password?: string
}

export type ServerInstance = {
  app: Express
  dispose: () => void
  attachWebSocket: (server: HttpServer) => void
}

const IMAGE_CONTENT_TYPES: Record<string, string> = {
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

function normalizeLocalImagePath(rawPath: string): string {
  const trimmed = rawPath.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('file://')) {
    try {
      return decodeURIComponent(trimmed.replace(/^file:\/\//u, ''))
    } catch {
      return trimmed.replace(/^file:\/\//u, '')
    }
  }
  return trimmed
}

export function createServer(options: ServerOptions = {}): ServerInstance {
  const app = express()
  const bridge = createCodexBridgeMiddleware()
  const authSession = options.password ? createAuthSession(options.password) : null
  const userOverrideDir = resolveUserOverrideDir()
  const hasUserOverrides = existsSync(userOverrideDir)

  // 1. Auth middleware (if password is set)
  if (authSession) {
    app.use(authSession.middleware)
  }

  // 2. Bridge middleware for /codex-api/*
  app.use(bridge)

  // 3. Serve local images referenced in markdown (desktop parity for absolute image paths)
  app.get('/codex-local-image', (req, res) => {
    const rawPath = typeof req.query.path === 'string' ? req.query.path : ''
    const localPath = normalizeLocalImagePath(rawPath)
    if (!localPath || !isAbsolute(localPath)) {
      res.status(400).json({ error: 'Expected absolute local file path.' })
      return
    }

    const contentType = IMAGE_CONTENT_TYPES[extname(localPath).toLowerCase()]
    if (!contentType) {
      res.status(415).json({ error: 'Unsupported image type.' })
      return
    }

    res.type(contentType)
    res.setHeader('Cache-Control', 'private, max-age=300')
    res.sendFile(localPath, { dotfiles: 'allow' }, (error) => {
      if (!error) return
      if (!res.headersSent) res.status(404).json({ error: 'Image file not found.' })
    })
  })

  // 4. Optional user overrides from persistent storage.
  // Files in this folder shadow bundled dist assets and survive restarts.
  if (hasUserOverrides) {
    app.use(express.static(userOverrideDir))
  }

  // 5. Static files from Vue build
  app.use(express.static(distDir))

  // 6. SPA fallback
  app.use((_req, res) => {
    const userIndex = join(userOverrideDir, 'index.html')
    if (hasUserOverrides && existsSync(userIndex)) {
      res.sendFile(userIndex)
      return
    }
    res.sendFile(join(distDir, 'index.html'))
  })

  return {
    app,
    dispose: () => bridge.dispose(),
    attachWebSocket: (server: HttpServer) => {
      const wss = new WebSocketServer({ noServer: true })

      server.on('upgrade', (req: IncomingMessage, socket, head) => {
        const url = new URL(req.url ?? '', 'http://localhost')
        if (url.pathname !== '/codex-api/ws') {
          return
        }

        if (authSession && !authSession.isRequestAuthorized(req)) {
          socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
          socket.destroy()
          return
        }

        wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
          wss.emit('connection', ws, req)
        })
      })

      wss.on('connection', (ws: WebSocket) => {
        ws.send(JSON.stringify({ method: 'ready', params: { ok: true }, atIso: new Date().toISOString() }))
        const unsubscribe = bridge.subscribeNotifications((notification) => {
          if (ws.readyState !== 1) return
          ws.send(JSON.stringify(notification))
        })

        ws.on('close', unsubscribe)
        ws.on('error', unsubscribe)
      })
    },
  }
}
