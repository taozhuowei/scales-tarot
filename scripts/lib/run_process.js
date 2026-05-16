/**
 * Shared child-process runner for the build pipelines.
 *
 * dev.js and prod.js each spawned an identical `run(label, command, args,
 * env)` promise wrapper + the same REPO_ROOT / VITE_BIN constants (jscpd
 * flagged the 18-line clone). The only difference was the bracketed log
 * tag ('[dev]' vs '[build]'), so the runner is parameterised by prefix.
 * Behaviour is byte-identical to the two inlined copies it replaces.
 */

'use strict'

const { spawn } = require('child_process')
const path = require('path')

// scripts/lib/ -> scripts/ -> repo root. Identical value to the previous
// `path.resolve(__dirname, '..', '..')` in scripts/build/{dev,prod}.js
// (scripts/build/ -> scripts/ -> repo root).
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const VITE_BIN = 'node_modules/@dcloudio/vite-plugin-uni/bin/uni.js'

/**
 * Build a `run(label, command, args, env)` that spawns a child rooted at
 * REPO_ROOT, inherits stdio, and resolves on exit 0 / rejects otherwise.
 * @param {string} logPrefix bracketed tag printed before each label.
 */
function makeProcessRunner(logPrefix) {
  return function run(label, command, args, env = {}) {
    return new Promise((resolve, reject) => {
      console.log(`\n[${logPrefix}] ${label}`)
      const child = spawn(command, args, {
        cwd: REPO_ROOT,
        stdio: 'inherit',
        env: { ...process.env, ...env },
        shell: process.platform === 'win32',
      })
      child.on('error', reject)
      child.on('exit', code => {
        if (code === 0) resolve()
        else reject(new Error(`${label} exited with code ${code}`))
      })
    })
  }
}

module.exports = { REPO_ROOT, VITE_BIN, makeProcessRunner }
