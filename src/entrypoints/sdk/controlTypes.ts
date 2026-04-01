import type { AgentDefinition } from './coreTypes.generated.js'
import type { ModelInfo } from './coreTypes.generated.js'

export type SDKControlRequest = any

export type SDKControlInitializeRequest = {
  subtype: 'initialize'
  hooks?: Record<string, unknown>
  sdkMcpServers?: string[]
  jsonSchema?: Record<string, unknown>
  systemPrompt?: string
  appendSystemPrompt?: string
  agents?: Record<string, AgentDefinition>
  promptSuggestions?: boolean
  agentProgressSummaries?: boolean
}

export type SDKControlInitializeResponse = {
  commands: Array<{
    name: string
    description: string
    argumentHint?: string
  }>
  agents: Array<{
    name: string
    description: string
    model?: string
  }>
  output_style: string
  available_output_styles: string[]
  models: ModelInfo[]
  account: {
    email?: string
    organization?: string
    subscriptionType?: string
    tokenSource?: string
    apiKeySource?: string
    apiProvider?: string
  }
  pid?: number
  fast_mode_state?: Record<string, unknown>
}

export type SDKControlPermissionRequest = {
  subtype: 'can_use_tool'
  tool_name: string
  input: Record<string, unknown>
  permission_suggestions?: Array<Record<string, unknown>>
  blocked_path?: string
  decision_reason?: string
  title?: string
  display_name?: string
  tool_use_id: string
  agent_id?: string
  description?: string
}

export type SDKControlResponse = any
export type StdoutMessage = any
export type SDKControlMcpSetServersResponse = any
export type SDKControlReloadPluginsResponse = any
export type SDKPartialAssistantMessage = any
export type StdinMessage = any
export type SDKControlCancelRequest = any;
export type SDKControlRequestInner = any;
