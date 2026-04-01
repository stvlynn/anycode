// @ts-nocheck
import { APIUserAbortError } from '@anthropic-ai/sdk/error'
import type {
  BetaJSONOutputFormat,
  BetaToolUnion,
} from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText, streamText } from 'ai'
import { randomUUID } from 'crypto'
import type { ClientOptions } from '@anthropic-ai/sdk'
import { getCLISyspromptPrefix } from 'src/constants/system.js'
import { addToTotalSessionCost, setHasUnknownModelCost } from 'src/cost-tracker.js'
import { logEvent } from 'src/services/analytics/index.js'
import { resolveProviderCredentials } from 'src/providers/auth.js'
import {
  getActiveModelProvider,
  isAnthropicLikeModelName,
} from 'src/utils/model/providers.js'
import type { QuerySource } from 'src/constants/querySource.js'
import type { SystemPrompt } from 'src/utils/systemPromptType.js'
import type { ThinkingConfig } from 'src/utils/thinking.js'
import {
  normalizeMessagesForAPI,
  ensureToolResultPairing,
  stripCallerFieldFromAssistantMessage,
  stripToolReferenceBlocksFromUserMessage,
} from 'src/utils/messages.js'
import { getModelMaxOutputTokens } from 'src/utils/context.js'
import { calculateUSDCost } from 'src/utils/modelCost.js'
import { errorMessage } from 'src/utils/errors.js'
import type { Message, AssistantMessage, SystemAPIErrorMessage } from 'src/types/message.js'
import type { Tool, Tools, ToolPermissionContext, QueryChainTracking } from 'src/Tool.js'
import type { AgentDefinition } from 'src/tools/AgentTool/loadAgentsDir.js'
import { toolToAPISchema } from 'src/utils/api.js'
import { EMPTY_USAGE } from './emptyUsage.js'
import { getAssistantMessageFromError } from './errors.js'

type ExternalProviderId = 'openai' | 'gemini'

type QueryOptions = {
  getToolPermissionContext: () => Promise<ToolPermissionContext>
  model: string
  toolChoice?: { type?: string; name?: string } | undefined
  isNonInteractiveSession: boolean
  extraToolSchemas?: BetaToolUnion[]
  maxOutputTokensOverride?: number
  querySource: QuerySource
  agents: AgentDefinition[]
  allowedAgentTypes?: string[]
  hasAppendSystemPrompt: boolean
  fetchOverride?: ClientOptions['fetch']
  temperatureOverride?: number
  mcpTools: Tools
  queryTracking?: QueryChainTracking
  outputFormat?: BetaJSONOutputFormat
  agentId?: string
}

type MainQueryArgs = {
  messages: Message[]
  systemPrompt: SystemPrompt
  thinkingConfig: ThinkingConfig
  tools: Tools
  signal: AbortSignal
  options: QueryOptions
}

type SideQueryArgs = {
  model: string
  system?: string | Array<{ type: 'text'; text: string }>
  messages: Array<{
    role: 'user' | 'assistant'
    content: string | Array<Record<string, unknown>>
  }>
  tools?: Array<Record<string, unknown>> | BetaToolUnion[]
  tool_choice?: { type?: string; name?: string }
  output_format?: BetaJSONOutputFormat
  max_tokens?: number
  signal?: AbortSignal
  skipSystemPromptPrefix?: boolean
  temperature?: number
  stop_sequences?: string[]
  querySource: QuerySource
}

const EXTERNAL_PROVIDERS = new Set<ExternalProviderId>(['openai', 'gemini'])
const STRUCTURED_OUTPUT_TOOL = '__structured_output__'
const SEARCH_TOOL_NAME = 'web_search'

type ExternalCostConfig = {
  inputTokens: number
  outputTokens: number
  promptCacheReadTokens?: number
  promptCacheWriteTokens?: number
  webSearchRequests?: number
  over200k?: Partial<Omit<ExternalCostConfig, 'over200k'>>
}

const EXTERNAL_MODEL_COSTS: Record<string, ExternalCostConfig> = {
  'openai/gpt-5': {
    inputTokens: 1.25,
    outputTokens: 10,
    promptCacheReadTokens: 0.125,
  },
  'openai/gpt-5-mini': {
    inputTokens: 0.25,
    outputTokens: 2,
    promptCacheReadTokens: 0.025,
  },
  'openai/gpt-5-nano': {
    inputTokens: 0.05,
    outputTokens: 0.4,
    promptCacheReadTokens: 0.005,
  },
  'gemini/gemini-2.5-pro': {
    inputTokens: 1.25,
    outputTokens: 10,
    promptCacheReadTokens: 0.125,
    promptCacheWriteTokens: 0.125,
    webSearchRequests: 0.035,
    over200k: {
      inputTokens: 2.5,
      outputTokens: 15,
      promptCacheReadTokens: 0.25,
      promptCacheWriteTokens: 0.25,
    },
  },
  'gemini/gemini-2.5-flash': {
    inputTokens: 0.3,
    outputTokens: 2.5,
    promptCacheReadTokens: 0.03,
    promptCacheWriteTokens: 0.03,
    webSearchRequests: 0.035,
  },
}

export function resolveExternalProviderModel(
  model: string,
): { provider: ExternalProviderId; modelId: string } | null {
  const trimmed = model.trim()
  if (!trimmed) {
    return null
  }

  if (trimmed.includes('/')) {
    const [provider, ...rest] = trimmed.split('/')
    if (EXTERNAL_PROVIDERS.has(provider as ExternalProviderId)) {
      return {
        provider: provider as ExternalProviderId,
        modelId: stripContextSuffix(rest.join('/')),
      }
    }
    return null
  }

  const activeProvider = getActiveModelProvider()
  if (!EXTERNAL_PROVIDERS.has(activeProvider as ExternalProviderId)) {
    return null
  }

  const modelId = stripContextSuffix(trimmed)
  if (isAnthropicLikeModelName(modelId)) {
    return null
  }

  return {
    provider: activeProvider as ExternalProviderId,
    modelId,
  }
}

