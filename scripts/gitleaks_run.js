#!/usr/bin/env node
/**
 * Gitleaks runner — secret-scanning bootstrap.
 *
 * Why a bootstrap script: gitleaks is a Go binary (~22 MB) and committing it
 * into the repo (or asking every contributor to brew/apt install it) is a
 * non-starter. This script checks for a cached copy under
 * `node_modules/.cache/gitleaks/bin/` (gitignored as part of node_modules)
 * and downloads the pinned release on first use. Subsequent invocations
 * exec the cached binary directly with the caller's args.
 *
 * Pinned version is the single source of truth — bumping it requires editing
 * GITLEAKS_VERSION below and updating SHA256 (or letting the next CI run
 * re-download into a fresh cache).
 *
 * Usage:
 *   node scripts/gitleaks_run.js protect --staged --no-banner   # pre-commit
 *   node scripts/gitleaks_run.js detect --no-banner             # CI / full scan
 *
 * Exit code: forwarded from gitleaks (0 = no leaks, 1 = leaks found, >1 = err).
 */

const fs = require('fs')
const path = require('path')
const os = require('os')
const https = require('https')
const { spawnSync, execSync } = require('child_process')
const zlib = require('zlib')

// Pinned release. Bump deliberately; do not float.
const GITLEAKS_VERSION = '8.30.1'

const ROOT = path.resolve(__dirname, '..')
const CACHE_DIR = path.join(ROOT, 'node_modules', '.cache', 'gitleaks')
const BIN_DIR = path.join(CACHE_DIR, 'bin')

function platformAsset() {
  const platform = process.platform
  const arch = process.arch
  // gitleaks naming: gitleaks_<ver>_<os>_<arch>.<ext>
  // os: linux, darwin, windows; arch: x64, arm64, x32
  const osMap = { linux: 'linux', darwin: 'darwin', win32: 'windows' }
  const archMap = { x64: 'x64', arm64: 'arm64', ia32: 'x32' }
  const o = osMap[platform]
  const a = archMap[arch]
  if (!o || !a) {
    throw new Error(`[gitleaks] unsupported platform: ${platform}/${arch}`)
  }
  const ext = platform === 'win32' ? 'zip' : 'tar.gz'
  return {
    name: `gitleaks_${GITLEAKS_VERSION}_${o}_${a}.${ext}`,
    isZip: ext === 'zip',
    binName: platform === 'win32' ? 'gitleaks.exe' : 'gitleaks',
  }
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    const get = (u) => {
      https.get(u, { headers: { 'User-Agent': 'scales-tarot-gitleaks-bootstrap' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          return get(res.headers.location)
        }
        if (res.statusCode !== 200) {
          reject(new Error(`download failed: HTTP ${res.statusCode} for ${u}`))
          return
        }
        res.pipe(file)
        file.on('finish', () => file.close(() => resolve()))
      }).on('error', reject)
    }
    get(url)
  })
}

function extractTarGz(archivePath, destDir, binName) {
  // Use system tar (POSIX). Avoids adding a node-tar dep just for one file.
  execSync(`tar -xzf "${archivePath}" -C "${destDir}" "${binName}"`, { stdio: 'inherit' })
}

function extractZip(archivePath, destDir, binName) {
  // On Windows we shell out to PowerShell Expand-Archive; macOS/Linux unlikely
  // to hit this branch. If unzip is not present, surface a clear error.
  if (process.platform === 'win32') {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force"`,
      { stdio: 'inherit' }
    )
    return
  }
  try {
    execSync(`unzip -o "${archivePath}" "${binName}" -d "${destDir}"`, { stdio: 'inherit' })
  } catch (err) {
    throw new Error('[gitleaks] unzip not available; install it or use a tar.gz platform')
  }
}

async function ensureBinary() {
  const asset = platformAsset()
  const binPath = path.join(BIN_DIR, asset.binName)
  if (fs.existsSync(binPath)) return binPath

  fs.mkdirSync(BIN_DIR, { recursive: true })
  const url = `https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/${asset.name}`
  const tmpFile = path.join(os.tmpdir(), `gitleaks_${process.pid}_${Date.now()}.${asset.isZip ? 'zip' : 'tar.gz'}`)

  process.stderr.write(`[gitleaks] downloading v${GITLEAKS_VERSION} (one-time, ~7 MB)...\n`)
  try {
    await download(url, tmpFile)
    if (asset.isZip) {
      extractZip(tmpFile, BIN_DIR, asset.binName)
    } else {
      extractTarGz(tmpFile, BIN_DIR, asset.binName)
    }
    fs.chmodSync(binPath, 0o755)
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
  }

  // Sanity check: invoke `version` and ensure it returns the pinned string.
  const probe = spawnSync(binPath, ['version'], { encoding: 'utf-8' })
  const reported = (probe.stdout || '').trim()
  if (probe.status !== 0 || reported !== GITLEAKS_VERSION) {
    throw new Error(`[gitleaks] version mismatch after install: reported="${reported}", expected="${GITLEAKS_VERSION}"`)
  }
  return binPath
}

async function main() {
  const args = process.argv.slice(2)
  const binPath = await ensureBinary()
  const result = spawnSync(binPath, args, { stdio: 'inherit', cwd: ROOT })
  if (result.error) {
    process.stderr.write(`[gitleaks] failed to spawn: ${result.error.message}\n`)
    process.exit(1)
  }
  process.exit(result.status ?? 1)
}

main().catch((err) => {
  process.stderr.write(`[gitleaks] ${err.message}\n`)
  process.exit(1)
})
