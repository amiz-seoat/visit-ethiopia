/**
 * Run full Phase 1–3 test battery sequentially with pollution reset between suites.
 * Usage: node scripts/run-full-test-battery.js [port]
 *
 * Starts memory DB server, runs each suite, resets org/tour pollution between suites.
 */
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { resetSuitePollution } from './lib/testIsolation.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.argv[2] || '4025'
const BASE = `http://localhost:${PORT}/api/v1`

const SUITES = [
  { name: 'full-integration-suite.js', resetBefore: false },
  { name: 'e2e-new-features.js', resetBefore: true },
  { name: 'ownership-security.js', resetBefore: true },
  { name: 'org-membership-security.js', resetBefore: true },
  { name: 'approval-versioning.js', resetBefore: true },
  { name: 'phase2-hardening.js', resetBefore: true },
  { name: 'phase2-audit.js', resetBefore: true },
  { name: 'phase3-tour-marketplace.js', resetBefore: true },
  { name: 'phase3-hardening.js', resetBefore: true },
  { name: 'phase3-final-audit.js', resetBefore: true },
  { name: 'phase3-production-gate.js', resetBefore: true },
]

function waitForServer(ms = 90000) {
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
      setTimeout(poll, 500)
    }
    poll()
  })
}

function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [path.join(__dirname, scriptName), BASE], {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, VISIT_ETHIOPIA_PORT: PORT },
    })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${scriptName} failed with exit ${code}`))
    })
  })
}

async function main() {
  const server = spawn(
    'node',
    [path.join(__dirname, 'startWithMemoryDb.js')],
    {
      stdio: 'inherit',
      shell: true,
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

  console.log(`\n=== Full test battery on port ${PORT} ===\n`)
  await waitForServer()

  const summary = []
  for (const suite of SUITES) {
    if (suite.resetBefore) {
      console.log(`\n--- Resetting suite pollution before ${suite.name} ---\n`)
      await resetSuitePollution()
    }
    console.log(`\n>>> Running ${suite.name}\n`)
    try {
      await runScript(suite.name)
      summary.push({ name: suite.name, ok: true })
    } catch (e) {
      summary.push({ name: suite.name, ok: false, error: e.message })
      console.error(`\nBattery aborted: ${e.message}\n`)
      shutdown()
      process.exit(1)
    }
  }

  console.log('\n=== FULL BATTERY SUMMARY ===')
  for (const s of summary) {
    console.log(`${s.ok ? '✅' : '❌'} ${s.name}`)
  }
  console.log(`\nAll ${summary.length} suites passed.\n`)
  shutdown()
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