export function getFastModelForExternalProvider(
  provider: ExternalProviderId,
): string {
  return provider === 'openai'
    ? 'openai/gpt-5-mini'
    : 'gemini/gemini-2.5-flash'
}

export function getDefaultModelForExternalProvider(
  provider: ExternalProviderId,
): string {
  return provider === 'openai' ? 'openai/gpt-5' : 'gemini/gemini-2.5-pro'
}

function stripContextSuffix(model: string): string {
  return model.replace(/\[(1|2)m\]/gi, '').trim()
}

async function createExternalProviderResources(route: {
  provider: ExternalProviderId
  modelId: string
}) {
  const credentials = await resolveProviderCredentials(route.provider)
  if (!credentials.apiKey) {
    const missingVar =
      route.provider === 'openai'
        ? 'OPENAI_API_KEY'
        : 'GEMINI_API_KEY or GOOGLE_API_KEY'
    throw new Error(`Missing ${missingVar}`)
  }

  if (route.provider === 'openai') {
    const sdk = createOpenAI({
      apiKey: credentials.apiKey,
      baseURL: credentials.baseURL || undefined,
    })
    return {
      languageModel: sdk.responses(route.modelId),
      providerTools: sdk.tools,
    }
  }

  const sdk = createGoogleGenerativeAI({
    apiKey: credentials.apiKey,
    baseURL: credentials.baseURL || undefined,
  })
  return {
    languageModel: sdk(route.modelId),
    providerTools: sdk.tools,
  }
}

function buildSystemPromptText(
  systemPrompt: SystemPrompt,
  isNonInteractiveSession: boolean,
  hasAppendSystemPrompt: boolean,
): string | undefined {
  const parts = [
    getCLISyspromptPrefix({
      isNonInteractive: isNonInteractiveSession,
      hasAppendSystemPrompt,
    }),
    ...systemPrompt,
  ].filter(Boolean)

  return parts.length > 0 ? parts.join('\n\n') : undefined
}

function buildSideQuerySystemText({
  system,
  skipSystemPromptPrefix,
}: {
  system?: string | Array<{ type: 'text'; text: string }>
  skipSystemPromptPrefix?: boolean
}): string | undefined {
  const parts = [
    ...(skipSystemPromptPrefix
      ? []
      : [
          getCLISyspromptPrefix({
            isNonInteractive: false,
            hasAppendSystemPrompt: false,
          }),
        ]),
    ...(Array.isArray(system)
      ? system.map(block => block.text)
      : system
        ? [system]
        : []),
  ].filter(Boolean)

  return parts.length > 0 ? parts.join('\n\n') : undefined
}

async function buildMainToolSet({
  tools,
  options,
}: {
  tools: Tools
  options: QueryOptions
}) {
  const schemas = await Promise.all(
    tools.map(tool =>
      toolToAPISchema(tool, {
        getToolPermissionContext: options.getToolPermissionContext,
        tools,
        agents: options.agents,
        allowedAgentTypes: options.allowedAgentTypes,
        model: options.model,
      }),
    ),
  )

  return buildExternalToolSetFromSchemas(schemas)
}

function buildSideQueryToolSet(
  tools: Array<Record<string, unknown>> | BetaToolUnion[] | undefined,
) {
  return buildExternalToolSetFromSchemas(tools ?? [])
}

function buildStructuredOutputTool(outputFormat: BetaJSONOutputFormat) {
  if (outputFormat?.type !== 'json_schema') {
    return null
  }

  return {
    [STRUCTURED_OUTPUT_TOOL]: {
      description:
        'Return the final response as JSON matching the provided schema.',
      inputSchema: outputFormat.schema,
    },
  }
}

function buildProviderToolFromSchema({
  schema,
  provider,
  providerTools,
}: {
  schema: Record<string, unknown>
  provider: ExternalProviderId
  providerTools?: Record<string, (...args: unknown[]) => unknown>
}) {
  if (
    schema.type === 'web_search_20250305' &&
    schema.name === SEARCH_TOOL_NAME
  ) {
    if (provider === 'openai' && providerTools?.webSearch) {
      return {
        name: SEARCH_TOOL_NAME,
        tool: providerTools.webSearch({
          ...(Array.isArray(schema.allowed_domains) &&
          schema.allowed_domains.length > 0
            ? {
                filters: {
                  allowedDomains: schema.allowed_domains,
                },
              }
            : {}),
          externalWebAccess: true,
        }),
      }
    }

    if (provider === 'gemini' && providerTools?.googleSearch) {
      return {
        name: SEARCH_TOOL_NAME,
        tool: providerTools.googleSearch({
          searchTypes: { webSearch: {} },
        }),
      }
    }
  }

  return null
}

function buildExternalToolSetFromSchemas(
  schemas: Array<Record<string, unknown>>,
  options?: {
    provider?: ExternalProviderId
    providerTools?: Record<string, (...args: unknown[]) => unknown>
  },
): Record<string, { description?: string; inputSchema: unknown }> {
  const toolSet: Record<string, { description?: string; inputSchema: unknown }> =
    {}

  for (const schema of schemas) {
    const name = typeof schema?.name === 'string' ? schema.name : null
    if (!name) {
      continue
    }

    const providerTool = options?.provider
      ? buildProviderToolFromSchema({
          schema,
          provider: options.provider,
          providerTools: options.providerTools,
        })
      : null
    if (providerTool) {
      toolSet[providerTool.name] = providerTool.tool as never
      continue
    }

    const inputSchema =
      schema.input_schema ??
      schema.inputSchema ??
      schema.parameters ??
      schema.schema ??
      null
    if (!inputSchema) {
      continue
    }
    toolSet[name] = {
      description:
        typeof schema.description === 'string' ? schema.description : undefined,
      inputSchema,
    }
  }

  return toolSet
}

