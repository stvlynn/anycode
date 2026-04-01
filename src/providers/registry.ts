import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import Anthropic from '@anthropic-ai/sdk'
import { getModelsDevDataset } from '../models/modelsDev.js'
import { MODELS_DEV_SNAPSHOT } from '../models/modelsSnapshot.js'
import {
  getDefaultSonnetModel,
  getSmallFastModel,
} from '../utils/model/model.js'
import { getSettings_DEPRECATED } from '../utils/settings/settings.js'
import { getActiveModelProvider } from '../utils/model/providers.js'
import { getProviderCredentials, resolveProviderCredentials } from './auth.js'
import type {
  ExternalProviderId,
  ProviderInfo,
  ProviderVerificationResult,
  ResolvedModel,
} from './types.js'

const PROVIDERS: Record<ExternalProviderId, ProviderInfo> = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    envVars: ['ANTHROPIC_API_KEY'],
    baseURL: 'https://api.anthropic.com/v1',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    envVars: ['OPENAI_API_KEY'],
    baseURL: 'https://api.openai.com/v1',
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    envVars: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    baseURL: 'https://generativelanguage.googleapis.com',
  },
  bedrock: {
    id: 'bedrock',
    name: 'AWS Bedrock',
    envVars: [],
    baseURL: '',
  },
  vertex: {
    id: 'vertex',
    name: 'Google Vertex',
    envVars: [],
    baseURL: '',
  },
  foundry: {
    id: 'foundry',
    name: 'Azure Foundry',
    envVars: [],
    baseURL: '',
  },
}

const ANTHROPIC_ALIASES: Record<string, string> = {
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-6',
  haiku: 'claude-haiku-4-5',
  best: 'claude-opus-4-6',
}

const FAST_PROVIDER_MODELS: Record<ExternalProviderId, string> = {
  anthropic: 'claude-haiku-4-5',
  openai: 'openai/gpt-5-mini',
  gemini: 'gemini/gemini-2.5-flash',
  bedrock: 'claude-haiku-4-5',
  vertex: 'claude-haiku-4-5',
  foundry: 'claude-haiku-4-5',
}

const DEFAULT_PROVIDER_MODELS: Record<ExternalProviderId, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'openai/gpt-5',
  gemini: 'gemini/gemini-2.5-pro',
  bedrock: 'claude-sonnet-4-6',
  vertex: 'claude-sonnet-4-6',
  foundry: 'claude-sonnet-4-6',
}

export function listKnownProviders(): ProviderInfo[] {
  return Object.values(PROVIDERS)
}

export function getFastModelForProvider(provider: ExternalProviderId): string {
  if (
    provider === 'anthropic' ||
    provider === 'bedrock' ||
    provider === 'vertex' ||
    provider === 'foundry'
  ) {
    return getSmallFastModel()
  }
  return FAST_PROVIDER_MODELS[provider]
}

export function getDefaultModelForProvider(
  provider: ExternalProviderId,
): string {
  if (
    provider === 'anthropic' ||
    provider === 'bedrock' ||
    provider === 'vertex' ||
    provider === 'foundry'
  ) {
    return getDefaultSonnetModel()
  }
  return DEFAULT_PROVIDER_MODELS[provider]
}

export function getFastModelForActiveProvider(): string {
  return getFastModelForProvider(getActiveModelProvider())
}

export function getDefaultModelForActiveProvider(): string {
  return getDefaultModelForProvider(getActiveModelProvider())
}

export function isProviderConfigured(provider: ExternalProviderId): boolean {
  const credentials = getProviderCredentials(provider)
  if (credentials.apiKey) {
    return true
  }

  const settings = (getSettings_DEPRECATED() || {}) as {
    model?: string
    providers?: Record<
      string,
      {
        enabled?: boolean
        apiKey?: string
        apiKeyHelper?: string
        defaultModel?: string
      }
    >
  }

  const providerSettings = settings.providers?.[provider]
  if (
    providerSettings?.enabled ||
    providerSettings?.apiKey ||
    providerSettings?.apiKeyHelper ||
    providerSettings?.defaultModel
  ) {
    return true
  }

  if (settings.model?.startsWith(`${provider}/`)) {
    return true
  }

  return getActiveModelProvider() === provider
}

