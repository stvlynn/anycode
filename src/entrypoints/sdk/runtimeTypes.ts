export type SDKRuntimeConfig = {
  cwd?: string
  sessionId?: string
  model?: string
}

export type SDKStatus = 'idle' | 'running' | 'error' | 'compacting' | string
export type SessionMessage = Record<string, unknown>
export type GetSessionMessagesOptions = Record<string, unknown>
export type AnyZodRawShape = Record<string, unknown>
export type ForkSessionOptions = Record<string, unknown>
export type ForkSessionResult = Record<string, unknown>
export type GetSessionInfoOptions = Record<string, unknown>
export type InferShape<T> = T
export type InternalOptions = Record<string, unknown>
export type InternalQuery = Record<string, unknown>
export type ListSessionsOptions = Record<string, unknown>
export type McpSdkServerConfigWithInstance = Record<string, unknown>
export type Options = Record<string, unknown>
export type Query = Record<string, unknown>
export type SDKSession = Record<string, unknown>
export type SDKSessionOptions = Record<string, unknown>
export type SdkMcpToolDefinition<T = unknown> = T
export type SessionMutationOptions = Record<string, unknown>
export type EffortLevel = any;