function convertToolChoice(toolChoice: { type?: string; name?: string } | undefined) {
  if (!toolChoice) {
    return undefined
  }
  if (toolChoice.type === 'tool' && toolChoice.name) {
    return {
      type: 'tool' as const,
      toolName: toolChoice.name,
    }
  }
  if (toolChoice.type === 'any') {
    return 'required'
  }
  if (toolChoice.type === 'auto') {
    return 'auto'
  }
  return undefined
}

function isSearchToolName(toolName: string | undefined): boolean {
  return toolName === SEARCH_TOOL_NAME || toolName === 'google_search'
}

function convertToolResultValue(content: unknown): unknown {
  if (typeof content === 'string') {
    return content
  }
  if (!Array.isArray(content)) {
    return content
  }

  const text = content
    .filter(
      block =>
        block &&
        typeof block === 'object' &&
        'type' in block &&
        block.type === 'text' &&
        typeof block.text === 'string',
    )
    .map(block => block.text)
    .join('\n')

  if (text) {
    return text
  }

  return content.map(block => convertUnknownBlockToText(block))
}

function mergeSearchHits(
  existing: Array<{ title: string; url: string }>,
  next: Array<{ title: string; url: string }>,
) {
  const seen = new Set(existing.map(hit => hit.url))
  for (const hit of next) {
    if (!seen.has(hit.url)) {
      existing.push(hit)
      seen.add(hit.url)
    }
  }
}

function normalizeSearchHits(
  sources: unknown,
): Array<{ title: string; url: string }> {
  if (!Array.isArray(sources)) {
    return []
  }

  return sources
    .map(source => {
      if (!source || typeof source !== 'object') {
        return null
      }
      const url =
        (typeof source.url === 'string' && source.url) ||
        (typeof source.uri === 'string' && source.uri) ||
        null
      if (!url) {
        return null
      }
      const title =
        (typeof source.title === 'string' && source.title) ||
        (typeof source.label === 'string' && source.label) ||
        url
      return { title, url }
    })
    .filter((hit): hit is { title: string; url: string } => hit !== null)
}

function extractSearchHitsFromToolOutput(
  output: unknown,
): Array<{ title: string; url: string }> {
  if (!output || typeof output !== 'object') {
    return []
  }

  const directSources =
    'sources' in output ? normalizeSearchHits(output.sources) : []
  if (directSources.length > 0) {
    return directSources
  }

  if (
    'action' in output &&
    output.action &&
    typeof output.action === 'object' &&
    'sources' in output.action
  ) {
    return normalizeSearchHits(output.action.sources)
  }

  return []
}

function normalizeSourceToSearchHit(
  source: Record<string, unknown>,
): { title: string; url: string } | null {
  if (source.sourceType !== 'url' || typeof source.url !== 'string') {
    return null
  }
  return {
    title:
      (typeof source.title === 'string' && source.title) || source.url,
    url: source.url,
  }
}

function convertUnknownBlockToText(block: unknown): string {
  if (!block || typeof block !== 'object') {
    return String(block ?? '')
  }
  if ('text' in block && typeof block.text === 'string') {
    return block.text
  }
  if ('thinking' in block && typeof block.thinking === 'string') {
    return block.thinking
  }
  try {
    return JSON.stringify(block)
  } catch {
    return String(block)
  }
}

function imageDataFromBlock(block: Record<string, unknown>) {
  const source = block.source as Record<string, unknown> | undefined
  const mediaType =
    (source?.media_type as string | undefined) ??
    (block.media_type as string | undefined)
  const data =
    (source?.data as string | undefined) ?? (block.data as string | undefined)
  if (!data) {
    return null
  }
  return mediaType ? `data:${mediaType};base64,${data}` : data
}

function fileDataFromBlock(block: Record<string, unknown>) {
  const source = block.source as Record<string, unknown> | undefined
  const mediaType =
    (source?.media_type as string | undefined) ??
    (block.media_type as string | undefined) ??
    'application/octet-stream'
  const data =
    (source?.data as string | undefined) ?? (block.data as string | undefined)
  if (!data) {
    return null
  }
  return {
    data: `data:${mediaType};base64,${data}`,
    mediaType,
    filename:
      (block.filename as string | undefined) ??
      (source?.filename as string | undefined),
  }
}

function convertAnthropicContentBlockToModelPart(
  block: Record<string, unknown>,
  role: 'user' | 'assistant',
  toolNamesById: Map<string, string>,
) {
  switch (block.type) {
    case 'text':
      return { type: 'text', text: block.text ?? '' }
    case 'image': {
      const image = imageDataFromBlock(block)
      return image ? { type: 'image', image } : null
    }
    case 'document': {
      const file = fileDataFromBlock(block)
      return file ? { type: 'file', ...file } : null
    }
    case 'thinking':
      if (role !== 'assistant') return null
      return { type: 'reasoning', text: block.thinking ?? '' }
    case 'redacted_thinking':
      if (role !== 'assistant') return null
      return null
    case 'tool_use':
      if (role !== 'assistant') return null
      if (typeof block.id === 'string' && typeof block.name === 'string') {
        toolNamesById.set(block.id, block.name)
      }
      return {
        type: 'tool-call',
        toolCallId:
          (typeof block.id === 'string' && block.id) || randomUUID(),
        toolName: String(block.name ?? 'tool'),
        input:
          block.input && typeof block.input === 'object' ? block.input : {},
      }
    default:
      return {
        type: 'text',
        text: convertUnknownBlockToText(block),
      }
  }
}

