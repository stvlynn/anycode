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

const missingExports = new Map()

for (const line of errors.split('\n')) {
  let match = line.match(
    /error TS2339: Property '(\w+)' does not exist on type 'typeof import\("(.+?)"\)'/,
  )
  if (match) {
    const [, prop, modPath] = match
    const filePath = modPath.startsWith('/') ? modPath : null
    if (!filePath) continue
    for (const ext of ['.ts', '.tsx']) {
      const full = filePath + ext
      if (existsSync(full)) {
        if (!missingExports.has(full)) missingExports.set(full, new Set())
        missingExports.get(full).add(prop)
        break
      }
    }
  }

  match = line.match(
    /error TS2339: Property '(\w+)' does not exist on type '\{ default: typeof import\("(.+?)"\)/,
  )
  if (match) {
    const [, prop, modPath] = match
    const base = modPath.startsWith('/') ? modPath : join(ROOT, modPath)
    for (const ext of ['.ts', '.tsx']) {
      const full = base + ext
      if (existsSync(full)) {
        if (!missingExports.has(full)) missingExports.set(full, new Set())
        missingExports.get(full).add(prop)
        break
      }
    }
  }
}

let ts2339Fixed = 0
for (const [filePath, props] of missingExports) {
  const content = readFileSync(filePath, 'utf-8')
  const existingExports = new Set()
  const exportRegex = /export\s+(?:type|const|function|class|let|var|default)\s+(\w+)/g
  let match
  while ((match = exportRegex.exec(content)) !== null) {
    existingExports.add(match[1])
  }

  const newExports = []
  for (const prop of props) {
    if (
      !existingExports.has(prop) &&
      !content.includes(`export { ${prop}`) &&
      !content.includes(`, ${prop}`)
    ) {
      newExports.push(`export const ${prop}: any = (() => {}) as any;`)
      ts2339Fixed++
    }
  }

  if (newExports.length > 0) {
    writeFileSync(filePath, content.trimEnd() + '\n' + newExports.join('\n') + '\n')
  }
}

const ts2305Fixes = new Map()
for (const line of errors.split('\n')) {
  const match = line.match(
    /^(.+?)\(\d+,\d+\): error TS2305: Module '"(.+?)"' has no exported member '(.+?)'/,
  )
  if (!match) continue
  const [, srcFile, mod, member] = match
  let resolvedPath
  if (mod.startsWith('.') || mod.startsWith('src/')) {
    const base = mod.startsWith('.') ? join(dirname(srcFile), mod) : mod
    const resolved = join(ROOT, base).replace(/\.js$/, '')
    for (const ext of ['.ts', '.tsx']) {
      if (existsSync(resolved + ext)) {
        resolvedPath = resolved + ext
        break
      }
    }
  }
  if (resolvedPath) {
    if (!ts2305Fixes.has(resolvedPath)) ts2305Fixes.set(resolvedPath, new Set())
    ts2305Fixes.get(resolvedPath).add(member)
  }
}

let ts2305Fixed = 0
for (const [filePath, members] of ts2305Fixes) {
  const content = readFileSync(filePath, 'utf-8')
  const newExports = []
  for (const member of members) {
    if (
      !content.includes(`export type ${member}`) &&
      !content.includes(`export const ${member}`) &&
      !content.includes(`export function ${member}`)
    ) {
      newExports.push(`export type ${member} = any;`)
      ts2305Fixed++
    }
  }
  if (newExports.length > 0) {
    writeFileSync(filePath, content.trimEnd() + '\n' + newExports.join('\n') + '\n')
  }
}

const ts2724Fixes = new Map()
for (const line of errors.split('\n')) {
  const match = line.match(
    /^(.+?)\(\d+,\d+\): error TS2724: '"(.+?)"' has no exported member named '(.+?)'/,
  )
  if (!match) continue
  const [, srcFile, mod, member] = match
  let resolvedPath
  if (mod.startsWith('.') || mod.startsWith('src/')) {
    const base = mod.startsWith('.') ? join(dirname(srcFile), mod) : mod
    const resolved = join(ROOT, base).replace(/\.js$/, '')
    for (const ext of ['.ts', '.tsx']) {
      if (existsSync(resolved + ext)) {
        resolvedPath = resolved + ext
        break
      }
    }
  }
  if (resolvedPath) {
    if (!ts2724Fixes.has(resolvedPath)) ts2724Fixes.set(resolvedPath, new Set())
    ts2724Fixes.get(resolvedPath).add(member)
  }
}

let ts2724Fixed = 0
for (const [filePath, members] of ts2724Fixes) {
  const content = readFileSync(filePath, 'utf-8')
  const newExports = []
  for (const member of members) {
    if (
      !content.includes(`export type ${member}`) &&
      !content.includes(`export const ${member}`)
    ) {
      newExports.push(`export type ${member} = any;`)
      ts2724Fixed++
    }
  }
  if (newExports.length > 0) {
    writeFileSync(filePath, content.trimEnd() + '\n' + newExports.join('\n') + '\n')
  }
}

let ts2307Fixed = 0
for (const line of errors.split('\n')) {
  const match = line.match(
    /^(.+?)\(\d+,\d+\): error TS2307: Cannot find module '(.+?)'/,
  )
  if (!match) continue
  const [, srcFile, mod] = match
  if (mod.endsWith('.md') || mod.endsWith('.css')) continue
  if (!mod.startsWith('.') && !mod.startsWith('src/')) continue

  const resolved = mod.startsWith('.')
    ? join(ROOT, dirname(srcFile), mod).replace(/\.js$/, '.ts')
    : join(ROOT, mod).replace(/\.js$/, '.ts')

  if (!existsSync(resolved) && resolved.startsWith(ROOT + '/src/')) {
    const dir = dirname(resolved)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const srcContent = readFileSync(join(ROOT, srcFile), 'utf-8')
    const importRegex = new RegExp(
      `import\\\\s+(?:type\\\\s+)?\\\\{([^}]+)\\\\}\\\\s+from\\\\s+['"]${mod.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}['"]`,
      'g',
    )
    const members = new Set()
    let importMatch
    while ((importMatch = importRegex.exec(srcContent)) !== null) {
      importMatch[1]
        .split(',')
        .map(s => s.trim().replace(/^type\\s+/, '').split(/\\s+as\\s+/)[0].trim())
        .filter(Boolean)
        .forEach(member => members.add(member))
    }
    const lines = ['// Auto-generated stub']
    for (const member of members) {
      lines.push(`export type ${member} = any;`)
    }
    if (members.size === 0) lines.push('export {};')
    writeFileSync(resolved, lines.join('\n') + '\n')
    ts2307Fixed++
  }
}

console.log(`Added ${ts2339Fixed} TS2339 exports`)
console.log(`Added ${ts2305Fixed} TS2305 exports`)
console.log(`Added ${ts2724Fixed} TS2724 exports`)
console.log(`Created ${ts2307Fixed} TS2307 stub files`)
