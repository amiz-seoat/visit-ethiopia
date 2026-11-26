/**
 * Prisma CLI may generate into the monorepo root node_modules when `prisma`
 * is resolved from the workspace root. Backend resolves `@prisma/client`
 * from backend/node_modules — sync the generated client there.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.join(__dirname, '..')
const repoRoot = path.join(backendRoot, '..')

const pairs = [
  [
    path.join(repoRoot, 'node_modules', '.prisma', 'client'),
    path.join(backendRoot, 'node_modules', '.prisma', 'client'),
  ],
]

for (const [src, dest] of pairs) {
  if (!fs.existsSync(src)) {
    console.warn(`[syncPrismaClient] skip missing source: ${src}`)
    continue
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.rmSync(dest, { recursive: true, force: true })
  fs.cpSync(src, dest, { recursive: true })
  console.log(`[syncPrismaClient] synced ${path.relative(repoRoot, src)} → ${path.relative(repoRoot, dest)}`)
}
