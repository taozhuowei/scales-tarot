/**
 * Port-occupier killer for the dev orchestrator.
 *
 * Why: `npm run dev` previously crashed when 4123 (vite) or 4124 (express)
 * were already bound by a stray watcher from a prior session. Per project
 * decision (see TODO §dev-fix), the dev pipeline now force-frees its ports
 * before starting watchers, instead of asking the user to clean up manually
 * or having `server.ts` silently drift to the next free port.
 *
 * Strategy:
 *   1. Discover PIDs holding `port` via `ss -tlnp` (linux) or `lsof -i :port`
 *      (macOS / WSL fallback) or `netstat -ano` (windows).
 *   2. SIGKILL each PID. We send SIGKILL (-9) directly rather than escalating
 *      from SIGTERM because (a) the dev pipeline blocks on this and waiting
 *      for graceful shutdowns adds 5-10s before vite/express can rebind,
 *      and (b) the only thing on these ports during local dev is our own
 *      watcher — there's nothing to gracefully drain.
 *   3. Wait ~150ms for the kernel to release the socket. On linux this is
 *      essentially instant once the holding process is reaped, but giving
 *      it a tick avoids a race where the next listen(2) sees EADDRINUSE.
 *
 * Failure mode: if `kill` itself errors (e.g. permission denied because the
 * port is held by another user, or the discovery commands aren't installed),
 * we throw — the orchestrator surfaces it instead of silently masking the
 * problem and then crashing later with a misleading EADDRINUSE.
 */

'use strict'

const { execFileSync } = require('child_process')

function setTimeoutPromise(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

/**
 * Run a command and return stdout as a string. Returns '' on non-zero exit
 * (the discovery commands legitimately exit 1 when nothing matches; we treat
 * that as "no occupier" rather than an error).
 */
function safeExec(cmd, args) {
  try {
    return execFileSync(cmd, args, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return ''
  }
}

/**
 * Best-effort PID discovery for `port` across linux / macOS / WSL.
 * Returns a deduped array of integer PIDs (excluding our own).
 */
function findOccupiers(port) {
  const pids = new Set()
  const self_pid = process.pid

  if (process.platform === 'linux' || process.platform === 'darwin') {
    // Try `ss` first (linux only): the modern netstat replacement, with
    // `-tlnp` listing listening tcp sockets and their owning pid (requires
    // root only for peer sockets — listening sockets we own are visible
    // unprivileged). On macOS `ss` is not installed, so safeExec returns
    // '' here and we fall through to the lsof branch below — the only
    // PID-discovery tool that ships by default on macOS.
    const ss_out = safeExec('ss', ['-tlnp', `sport = :${port}`])
    // Lines look like:
    // LISTEN 0 511 0.0.0.0:4124 0.0.0.0:* users:(("node",pid=12345,fd=20))
    for (const match of ss_out.matchAll(/pid=(\d+)/g)) {
      const pid = Number(match[1])
      if (pid && pid !== self_pid) pids.add(pid)
    }

    // Fallback: lsof. Always available on macOS, sometimes on linux. The
    // -t flag prints PIDs only, one per line.
    if (pids.size === 0) {
      const lsof_out = safeExec('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'])
      for (const line of lsof_out.split('\n')) {
        const pid = Number(line.trim())
        if (pid && pid !== self_pid) pids.add(pid)
      }
    }
  } else if (process.platform === 'win32') {
    // netstat -ano on windows: "TCP    0.0.0.0:4124    0.0.0.0:0    LISTENING    1234"
    const out = safeExec('netstat', ['-ano'])
    const re = new RegExp(`^\\s*TCP\\s+\\S+:${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)`, 'gmi')
    for (const match of out.matchAll(re)) {
      const pid = Number(match[1])
      if (pid && pid !== self_pid) pids.add(pid)
    }
  }

  return Array.from(pids)
}

function killPid(pid) {
  if (process.platform === 'win32') {
    // taskkill /F /PID <pid> is the windows equivalent of kill -9.
    try {
      execFileSync('taskkill', ['/F', '/PID', String(pid)], { stdio: 'ignore' })
      return true
    } catch (err) {
      throw new Error(`taskkill failed for pid ${pid}: ${err.message}`)
    }
  }
  try {
    process.kill(pid, 'SIGKILL')
    return true
  } catch (err) {
    // ESRCH = the process already died between discovery and kill — that's
    // fine, the port is now free. Anything else (EPERM most notably) is a
    // real failure the caller needs to see.
    if (err && err.code === 'ESRCH') return false
    throw new Error(`SIGKILL failed for pid ${pid}: ${err.message}`)
  }
}

/**
 * Public API: free `port` by killing any process listening on it.
 *
 * Returns the list of PIDs that were killed (empty array if the port was
 * already free). Throws only if a kill itself fails — discovery failures
 * are treated as "no occupier".
 *
 * Multi-user caveat: this function does NOT verify that the discovered PIDs
 * belong to the current user. On a shared host (CI runner, dev VM, lab box),
 * if another user is squatting on the port the SIGKILL/`taskkill` call will
 * raise EPERM (or its windows equivalent) and propagate as a thrown error.
 * Callers that may run on multi-user systems should catch and surface a
 * clear "port held by another user, free it manually" message rather than
 * letting the raw kernel error reach the orchestrator.
 */
async function killOccupierAndStart(port) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`[port_kill] invalid port: ${port}`)
  }

  const pids = findOccupiers(port)
  if (pids.length === 0) {
    return []
  }

  const killed = []
  for (const pid of pids) {
    const did_kill = killPid(pid)
    if (did_kill) killed.push(pid)
  }

  // Give the kernel a moment to release the socket so the subsequent
  // listen(2) doesn't race with the dying process.
  if (killed.length > 0) {
    await setTimeoutPromise(150)
  }

  return killed
}

module.exports = { killOccupierAndStart, findOccupiers }
