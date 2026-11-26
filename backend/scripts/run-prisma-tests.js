/**
 * Runs every Prisma/PostgreSQL integration suite sequentially against the
 * LOCAL database in config.env and prints a summary. Never point at production.
 *
 * Usage: npm test            (all suites)
 *        npm test -- hotel    (suites whose name contains "hotel")
 */
import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SUITES = [
  ['identity', 'phase3-prisma-identity.js'],
  ['booking', 'phase4-prisma-booking.js'],
  ['parity', 'phase5-prisma-parity.js'],
  ['ownership', 'ownership-prisma-harden.js'],
  ['workspace', 'provider-workspace-prisma.js'],
  ['hotel', 'hotel-marketplace-prisma.js'],
  ['hotel-booking', 'hotel-booking-prisma.js'],
  ['hotel-fulfillment', 'hotel-fulfillment-prisma.js'],
  ['transport', 'transport-marketplace-prisma.js'],
  ['transport-fulfillment', 'transport-fulfillment-prisma.js'],
  ['chapa', 'chapa-payment-prisma.js'],
]

const filter = process.argv[2]
const selected = filter ? SUITES.filter(([name]) => name.includes(filter)) : SUITES

const summary = []
for (const [name, file] of selected) {
  const started = Date.now()
  const res = spawnSync(process.execPath, [path.join(__dirname, file)], {
    encoding: 'utf8',
    env: { ...process.env },
    timeout: 10 * 60 * 1000,
  })
  const out = `${res.stdout || ''}${res.stderr || ''}`
  const passed = (out.match(/^PASS /gm) || []).length
  const failed = (out.match(/^FAIL /gm) || []).length
  const ok = res.status === 0 && failed === 0
  summary.push({ name, passed, failed, ok, seconds: Math.round((Date.now() - started) / 1000) })
  console.log(`${ok ? '✔' : '✘'} ${name.padEnd(22)} ${passed} passed, ${failed} failed (${summary.at(-1).seconds}s)`)
  if (!ok) {
    for (const line of out.split('\n').filter((l) => l.startsWith('FAIL '))) console.log(`    ${line}`)
  }
}

const totalPassed = summary.reduce((a, s) => a + s.passed, 0)
const totalFailed = summary.reduce((a, s) => a + s.failed, 0)
console.log(`\nSuites: ${summary.filter((s) => s.ok).length}/${summary.length} passed — checks: ${totalPassed} passed, ${totalFailed} failed`)
process.exitCode = summary.every((s) => s.ok) ? 0 : 1
