/**
 * Scales Tarot API Server entry point
 * Imports the configured Express app and starts listening.
 * See app.ts for route/middleware setup.
 */

import net from 'net'
import app from './app'

const PREFERRED_PORT = Number(process.env.PORT ?? 3000)
const MAX_RETRIES = 3

/**
 * Check if a port is available by attempting to create a server and listen on it.
 * Returns a promise that resolves with true if available, false if occupied.
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false)
      } else {
        resolve(false)
      }
    })

    server.once('listening', () => {
      server.close(() => {
        resolve(true)
      })
    })

    server.listen(port)
  })
}

/**
 * Find an available port starting from preferredPort, trying up to maxRetries times.
 * Returns the available port number or null if none found.
 */
async function findAvailablePort(preferredPort: number, maxRetries: number): Promise<number | null> {
  for (let i = 0; i <= maxRetries; i++) {
    const portToTry = preferredPort + i
    const available = await isPortAvailable(portToTry)
    if (available) {
      return portToTry
    }
    console.log(`[server] Port ${portToTry} is occupied, trying next...`)
  }
  return null
}

/**
 * Start the server on an available port.
 */
async function startServer(): Promise<void> {
  const availablePort = await findAvailablePort(PREFERRED_PORT, MAX_RETRIES)

  if (availablePort === null) {
    console.error(
      `[server] Error: Could not find an available port after ${MAX_RETRIES} retries. ` +
      `Tried ports ${PREFERRED_PORT} to ${PREFERRED_PORT + MAX_RETRIES}.`
    )
    process.exit(1)
  }

  // Bind to 0.0.0.0 so LAN devices (mini program real device debugging) can connect
  app.listen(availablePort, '0.0.0.0', () => {
    console.log(`[server] Scales Tarot API running on http://0.0.0.0:${availablePort}`)
  })
}

startServer()

export default app
