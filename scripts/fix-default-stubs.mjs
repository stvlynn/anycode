#!/usr/bin/env node
import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join, resolve } from 'path'

const ROOT = resolve(new URL('..', import.meta.url).pathname)

const stubFiles = new Set()
const allTsFiles = execSync('find src -name "*.ts" -o -name "*.tsx"', {
  cwd: ROOT,
  encoding: 'utf-8',
})
  .trim()
  .split('\n')
  .filter(Boolean)

for (const file of allTsFiles) {
  const fullPath = join(ROOT, file)
  const content = readFileSync(fullPath, 'utf-8').trim()
  if (content === 'export default {} as any') {
    stubFiles.add(file)
  }
}

const stubNeeds = new Map()
for (const file of stubFiles) {
  stubNeeds.set(file, { types: new Set(), values: new Set() })
}

function resolveImport(srcFile, importPath) {
  if (importPath.startsWith('src/')) {
    const resolved = importPath.replace(/\.js$/, '.ts')
    return stubFiles.has(resolved) ? resolved : null
  }
  if (importPath.startsWith('.')) {
    const srcDir = dirname(srcFile)
    const resolved = join(srcDir, importPath).replace(/\.js$/, '.ts')
    if (stubFiles.has(resolved)) return resolved
    const resolvedTsx = join(srcDir, importPath).replace(/\.js$/, '.tsx')
    if (stubFiles.has(resolvedTsx)) return resolvedTsx
  }
  return null
}

for (const srcFile of allTsFiles) {
  if (stubFiles.has(srcFile)) continue

  const content = readFileSync(join(ROOT, srcFile), 'utf-8')

  const typeImportRegex = /import\s+type\s+\{([^}]+)\}\s+from\s+['"](.+?)['"]/g
  let match
  while ((match = typeImportRegex.exec(content)) !== null) {
    const members = match[1]
      .split(',')
      .map(s => s.trim().split(/\s+as\s+/)[0].trim())
      .filter(Boolean)
    const resolved = resolveImport(srcFile, match[2])
    if (resolved && stubNeeds.has(resolved)) {
      for (const member of members) stubNeeds.get(resolved).types.add(member)
    }
  }

  const valueImportRegex = /import\s+(?!type\s)\{([^}]+)\}\s+from\s+['"](.+?)['"]/g
  while ((match = valueImportRegex.exec(content)) !== null) {
    const members = match[1]
      .split(',')
      .map(item => {
        const trimmed = item.trim()
        if (trimmed.startsWith('type ')) {
          return {
            name: trimmed.replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim(),
            isType: true,
          }
        }
        return {
          name: trimmed.split(/\s+as\s+/)[0].trim(),
          isType: false,
        }
      })
      .filter(member => member.name)
    const resolved = resolveImport(srcFile, match[2])
    if (resolved && stubNeeds.has(resolved)) {
      for (const member of members) {
        if (member.isType) stubNeeds.get(resolved).types.add(member.name)
        else stubNeeds.get(resolved).values.add(member.name)
      }
    }
  }

  const defaultImportRegex = /import\s+(?!type\s)(\w+)\s+from\s+['"](.+?)['"]/g
  while ((match = defaultImportRegex.exec(content)) !== null) {
    const name = match[1]
    if (name === 'type') continue
    const resolved = resolveImport(srcFile, match[2])
    if (resolved && stubNeeds.has(resolved)) {
      stubNeeds.get(resolved).values.add('__default__:' + name)
    }
  }
}

let updated = 0
for (const [stubFile, needs] of stubNeeds) {
  const fullPath = join(ROOT, stubFile)
  const lines = ['// Auto-generated stub — replace with real implementation']
  let hasDefault = false

  for (const typeName of needs.types) {
    if (!needs.values.has(typeName)) {
      lines.push(`export type ${typeName} = any;`)
    }
  }

  for (const valueName of needs.values) {
    if (valueName.startsWith('__default__:')) {
      hasDefault = true
      continue
    }
    lines.push(`export const ${valueName}: any = (() => {}) as any;`)
  }

  if (hasDefault) {
    lines.push('export default {} as any;')
  }
  if (needs.types.size === 0 && needs.values.size === 0) {
    lines.push('export {};')
  }

  writeFileSync(fullPath, lines.join('\n') + '\n')
  updated++
}

console.log(`Updated ${updated} stub files`)
