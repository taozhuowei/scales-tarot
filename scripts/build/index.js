/**
 * Build orchestrator entry — single source of truth for build/dev pipelines.
 *
 * Why: previously `npm run build` and `npm run dev` were 200+ char string
 * pipes in package.json — duplicated logic, no targeting, no skip-quality
 * for CI. This script centralises the topology so quality_gate.js stops
 * carrying build/smoke (those belong here).
 *
 * Public entrypoints:
 *   - `npm run prod`  -> --prod --target h5,mp,server  (full prod artifacts + smoke)
 *   - `npm run dev`   -> --dev  --target h5,mp,server  (watch mode, no smoke)
 *
 * Internal flags (NOT exposed via npm scripts; CI wires them directly):
 *   --prod | --dev          required, mutually exclusive
 *   --target h5,mp,server,all   default: all (comma-separated subset OK)
 *   --skip-quality          skip the quality gate prefix (CI uses this
 *                           because the verify job already ran quality)
 *
 * Run via: `node scripts/build/index.js --prod --target h5,server`
 */

'use strict'

const path = require('path')

function parseArgs(argv) {
  const args = {
    mode: null,         // 'prod' | 'dev'
    targets: ['h5', 'mp', 'server'],
    skipQuality: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--prod') {
      if (args.mode === 'dev') fail('--prod and --dev are mutually exclusive')
      args.mode = 'prod'
    } else if (a === '--dev') {
      if (args.mode === 'prod') fail('--prod and --dev are mutually exclusive')
      args.mode = 'dev'
    } else if (a === '--skip-quality') {
      args.skipQuality = true
    } else if (a === '--target' || a.startsWith('--target=')) {
      const value = a.startsWith('--target=') ? a.slice('--target='.length) : argv[++i]
      if (!value) fail('--target requires a value (h5,mp,server,all)')
      args.targets = expandTargets(value)
    } else {
      fail(`Unknown arg: ${a}`)
    }
  }

  if (!args.mode) fail('--prod or --dev is required')
  return args
}

function expandTargets(value) {
  const valid = new Set(['h5', 'mp', 'server'])
  const parts = value.split(',').map(s => s.trim()).filter(Boolean)
  if (parts.length === 1 && parts[0] === 'all') return ['h5', 'mp', 'server']
  for (const p of parts) {
    if (!valid.has(p)) fail(`Invalid target "${p}" (allowed: h5, mp, server, all)`)
  }
  // De-dup, preserve declaration order.
  return Array.from(new Set(parts))
}

function fail(msg) {
  console.error(`[build] ${msg}`)
  console.error('[build] Usage: node scripts/build/index.js --prod|--dev [--target h5,mp,server,all] [--skip-quality]')
  process.exit(2)
}

const args = parseArgs(process.argv.slice(2))

const runner = args.mode === 'prod'
  ? require(path.join(__dirname, 'prod.js'))
  : require(path.join(__dirname, 'dev.js'))

runner({ targets: args.targets, skipQuality: args.skipQuality })
  .then(code => process.exit(code))
  .catch(err => {
    console.error('[build] Pipeline crashed:', err && err.stack ? err.stack : err)
    process.exit(1)
  })
