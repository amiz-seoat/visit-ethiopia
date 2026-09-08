/**
 * Phase 4G gate — run Phase 4A–4F against a dedicated memory DB server.
 * Usage: node scripts/phase4g-regression-runner.js [port]
 */
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.argv[2] || '4198'
const BASE = `http://localhost:${PORT}/api/v1`
const uriFile = path.join(__dirname, '..', `.phase4g-gate-uri-${PORT}`)
const sharedUriFile = path.join(__dirname, '..', '.memory-db-uri')

const suites = [
  { name: 'phase4a-models.js', args: (uri) => [uri] },
  { name: 'phase4b-inventory.js', args: (uri) => [uri] },
  { name: 'phase4c-booking-lifecycle.js', args: (uri) => [BASE, uri] },
  { name: 'phase4d-payment-mock.js', args: (uri) => [BASE, uri] },
  { name: 'phase4e-reconciliation-webhooks.js', args: (uri) => [BASE, uri] },
  { name: 'phase4f-refunds.js', args: (uri) => [BASE, uri] },
  { name: 'phase4h-provider-bookings.js', args: (uri) => [BASE, uri] },
  { name: 'phase4i-provider-operations.js', args: (uri) => [BASE, uri] },
]

function waitForServer(ms = 120000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const poll = async () => {
      try {
        const res = await fetch(`${BASE}/tours?limit=1`)
        if (res.ok) return resolve()
      } catch {
        // retry
      }
      if (Date.now() - start > ms) return reject(new Error('Server did not become ready'))
      setTimeout(poll, 400)
    }
    poll()
  })
}

function runNode(scriptName, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'node',
      [path.join(__dirname, scriptName), ...args],
      { stdio: 'inherit', cwd: path.join(__dirname, '..'), env: process.env }
    )
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${scriptName} exited ${code}`))
    })
  })
}

async function main() {
  console.log(`\n=== Phase 4A–4F regression on port ${PORT} ===\n`)

  const server = spawn(
    'node',
    [path.join(__dirname, 'startWithMemoryDb.js')],
    {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, VISIT_ETHIOPIA_PORT: PORT },
    }
  )

  const shutdown = () => {
    try {
      server.kill('SIGINT')
    } catch {
      // ignore
    }
  }
  process.on('SIGINT', shutdown)
  process.on('exit', shutdown)

  try {
    await waitForServer()
    // Snapshot URI immediately after server is healthy so concurrent suites cannot race us.
    const uri = fs.readFileSync(sharedUriFile, 'utf8').trim()
    fs.writeFileSync(uriFile, uri, 'utf8')

    for (const suite of suites) {
      console.log(`\n>>> ${suite.name}`)
      await runNode(suite.name, suite.args(uri))
    }

    console.log('\n=== Phase 4A–4I ALL PASSED ===\n')
  } finally {
    shutdown()
    try {
      fs.unlinkSync(uriFile)
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
