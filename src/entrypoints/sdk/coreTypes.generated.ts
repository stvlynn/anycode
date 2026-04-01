export type HookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'Notification'
  | 'UserPromptSubmit'
  | 'SessionStart'
  | 'SessionEnd'
  | 'Stop'
  | 'StopFailure'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'PreCompact'
  | 'PostCompact'
  | 'PermissionRequest'
  | 'PermissionDenied'
  | 'Setup'
  | 'TeammateIdle'
  | 'TaskCreated'
  | 'TaskCompleted'
  | 'Elicitation'
  | 'ElicitationResult'
  | 'ConfigChange'
  | 'WorktreeCreate'
  | 'WorktreeRemove'
  | 'InstructionsLoaded'
  | 'CwdChanged'
  | 'FileChanged'

export type ModelInfo = {
  value: string
  displayName: string
  description: string
  supportsEffort?: boolean
  supportedEffortLevels?: Array<'low' | 'medium' | 'high' | 'max'>
  supportsAdaptiveThinking?: boolean
  supportsFastMode?: boolean
  supportsAutoMode?: boolean
}

export type SDKMessage = any
export type SDKUserMessage = any
export type SDKAssistantMessage = any
export type SDKUserMessageReplay = any
export type SDKResultMessage = any
export type SDKStatus = any
export type SDKSessionInfo = any
export type SDKResultSuccess = any
export type McpServerConfigForProcessTransport = any
export type McpServerStatus = any
export type RewindFilesResult = any
export type ModelUsage = any
export type AgentDefinition = any;