function convertAnthropicMessagesToModelMessages(
  messages: Array<{ role: string; content: unknown }>,
) {
  const modelMessages: Array<Record<string, unknown>> = []
  const toolNamesById = new Map<string, string>()

  for (const message of messages) {
    if (message.role === 'system') {
      if (typeof message.content === 'string') {
        modelMessages.push({ role: 'system', content: message.content })
      }
      continue
    }

    if (message.role !== 'user' && message.role !== 'assistant') {
      continue
    }

    if (typeof message.content === 'string') {
      modelMessages.push({ role: message.role, content: message.content })
      continue
    }

    if (!Array.isArray(message.content)) {
      continue
    }

    const blocks = message.content as Array<Record<string, unknown>>
    const toolResults = blocks.filter(block => block.type === 'tool_result')
    const nonToolResults = blocks.filter(block => block.type !== 'tool_result')

    if (nonToolResults.length > 0) {
      const parts = nonToolResults
        .map(block =>
          convertAnthropicContentBlockToModelPart(
            block,
            message.role as 'user' | 'assistant',
            toolNamesById,
          ),
        )
        .filter(Boolean)

      if (parts.length > 0) {
        modelMessages.push({
          role: message.role,
          content: parts,
        })
      }
    }

    if (toolResults.length > 0) {
      modelMessages.push({
        role: 'tool',
        content: toolResults.map(block => ({
          type: 'tool-result',
          toolCallId:
            (typeof block.tool_use_id === 'string' && block.tool_use_id) ||
            randomUUID(),
          toolName:
            (typeof block.tool_use_id === 'string' &&
              toolNamesById.get(block.tool_use_id)) ||
            'tool',
          result: convertToolResultValue(block.content),
          ...(block.is_error === true ? { isError: true } : {}),
        })),
      })
    }
  }

  return modelMessages
}

function convertContentPartsToAnthropicBlocks(
  content: Array<Record<string, unknown>>,
) {
  const blocks: Array<Record<string, unknown>> = []
  for (const part of content) {
    switch (part.type) {
      case 'text':
        blocks.push({ type: 'text', text: part.text ?? '' })
        break
      case 'reasoning':
        blocks.push({ type: 'thinking', thinking: part.text ?? '' })
        break
      case 'tool-call':
        blocks.push({
          type: 'tool_use',
          id: part.toolCallId ?? randomUUID(),
          name: part.toolName ?? 'tool',
          input:
            part.input && typeof part.input === 'object' ? part.input : {},
        })
        break
    }
  }
  return blocks
}

function convertLanguageUsageToAnthropicUsage(
  usage: Record<string, unknown> | undefined,
) {
  if (!usage) {
    return { ...EMPTY_USAGE }
  }

  return {
    ...EMPTY_USAGE,
    input_tokens: usage.inputTokens ?? 0,
    cache_creation_input_tokens:
      usage.inputTokenDetails?.cacheWriteTokens ??
      usage.cacheCreationInputTokens ??
      0,
    cache_read_input_tokens:
      usage.inputTokenDetails?.cacheReadTokens ?? usage.cachedInputTokens ?? 0,
    output_tokens: usage.outputTokens ?? 0,
  }
}

function mapFinishReason(finishReason: string | undefined): string | null {
  switch (finishReason) {
    case 'tool-calls':
      return 'tool_use'
    case 'length':
      return 'max_tokens'
    case 'content-filter':
      return 'content_filter'
    case 'stop':
      return 'end_turn'
    default:
      return null
  }
}

function buildAssistantMessage({
  content,
  model,
  usage,
  stopReason,
  requestId,
  messageId,
}: {
  content: Array<Record<string, unknown>>
  model: string
  usage?: Record<string, unknown>
  stopReason?: string | null
  requestId?: string
  messageId?: string
}): AssistantMessage {
  return {
    type: 'assistant',
    uuid: randomUUID(),
    requestId,
    timestamp: new Date().toISOString(),
    message: {
      id: messageId ?? randomUUID(),
      role: 'assistant',
      model,
      content,
      stop_reason: stopReason ?? null,
      usage: usage ?? { ...EMPTY_USAGE },
    },
  }
}

function calculateExternalProviderUSDCost(
  model: string,
  usage: Record<string, unknown>,
): number | null {
  const config = EXTERNAL_MODEL_COSTS[model]
  if (!config) {
    return null
  }

  const promptTokens =
    (usage.input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0)
  const effective =
    config.over200k && promptTokens > 200_000
      ? { ...config, ...config.over200k }
      : config

  return (
    ((usage.input_tokens ?? 0) / 1_000_000) * effective.inputTokens +
    ((usage.output_tokens ?? 0) / 1_000_000) * effective.outputTokens +
    (((usage.cache_read_input_tokens ?? 0) / 1_000_000) *
      (effective.promptCacheReadTokens ?? 0)) +
    (((usage.cache_creation_input_tokens ?? 0) / 1_000_000) *
      (effective.promptCacheWriteTokens ?? 0)) +
    ((usage.server_tool_use?.web_search_requests ?? 0) *
      (effective.webSearchRequests ?? 0))
  )
}

async function maybeAddCost(model: string, usage: Record<string, unknown>) {
  const externalCost = calculateExternalProviderUSDCost(model, usage)
  if (externalCost !== null) {
    addToTotalSessionCost(externalCost, usage as never, model)
    return
  }

  if (resolveExternalProviderModel(model)) {
    setHasUnknownModelCost()
    return
  }

  try {
    const cost = calculateUSDCost(model, usage as never)
    addToTotalSessionCost(cost, usage as never, model)
  } catch {
    setHasUnknownModelCost()
  }
}