export function getVisibleExternalModelOptions(): Array<{
  provider: ExternalProviderId
  id: string
  name: string
  description: string
}> {
  const providers: ExternalProviderId[] = ['openai', 'gemini']
  return providers.flatMap(provider => {
    if (!isProviderConfigured(provider)) {
      return []
    }

    const snapshot = MODELS_DEV_SNAPSHOT[provider]
    if (!snapshot) {
      return []
    }

    return (Object.values(snapshot.models) as Array<{
      id: string
      name: string
    }>).map(model => ({
      provider,
      id: `${provider}/${model.id}`,
      name: model.name,
      description: `${snapshot.name} provider`,
    }))
  })
}

export function parseProviderModel(input: string): {
  provider: ExternalProviderId
  model: string
} {
  const normalized = input.trim()
  if (!normalized) {
    return { provider: 'anthropic', model: ANTHROPIC_ALIASES.sonnet }
  }

  if (normalized.includes('/')) {
    const [provider, ...rest] = normalized.split('/')
    return {
      provider: provider as ExternalProviderId,
      model: rest.join('/'),
    }
  }

  return {
    provider: 'anthropic',
    model: ANTHROPIC_ALIASES[normalized] ?? normalized,
  }
}

export async function resolveProviderModel(
  input: string,
): Promise<ResolvedModel> {
  const { data, source } = await getModelsDevDataset()
  const parsed = parseProviderModel(input)
  const provider = data[parsed.provider]
  const raw = provider?.models?.[parsed.model]

  if (!raw) {
    return {
      provider: parsed.provider,
      id: parsed.model,
      displayName: parsed.model,
      family: parsed.model.split('-')[0],
      source: 'custom',
      capabilities: {
        toolCalling: true,
        reasoning: true,
        attachments: true,
        json: true,
        temperature: true,
      },
      limits: {},
    }
  }

  return {
    provider: parsed.provider,
    id: raw.id,
    displayName: raw.name,
    family: raw.family,
    source,
    capabilities: {
      toolCalling: raw.tool_call,
      reasoning: raw.reasoning,
      attachments: raw.attachment,
      json: true,
      temperature: raw.temperature,
    },
    limits: {
      context: raw.limit.context,
      input: raw.limit.input,
      output: raw.limit.output,
    },
    pricing: raw.cost,
  }
}

export async function listResolvedModels(): Promise<ResolvedModel[]> {
  const { data, source } = await getModelsDevDataset()
  return Object.entries(data).flatMap(([providerId, provider]) =>
    Object.values(provider.models).map(model => ({
      provider: providerId as ExternalProviderId,
      id: model.id,
      displayName: model.name,
      family: model.family,
      source,
      capabilities: {
        toolCalling: model.tool_call,
        reasoning: model.reasoning,
        attachments: model.attachment,
        json: true,
        temperature: model.temperature,
      },
      limits: {
        context: model.limit.context,
        input: model.limit.input,
        output: model.limit.output,
      },
      pricing: model.cost,
    })),
  )
}

export async function verifyProviderConnection(
  provider: ExternalProviderId,
): Promise<ProviderVerificationResult> {
  const credentials = await resolveProviderCredentials(provider)
  if (provider === 'anthropic') {
    if (!credentials.apiKey) {
      return { ok: false, message: 'Missing ANTHROPIC_API_KEY' }
    }
    try {
      const client = new Anthropic({
        apiKey: credentials.apiKey,
        baseURL: credentials.baseURL || undefined,
      })
      await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      })
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      }
    }
  }

  if (provider === 'openai') {
    if (!credentials.apiKey) {
      return { ok: false, message: 'Missing OPENAI_API_KEY' }
    }
    try {
      const sdk = createOpenAI({
        apiKey: credentials.apiKey,
        baseURL: credentials.baseURL || undefined,
      })
      await sdk.responses('gpt-5').doGenerate({
        inputFormat: 'messages',
        mode: { type: 'regular' },
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'ping' }] }],
      } as never)
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      }
    }
  }

  if (provider === 'gemini') {
    if (!credentials.apiKey) {
      return { ok: false, message: 'Missing GEMINI_API_KEY or GOOGLE_API_KEY' }
    }
    try {
      const sdk = createGoogleGenerativeAI({
        apiKey: credentials.apiKey,
        baseURL: credentials.baseURL || undefined,
      })
      await sdk('gemini-2.5-flash').doGenerate({
        inputFormat: 'messages',
        mode: { type: 'regular' },
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'ping' }] }],
      } as never)
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      }
    }
  }

  return {
    ok: false,
    message: `${provider} verification is not implemented in the public snapshot`,
  }
}
