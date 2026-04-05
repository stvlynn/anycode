export type ExternalProviderId =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'bedrock'
  | 'vertex'
  | 'foundry'

export type ModelDirectorySource = 'snapshot' | 'cache' | 'remote' | 'custom'

export type ResolvedModel = {
  provider: ExternalProviderId
  id: string
  displayName: string
  family?: string
  source: ModelDirectorySource
  capabilities: {
    toolCalling: boolean
    reasoning: boolean
    attachments: boolean
    json: boolean
    temperature: boolean
  }
  limits: {
    context?: number
    input?: number
    output?: number
  }
  pricing?: {
    input?: number
    output?: number
  }
}

export type ProviderCredentials = {
  apiKey?: string | null
  baseURL?: string | null
}

export type ProviderVerificationResult = {
  ok: boolean
  message?: string
}

export type ProviderInfo = {
  id: string
  name: string
  envVars: string[]
  baseURL: string
}