async function prepareMainPrompt(
  args: MainQueryArgs,
  provider: ExternalProviderId,
  providerTools?: Record<string, (...args: unknown[]) => unknown>,
) {
  const toolSet = await buildMainToolSet({
    tools: args.tools,
    options: args.options,
  })
  const extraToolSet = buildExternalToolSetFromSchemas(
    (args.options.extraToolSchemas ?? []) as Array<Record<string, unknown>>,
    { provider, providerTools },
  )

  let messagesForAPI = normalizeMessagesForAPI(args.messages, args.tools)
  messagesForAPI = messagesForAPI.map(message => {
    switch (message.type) {
      case 'user':
        return stripToolReferenceBlocksFromUserMessage(message)
      case 'assistant':
        return stripCallerFieldFromAssistantMessage(message)
      default:
        return message
    }
  })
  messagesForAPI = ensureToolResultPairing(messagesForAPI)

  const modelMessages = convertAnthropicMessagesToModelMessages(
    messagesForAPI as Array<{ role: string; content: unknown }>,
  )

  const system = buildSystemPromptText(
    args.systemPrompt,
    args.options.isNonInteractiveSession,
    args.options.hasAppendSystemPrompt,
  )

  return {
    toolSet: { ...toolSet, ...extraToolSet },
    modelMessages,
    system,
  }
}

function buildStructuredOutputPayload(
  toolCalls: Array<Record<string, unknown>>,
): string | null {
  const toolCall = toolCalls.find(call => call.toolName === STRUCTURED_OUTPUT_TOOL)
  if (!toolCall || typeof toolCall.input !== 'object' || toolCall.input === null) {
    return null
  }
  return JSON.stringify(toolCall.input)
}

