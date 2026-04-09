/**
 * Auto-generate .env.development.local with LAN IP for mini program real device debugging.
 * Vite reads .env.development.local automatically when no explicit --mode is set.
 * Run before dev build: `node scripts/dev_env.js`
 */

const os = require('os')
const fs = require('fs')
const path = require('path')

const port = process.env.PORT || 3000

// Collect all non-internal IPv4 addresses, prefer common LAN ranges (192.168.x / 10.x / 172.16-31.x)
const all_ipv4 = Object.values(os.networkInterfaces())
  .flat()
  .filter(i => i.family === 'IPv4' && !i.internal)

const lan_ip = all_ipv4.find(i =>
  i.address.startsWith('192.168.') ||
  i.address.startsWith('10.') ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(i.address)
)

const ip = lan_ip ? lan_ip.address : (all_ipv4[0]?.address || 'localhost')
const api_base = `http://${ip}:${port}`
const env_path = path.join(__dirname, '..', '.env.development.local')

fs.writeFileSync(env_path, `VITE_API_BASE_URL=${api_base}\n`, 'utf-8')
console.log(`[dev] API base URL: ${api_base}`)
console.log(`[dev] Written to .env.development.local`)
