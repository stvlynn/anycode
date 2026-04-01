#!/usr/bin/env node
import { execSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join, resolve } from 'path'

const ROOT = resolve(new URL('..', import.meta.url).pathname)

let errors = ''
try {
  errors = execSync('npx tsc --noEmit 2>&1', {
    cwd: ROOT,
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
  })
} catch (error) {
  errors = error.stdout || ''
}

const stubExports = new Map()
const defaultExports = new Map()

for (const line of errors.split('\n')) {
  let match = line.match(
    /error TS2614: Module '"(.+?)"' has no exported member '(.+?)'\. Did you mean to use 'import .* from/,
  )
  if (match) {
    const [, mod, member] = match
    if (!defaultExports.has(mod)) defaultExports.set(mod, new Set())
    defaultExports.get(mod).add(member)
    continue
  }

  match = line.match(/error TS2305: Module '"(.+?)"' has no exported member '(.+?)'/)
  if (match) {
    const [, mod, member] = match
    if (!stubExports.has(mod)) stubExports.set(mod, new Set())
    stubExports.get(mod).add(member)
    continue
  }

  match = line.match(/error TS2724: '"(.+?)"' has no exported member named '(.+?)'/)
  if (match) {
    const [, mod, member] = match
    if (!stubExports.has(mod)) stubExports.set(mod, new Set())
    stubExports.get(mod).add(member)
    continue
  }

  match = line.match(/error TS2306: File '(.+?)' is not a module/)
  if (match) {
    const [, filePath] = match
    if (!stubExports.has(filePath)) stubExports.set(filePath, new Set())
    continue
  }

  match = line.match(/^(.+?)\(\d+,\d+\): error TS2307: Cannot find module '(.+?)'/)
  if (match) {
    const [srcFile, mod] = [match[1], match[2]]
    if (!mod.endsWith('.md') && (mod.startsWith('.') || mod.startsWith('src/'))) {
      const srcDir = dirname(srcFile)
      const resolved = join(ROOT, srcDir, mod).replace(/\.js$/, '.ts')
      if (resolved.startsWith(ROOT + '/') && !existsSync(resolved)) {
        if (!stubExports.has(resolved)) stubExports.set(resolved, new Set())
      }
    }
  }
}

const allSourceFiles = execSync('find src -name "*.ts" -o -name "*.tsx"', {
  cwd: ROOT,
  encoding: 'utf-8',
})
  .trim()
  .split('\n')
  .filter(Boolean)

for (const file of allSourceFiles) {
  const content = readFileSync(join(ROOT, file), 'utf-8')
  const srcDir = dirname(file)
  const importRegex = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"](.+?)['"]/g
  let match

  while ((match = importRegex.exec(content)) !== null) {
    const members = match[1]
      .split(',')
      .map(s => s.trim().split(/\s+as\s+/)[0].trim())
      .filter(Boolean)
    const mod = match[2]
    if (!mod.startsWith('.') && !mod.startsWith('src/')) continue

    const resolved = join(ROOT, srcDir, mod).replace(/\.js$/, '.ts')
    if (resolved.startsWith(ROOT + '/') && !existsSync(resolved)) {
      if (!stubExports.has(resolved)) stubExports.set(resolved, new Set())
      for (const member of members) {
        stubExports.get(resolved).add(member)
      }
    }
  }
}

let created = 0
for (const [filePath, exports] of stubExports) {
  const relPath = filePath.replace(ROOT + '/', '')
  const dir = dirname(filePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const lines = ['// Auto-generated type stub — replace with real implementation']
  for (const exp of exports) {
    lines.push(`export type ${exp} = any;`)
  }

  for (const [mod, defs] of defaultExports) {
    const modNorm = mod.replace(/\.js$/, '').replace(/^src\//, '')
    const fileNorm = relPath.replace(/\.ts$/, '')
    if (modNorm === fileNorm || mod === relPath) {
      for (const def of defs) {
        lines.push(`export type ${def} = any;`)
      }
    }
  }

  if (exports.size === 0) {
    lines.push('export {};')
  }

  writeFileSync(filePath, lines.join('\n') + '\n')
  created++
}

console.log(`Created/updated ${created} stub files`)
console.log(
  `Total named exports resolved: ${[...stubExports.values()].reduce((a, b) => a + b.size, 0)}`,
)