function getGenerationSettings({
  model,
  signal,
  maxOutputTokens,
  temperature,
  toolChoice,
  stopSequences,
}: {
  model: unknown
  signal: AbortSignal | undefined
  maxOutputTokens: number | undefined
  temperature: number | undefined
  toolChoice: unknown
  stopSequences?: string[]
}) {
  return {
    model,
    abortSignal: signal,
    ...(maxOutputTokens ? { maxOutputTokens } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
    ...(toolChoice ? { toolChoice } : {}),
    ...(stopSequences?.length ? { stopSequences } : {}),
  }
}

export async function queryExternalModelWithoutStreaming(
  args: MainQueryArgs,
): Promise<AssistantMessage> {
  const route = resolveExternalProviderModel(args.options.model)
  if (!route) {
    throw new Error(`Model ${args.options.model} is not routed to an external provider`)
  }

  const resources = await createExternalProviderResources(route)
  const prepared = await prepareMainPrompt(
    args,
    route.provider,
    resources.providerTools,
  )
  let toolSet = prepared.toolSet
  let toolChoice = convertToolChoice(args.options.toolChoice)
  let useStructuredOutputAsText = false

  if (
    args.options.outputFormat?.type === 'json_schema' &&
    Object.keys(toolSet).length === 0
  ) {
    toolSet = {
      ...toolSet,
      ...buildStructuredOutputTool(args.options.outputFormat),
    }
    toolChoice = { type: 'tool', toolName: STRUCTURED_OUTPUT_TOOL }
    useStructuredOutputAsText = true
  }

  const maxOutputTokens =
    args.options.maxOutputTokensOverride ??
    getModelMaxOutputTokens(args.options.model).default

  try {
    const result = await generateText({
      ...getGenerationSettings({
        model: resources.languageModel,
        signal: args.signal,
        maxOutputTokens,
        temperature: args.options.temperatureOverride,
        toolChoice,
      }),
      system: prepared.system,
      messages: prepared.modelMessages,
      ...(Object.keys(toolSet).length > 0 ? { tools: toolSet } : {}),
    })

    const usage = convertLanguageUsageToAnthropicUsage(result.usage)
    const searchToolResults = result.toolResults.filter(
      toolResult =>
        toolResult.providerExecuted && isSearchToolName(toolResult.toolName),
    )
    if (searchToolResults.length > 0) {
      usage.server_tool_use = {
        ...usage.server_tool_use,
        web_search_requests: searchToolResults.length,
      }
    }
    await maybeAddCost(args.options.model, usage)
    const requestId = result.response?.id

    const content = useStructuredOutputAsText
      ? [
          {
            type: 'text',
            text: buildStructuredOutputPayload(result.toolCalls) ?? result.text,
          },
        ]
      : convertContentPartsToAnthropicBlocks(result.content)

    const assistant = buildAssistantMessage({
      content:
        content.length > 0
          ? content
          : [{ type: 'text', text: result.text ?? '' }],
      model: args.options.model,
      usage,
      stopReason: useStructuredOutputAsText
        ? 'end_turn'
        : mapFinishReason(result.finishReason),
      requestId,
      messageId: requestId ?? randomUUID(),
    })

    return assistant
  } catch (error) {
    if (error instanceof APIUserAbortError || args.signal.aborted) {
      throw new APIUserAbortError()
    }
    throw error
  }
}

export async function* queryExternalModelWithStreaming(
  args: MainQueryArgs,
): AsyncGenerator<
  | { type: 'stream_event'; event: Record<string, unknown>; ttftMs?: number }
  | AssistantMessage
  | SystemAPIErrorMessage,
  void
> {
  if (args.options.outputFormat?.type === 'json_schema' && args.tools.length === 0) {
    const assistant = await queryExternalModelWithoutStreaming(args)
    yield assistant
    return
  }

  const route = resolveExternalProviderModel(args.options.model)
  if (!route) {
    yield getAssistantMessageFromError(
      new Error(`Model ${args.options.model} is not routed to an external provider`),
      args.options.model,
      { messages: args.messages, messagesForAPI: [] },
    )
    return
  }

  const startTime = Date.now()

  try {
    const resources = await createExternalProviderResources(route)
    const prepared = await prepareMainPrompt(
      args,
      route.provider,
      resources.providerTools,
    )
    const maxOutputTokens =
      args.options.maxOutputTokensOverride ??
      getModelMaxOutputTokens(args.options.model).default
    const toolChoice = convertToolChoice(args.options.toolChoice)
    const stream = streamText({
      ...getGenerationSettings({
        model: resources.languageModel,
        signal: args.signal,
        maxOutputTokens,
        temperature: args.options.temperatureOverride,
        toolChoice,
      }),
      system: prepared.system,
      messages: prepared.modelMessages,
      ...(Object.keys(prepared.toolSet).length > 0
        ? { tools: prepared.toolSet }
        : {}),
    })

    const messageId = randomUUID()
    const yieldedMessages: AssistantMessage[] = []
    const blocks = new Map<
      string,
      {
        index: number
        type: 'text' | 'thinking' | 'tool_use'
        text?: string
        thinking?: string
        toolName?: string
        partialInput?: string
        input?: Record<string, unknown>
      }
    >()
    let nextIndex = 0
    let emittedStart = false
    let finalUsage = { ...EMPTY_USAGE }
    let requestId: string | undefined
    let searchRequestCount = 0
    let lastSearchToolUseId: string | undefined
    const searchHits: Array<{ title: string; url: string }> = []
    const emittedSearchResultToolUseIds = new Set<string>()

    const emitMessageStart = () => ({
      type: 'stream_event' as const,
      ttftMs: Date.now() - startTime,
      event: {
        type: 'message_start',
        message: {
          id: messageId,
          role: 'assistant',
          model: args.options.model,
          content: [],
          stop_reason: null,
          usage: { ...EMPTY_USAGE },
        },
      },
    })

    for await (const part of stream.fullStream) {
      if (!emittedStart && part.type !== 'error') {
        emittedStart = true
        yield emitMessageStart()
      }

      switch (part.type) {
        case 'text-start': {
          blocks.set(part.id, {
            index: nextIndex++,
            type: 'text',
            text: '',
          })
          yield {
            type: 'stream_event',
            event: {
              type: 'content_block_start',
              index: blocks.get(part.id)!.index,
              content_block: { type: 'text', text: '' },
            },
          }
          break
        }
        case 'text-delta': {
          const block = blocks.get(part.id)
          if (!block) break
          block.text = (block.text ?? '') + part.text
          yield {
            type: 'stream_event',
            event: {
              type: 'content_block_delta',
              index: block.index,
              delta: { type: 'text_delta', text: part.text },
            },
          }
          break
        }
        case 'text-end': {
          const block = blocks.get(part.id)
          if (!block) break
          yield {
            type: 'stream_event',
            event: {
              type: 'content_block_stop',
              index: block.index,
            },
          }
          const assistant = buildAssistantMessage({
            content: [{ type: 'text', text: block.text ?? '' }],
            model: args.options.model,
            usage: { ...EMPTY_USAGE },
            requestId,
            messageId,
          })
          yieldedMessages.push(assistant)
          yield assistant
          break
        }
        case 'reasoning-start': {
          blocks.set(part.id, {
            index: nextIndex++,
            type: 'thinking',
            thinking: '',
          })
          yield {
            type: 'stream_event',
            event: {
              type: 'content_block_start',
              index: blocks.get(part.id)!.index,
              content_block: { type: 'thinking', thinking: '' },
            },
          }
          break
        }
        case 'reasoning-delta': {
          const block = blocks.get(part.id)
          if (!block) break
          block.thinking = (block.thinking ?? '') + part.text
          yield {
            type: 'stream_event',
            event: {
              type: 'content_block_delta',
              index: block.index,
              delta: { type: 'thinking_delta', thinking: part.text },
            },
          }
          break
        }
        case 'reasoning-end': {
          const block = blocks.get(part.id)
          if (!block) break
          yield {
            type: 'stream_event',
            event: {
              type: 'content_block_stop',
              index: block.index,
            },
          }
          const assistant = buildAssistantMessage({
            content: [{ type: 'thinking', thinking: block.thinking ?? '' }],
            model: args.options.model,
            usage: { ...EMPTY_USAGE },
            requestId,
            messageId,
          })
          yieldedMessages.push(assistant)
          yield assistant
          break
        }
        case 'tool-input-start': {
          blocks.set(part.id, {
            index: nextIndex++,
            type: 'tool_use',
            toolName: part.toolName,
            partialInput: '',
            input: {},
          })
          yield {
            type: 'stream_event',
            event: {
              type: 'content_block_start',
              index: blocks.get(part.id)!.index,
              content_block: {
                type: 'tool_use',
                id: part.id,
                name: part.toolName,
                input: {},
              },
            },
          }
          break
        }
        case 'tool-input-delta': {
          const block = blocks.get(part.id)
          if (!block) break
          block.partialInput = (block.partialInput ?? '') + part.delta
          yield {
            type: 'stream_event',
            event: {
              type: 'content_block_delta',
              index: block.index,
              delta: {
                type: 'input_json_delta',
                partial_json: part.delta,
              },
            },
          }
          break
        }
        case 'tool-call': {
          if (part.providerExecuted && isSearchToolName(part.toolName)) {
            searchRequestCount++
            lastSearchToolUseId = part.toolCallId
            const searchInput =
              part.input && typeof part.input === 'object' ? part.input : {}
            const partialJson = JSON.stringify(searchInput)

            yield {
              type: 'stream_event',
              event: {
                type: 'content_block_start',
                index: nextIndex++,
                content_block: {
                  type: 'server_tool_use',
                  id: part.toolCallId,
                  name: SEARCH_TOOL_NAME,
                  input: {},
                },
              },
            }
            if (partialJson && partialJson !== '{}') {
              yield {
                type: 'stream_event',
                event: {
                  type: 'content_block_delta',
                  index: nextIndex - 1,
                  delta: {
                    type: 'input_json_delta',
                    partial_json: partialJson,
                  },
                },
              }
            }
            yield {
              type: 'stream_event',
              event: {
                type: 'content_block_stop',
                index: nextIndex - 1,
              },
            }

            const assistant = buildAssistantMessage({
              content: [
                {
                  type: 'server_tool_use',
                  id: part.toolCallId,
                  name: SEARCH_TOOL_NAME,
                  input: searchInput,
                },
              ],
              model: args.options.model,
              usage: { ...EMPTY_USAGE },
              requestId,
              messageId,
            })
            yieldedMessages.push(assistant)
            yield assistant
            break
          }

          const existing = blocks.get(part.toolCallId)
          const block =
            existing ??
            (() => {
              const next = {
                index: nextIndex++,
                type: 'tool_use' as const,
                toolName: part.toolName,
                partialInput: '',
                input: part.input ?? {},
              }
              blocks.set(part.toolCallId, next)
              return next
            })()

          block.input =
            part.input && typeof part.input === 'object' ? part.input : {}

          if (!existing) {
            yield {
              type: 'stream_event',
              event: {
                type: 'content_block_start',
                index: block.index,
                content_block: {
                  type: 'tool_use',
                  id: part.toolCallId,
                  name: part.toolName,
                  input: {},
                },
              },
            }
          }

          yield {
            type: 'stream_event',
            event: {
              type: 'content_block_stop',
              index: block.index,
            },
          }

          const assistant = buildAssistantMessage({
            content: [
              {
                type: 'tool_use',
                id: part.toolCallId,
                name: part.toolName,
                input: block.input,
              },
            ],
            model: args.options.model,
            usage: { ...EMPTY_USAGE },
            requestId,
            messageId,
          })
          yieldedMessages.push(assistant)
          yield assistant
          break
        }
        case 'source': {
          const hit = normalizeSourceToSearchHit(part as Record<string, unknown>)
          if (hit) {
            mergeSearchHits(searchHits, [hit])
          }
          break
        }
        case 'tool-result': {
          if (part.providerExecuted && isSearchToolName(part.toolName)) {
            lastSearchToolUseId = part.toolCallId
            const hits = extractSearchHitsFromToolOutput(part.output)
            if (hits.length > 0) {
              mergeSearchHits(searchHits, hits)
            }
            if (!emittedSearchResultToolUseIds.has(part.toolCallId)) {
              emittedSearchResultToolUseIds.add(part.toolCallId)
              yield {
                type: 'stream_event',
                event: {
                  type: 'content_block_start',
                  index: nextIndex++,
                  content_block: {
                    type: 'web_search_tool_result',
                    tool_use_id: part.toolCallId,
                    content: hits,
                  },
                },
              }
              yield {
                type: 'stream_event',
                event: {
                  type: 'content_block_stop',
                  index: nextIndex - 1,
                },
              }

              const assistant = buildAssistantMessage({
                content: [
                  {
                    type: 'web_search_tool_result',
                    tool_use_id: part.toolCallId,
                    content: hits,
                  },
                ],
                model: args.options.model,
                usage: { ...EMPTY_USAGE },
                requestId,
                messageId,
              })
              yieldedMessages.push(assistant)
              yield assistant
            }
            break
          }
          break
        }
        case 'finish-step': {
          requestId = part.response?.id
          finalUsage = convertLanguageUsageToAnthropicUsage(part.usage)
          break
        }
        case 'finish': {
          const finishUsage = convertLanguageUsageToAnthropicUsage(
            part.totalUsage,
          )
          finalUsage =
            finishUsage.output_tokens > 0 ||
            finishUsage.input_tokens > 0 ||
            finishUsage.cache_creation_input_tokens > 0 ||
            finishUsage.cache_read_input_tokens > 0
              ? finishUsage
              : finalUsage

          if (searchRequestCount > 0) {
            finalUsage.server_tool_use = {
              ...finalUsage.server_tool_use,
              web_search_requests: Math.max(
                finalUsage.server_tool_use?.web_search_requests ?? 0,
                searchRequestCount,
              ),
            }
          }

          if (searchHits.length > 0) {
            const searchToolUseId = lastSearchToolUseId ?? randomUUID()
            if (!lastSearchToolUseId) {
              searchRequestCount = Math.max(searchRequestCount, 1)
              finalUsage.server_tool_use = {
                ...finalUsage.server_tool_use,
                web_search_requests: Math.max(
                  finalUsage.server_tool_use?.web_search_requests ?? 0,
                  1,
                ),
              }
              yield {
                type: 'stream_event',
                event: {
                  type: 'content_block_start',
                  index: nextIndex++,
                  content_block: {
                    type: 'server_tool_use',
                    id: searchToolUseId,
                    name: SEARCH_TOOL_NAME,
                    input: {},
                  },
                },
              }
              yield {
                type: 'stream_event',
                event: {
                  type: 'content_block_stop',
                  index: nextIndex - 1,
                },
              }
              const toolUseAssistant = buildAssistantMessage({
                content: [
                  {
                    type: 'server_tool_use',
                    id: searchToolUseId,
                    name: SEARCH_TOOL_NAME,
                    input: {},
                  },
                ],
                model: args.options.model,
                usage: { ...EMPTY_USAGE },
                requestId,
                messageId,
              })
              yieldedMessages.push(toolUseAssistant)
              yield toolUseAssistant
            }

            if (!emittedSearchResultToolUseIds.has(searchToolUseId)) {
              emittedSearchResultToolUseIds.add(searchToolUseId)
              lastSearchToolUseId = searchToolUseId
              yield {
                type: 'stream_event',
                event: {
                  type: 'content_block_start',
                  index: nextIndex++,
                  content_block: {
                    type: 'web_search_tool_result',
                    tool_use_id: searchToolUseId,
                    content: searchHits,
                  },
                },
              }
              yield {
                type: 'stream_event',
                event: {
                  type: 'content_block_stop',
                  index: nextIndex - 1,
                },
              }

              const assistant = buildAssistantMessage({
                content: [
                  {
                    type: 'web_search_tool_result',
                    tool_use_id: searchToolUseId,
                    content: searchHits,
                  },
                ],
                model: args.options.model,
                usage: { ...EMPTY_USAGE },
                requestId,
                messageId,
              })
              yieldedMessages.push(assistant)
              yield assistant
            }
          }

          if (
            searchHits.length > 0 &&
            lastSearchToolUseId &&
            emittedSearchResultToolUseIds.has(lastSearchToolUseId)
          ) {
            // Search result block already synthesized above.
          } else if (
            searchHits.length > 0 &&
            lastSearchToolUseId &&
            !emittedSearchResultToolUseIds.has(lastSearchToolUseId)
          ) {
            emittedSearchResultToolUseIds.add(lastSearchToolUseId)
            yield {
              type: 'stream_event',
              event: {
                type: 'content_block_start',
                index: nextIndex++,
                content_block: {
                  type: 'web_search_tool_result',
                  tool_use_id: lastSearchToolUseId,
                  content: searchHits,
                },
              },
            }
            yield {
              type: 'stream_event',
              event: {
                type: 'content_block_stop',
                index: nextIndex - 1,
              },
            }

            const assistant = buildAssistantMessage({
              content: [
                {
                  type: 'web_search_tool_result',
                  tool_use_id: lastSearchToolUseId,
                  content: searchHits,
                },
              ],
              model: args.options.model,
              usage: { ...EMPTY_USAGE },
              requestId,
              messageId,
            })
            yieldedMessages.push(assistant)
            yield assistant
          }

          const stopReason = mapFinishReason(part.finishReason)
          const lastMessage = yieldedMessages.at(-1)
          if (lastMessage) {
            lastMessage.requestId = requestId
            lastMessage.message.usage = finalUsage
            lastMessage.message.stop_reason = stopReason
          }

          await maybeAddCost(args.options.model, finalUsage)
          logEvent('tengu_external_provider_query_success', {
            provider: route.provider,
            model: args.options.model,
            querySource: args.options.querySource,
          })

          yield {
            type: 'stream_event',
            event: {
              type: 'message_delta',
              delta: { stop_reason: stopReason },
              usage: finalUsage,
            },
          }
          yield {
            type: 'stream_event',
            event: { type: 'message_stop' },
          }
          break
        }
        case 'error':
          throw part.error
      }
    }
  } catch (error) {
    if (error instanceof APIUserAbortError || args.signal.aborted) {
      return
    }

    yield getAssistantMessageFromError(error, args.options.model, {
      messages: args.messages,
      messagesForAPI: [],
    })
  }
}

export async function executeExternalSideQuery(
  args: SideQueryArgs,
): Promise<Record<string, unknown>> {
  const route = resolveExternalProviderModel(args.model)
  if (!route) {
    throw new Error(`Model ${args.model} is not routed to an external provider`)
  }

  const resources = await createExternalProviderResources(route)
  let toolSet = buildSideQueryToolSet(args.tools)
  let toolChoice = convertToolChoice(args.tool_choice)
  let useStructuredOutputAsText = false

  if (
    args.output_format?.type === 'json_schema' &&
    Object.keys(toolSet).length === 0
  ) {
    toolSet = {
      ...toolSet,
      ...buildStructuredOutputTool(args.output_format),
    }
    toolChoice = { type: 'tool', toolName: STRUCTURED_OUTPUT_TOOL }
    useStructuredOutputAsText = true
  }

  const response = await generateText({
      ...getGenerationSettings({
      model: resources.languageModel,
        signal: args.signal,
        maxOutputTokens: args.max_tokens ?? 1024,
        temperature: args.temperature,
      toolChoice,
      stopSequences: args.stop_sequences,
    }),
    system: buildSideQuerySystemText({
      system: args.system,
      skipSystemPromptPrefix: args.skipSystemPromptPrefix,
    }),
    messages: convertAnthropicMessagesToModelMessages(args.messages),
    ...(Object.keys(toolSet).length > 0 ? { tools: toolSet } : {}),
  })

  const usage = convertLanguageUsageToAnthropicUsage(response.usage)
  await maybeAddCost(args.model, usage)

  const content = useStructuredOutputAsText
    ? [
        {
          type: 'text',
          text: buildStructuredOutputPayload(response.toolCalls) ?? response.text,
        },
      ]
    : convertContentPartsToAnthropicBlocks(response.content)

  return {
    id: response.response?.id ?? randomUUID(),
    model: args.model,
    role: 'assistant',
    content:
      content.length > 0
        ? content
        : [{ type: 'text', text: response.text ?? '' }],
    stop_reason: useStructuredOutputAsText
      ? 'end_turn'
      : mapFinishReason(response.finishReason),
    usage,
    _request_id: response.response?.id ?? undefined,
  }
}

export function getExternalProviderErrorMessage(error: unknown): string {
  return `${errorMessage(error)}`
}
