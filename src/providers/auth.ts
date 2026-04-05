import { execa } from 'execa'
import { getSettings_DEPRECATED } from '../utils/settings/settings.js'
import type { ExternalProviderId, ProviderCredentials } from './types.js'

const PROVIDER_ENV_KEYS: Record<ExternalProviderId, string[]> = {
  anthropic: ['ANTHROPIC_API_KEY'],
  openai: ['OPENAI_API_KEY'],
  gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
  bedrock: [],
  vertex: [],
  foundry: [],
}

const PROVIDER_BASE_URL_KEYS: Record<ExternalProviderId, string[]> = {
  anthropic: ['ANTHROPIC_BASE_URL'],
  openai: ['OPENAI_BASE_URL'],
  gemini: ['GEMINI_BASE_URL'],
  bedrock: [],
  vertex: [],
  foundry: [],
}

const API_KEY_HELPER_TTL_MS = 5 * 60 * 1000
const providerApiKeyHelperCache = new Map<
  string,
  { value: string; timestamp: number }
>()

function getProviderSettings(provider: string): {
  apiKey?: string
  apiKeyHelper?: string
  baseURL?: string
} | null {
  const settings = (getSettings_DEPRECATED() || {}) as {
    providers?: Record<
      string,
      { apiKey?: string; apiKeyHelper?: string; baseURL?: string }
    >
  }

  return settings.providers?.[provider] ?? null
}

function getProviderApiKeyHelperCached(helperCommand?: string): string | null {
  if (!helperCommand) {
    return null
  }

  const cached = providerApiKeyHelperCache.get(helperCommand)
  if (!cached) {
    return null
  }
  if (Date.now() - cached.timestamp > API_KEY_HELPER_TTL_MS) {
    providerApiKeyHelperCache.delete(helperCommand)
    return null
  }
  return cached.value
}

async function executeProviderApiKeyHelper(
  helperCommand?: string,
): Promise<string | null> {
  if (!helperCommand) {
    return null
  }

  const cached = getProviderApiKeyHelperCached(helperCommand)
  if (cached) {
    return cached
  }

  const result = await execa(helperCommand, {
    shell: true,
    timeout: 10 * 60 * 1000,
    reject: false,
  })
  if (result.failed) {
    return null
  }

  const stdout = result.stdout?.trim()
  if (!stdout) {
    return null
  }

  providerApiKeyHelperCache.set(helperCommand, {
    value: stdout,
    timestamp: Date.now(),
  })
  return stdout
}

export function getProviderCredentials(
  provider: string,
): ProviderCredentials {
  const providerSettings = getProviderSettings(provider)
  const providerEnvKeys = PROVIDER_ENV_KEYS[provider as ExternalProviderId] ?? []
  const providerBaseURLKeys =
    PROVIDER_BASE_URL_KEYS[provider as ExternalProviderId] ?? []
  const apiKey =
    providerEnvKeys.map(key => process.env[key]).find(Boolean) ??
    providerSettings?.apiKey ??
    getProviderApiKeyHelperCached(providerSettings?.apiKeyHelper) ??
    null
  const baseURL =
    providerBaseURLKeys.map(key => process.env[key]).find(Boolean) ??
    providerSettings?.baseURL ??
    null

  return { apiKey, baseURL }
}

export async function resolveProviderCredentials(
  provider: string,
): Promise<ProviderCredentials> {
  const credentials = getProviderCredentials(provider)
  if (credentials.apiKey) {
    return credentials
  }

  const providerSettings = getProviderSettings(provider)
  const apiKey = await executeProviderApiKeyHelper(
    providerSettings?.apiKeyHelper,
  )

  return {
    apiKey: apiKey ?? null,
    baseURL: credentials.baseURL,
  }
}
