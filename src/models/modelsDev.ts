// @ts-nocheck
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { MODELS_DEV_SNAPSHOT } from './modelsSnapshot.js'
import { getClaudeConfigHomeDir, isEnvTruthy } from '../utils/envUtils.js'

export type ModelsDevRawProvider = {
  api?: string
  name: string
  env: string[]
  id: string
  npm?: string
  models: Record<string, ModelsDevRawModel>
}

export type ModelsDevRawModel = {
  id: string
  name: string
  family?: string
  release_date: string
  attachment: boolean
  reasoning: boolean
  temperature: boolean
  tool_call: boolean
  limit: {
    context: number
    input?: number
    output: number
  }
  modalities?: {
    input: Array<'text' | 'audio' | 'image' | 'video' | 'pdf'>
    output: Array<'text' | 'audio' | 'image' | 'video' | 'pdf'>
  }
  cost?: {
    input: number
    output: number
  }
  options: Record<string, unknown>
  headers?: Record<string, string>
  provider?: { npm?: string; api?: string }
}

export type ModelsDevDataset = Record<string, ModelsDevRawProvider>

const DEFAULT_URL = 'https://models.dev/api.json'
const CACHE_PATH = join(getClaudeConfigHomeDir(), 'cache', 'models.dev.json')
const CACHE_TTL_MS = 60 * 60 * 1000

let inMemoryCache: {
  loadedAt: number
  data: ModelsDevDataset
  source: 'snapshot' | 'cache' | 'remote'
} | null = null

function getModelsUrl(): string {
  return process.env.CLAUDE_CODE_MODELS_URL || DEFAULT_URL
}

async function readCacheFile(): Promise<ModelsDevDataset | null> {
  try {
    const raw = await readFile(CACHE_PATH, 'utf8')
    return JSON.parse(raw) as ModelsDevDataset
  } catch {
    return null
  }
}

async function writeCacheFile(data: ModelsDevDataset): Promise<void> {
  await mkdir(dirname(CACHE_PATH), { recursive: true })
  await writeFile(CACHE_PATH, JSON.stringify(data, null, 2), 'utf8')
}

export async function refreshModelsDevCache(): Promise<ModelsDevDataset | null> {
  if (isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_MODELS_FETCH)) {
    return null
  }

  const response = await fetch(getModelsUrl(), {
    headers: { 'User-Agent': 'claude-code-snapshot/models-dev' },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null)
  if (!response?.ok) {
    return null
  }

  const data = (await response.json()) as ModelsDevDataset
  await writeCacheFile(data)
  inMemoryCache = {
    loadedAt: Date.now(),
    data,
    source: 'remote',
  }
  return data
}

export async function getModelsDevDataset(): Promise<{
  data: ModelsDevDataset
  source: 'snapshot' | 'cache' | 'remote'
}> {
  if (inMemoryCache && Date.now() - inMemoryCache.loadedAt < CACHE_TTL_MS) {
    return { data: inMemoryCache.data, source: inMemoryCache.source }
  }

  const cached = await readCacheFile()
  if (cached) {
    inMemoryCache = {
      loadedAt: Date.now(),
      data: cached,
      source: 'cache',
    }
    void refreshModelsDevCache()
    return { data: cached, source: 'cache' }
  }

  inMemoryCache = {
    loadedAt: Date.now(),
    data: MODELS_DEV_SNAPSHOT as ModelsDevDataset,
    source: 'snapshot',
  }
  void refreshModelsDevCache()
  return {
    data: MODELS_DEV_SNAPSHOT as ModelsDevDataset,
    source: 'snapshot',
  }
}
