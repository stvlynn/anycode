import type { UUID } from 'crypto'
import type { ToolProgressData } from './tools.js'

export type MessageRole = 'system' | 'user' | 'assistant'
export type MessageOrigin = {
  kind?: string
  source?: string
  [key: string]: unknown
}

export type Attachment = {
  type: string
  [key: string]: unknown
}

export type TextContentBlock = {
  type: 'text'
  text: string
  cache_control?: { type: string }
  metadata?: Record<string, unknown>
}

export type ThinkingContentBlock = {
  type: 'thinking'
  thinking: string
  signature?: string
  metadata?: Record<string, unknown>
}

export type ToolUseContentBlock = {
  type: 'tool_use'
  id?: string
  name: string
  input: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export type ToolResultContentBlock = {
  type: 'tool_result'
  tool_use_id?: string
  content: string | ContentBlock[]
  is_error?: boolean
  metadata?: Record<string, unknown>
}

export type ImageContentBlock = {
  type: 'image'
  source?: unknown
  media_type?: string
  data?: string
}

export type ConnectorTextLikeBlock = {
  type: 'connector_text'
  text: string
  connectorName?: string
  metadata?: Record<string, unknown>
}

export type ContentBlock = any

type MessagePayload = {
  id?: UUID | string
  role?: MessageRole
  content: any
  model?: string
  stopReason?: string | null
  [key: string]: any
}

type BaseMessage = {
  type: string
  subtype?: string
  id?: UUID | string
  uuid?: UUID | string
  message: MessagePayload
  attachment?: Attachment
  origin?: MessageOrigin
  createdAt?: number
  timestamp?: number | string
  isMeta?: boolean
  isVirtual?: boolean
  isCompactSummary?: boolean
  toolUseResult?: unknown
  compactMetadata?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export type UserMessage = BaseMessage & {
  type: 'user'
  message: MessagePayload & {
    role: 'user'
  }
}

export type AssistantMessage = BaseMessage & {
  type: 'assistant'
  message: MessagePayload & {
    role: 'assistant'
  }
}

export type SystemMessage = BaseMessage & {
  type: 'system'
  message: MessagePayload & {
    role?: 'system'
  }
}

export type AttachmentMessage = BaseMessage & {
  type: 'attachment'
  uuid?: UUID | string
  attachment: Attachment
  message: MessagePayload
  attachments?: Array<{
    path?: string
    name?: string
    type?: string
    mimeType?: string
  }>
}

export type ProgressMessage = {
  type: 'progress'
  uuid?: UUID | string
  progress: ToolProgressData
  text?: string
  createdAt?: number
  message?: MessagePayload
}

export type SystemAPIErrorMessage = {
  type: 'system'
  subtype: 'api_error'
  uuid?: UUID | string
  message: string
  error?: string
  retryable?: boolean
  code?: string | number
}

export type SystemLocalCommandMessage = {
  type: 'system_local_command'
  uuid?: UUID | string
  command: string
  output?: string
  message?: MessagePayload
}

export type NormalizedUserMessage = UserMessage

export type Message =
  | UserMessage
  | AssistantMessage
  | SystemMessage
  | AttachmentMessage
  | ProgressMessage
  | SystemAPIErrorMessage
  | SystemLocalCommandMessage

export type NormalizedMessage = Message
export type RenderableMessage = Message

export type RequestStartEvent = {
  type: 'request_start'
  uuid?: UUID | string
  model?: string
}

export type TombstoneMessage = {
  type: 'tombstone'
  uuid?: UUID | string
  reason?: string
}

export type ToolUseSummaryMessage = {
  type: 'tool_use_summary'
  uuid?: UUID | string
  summary: string
  toolUseIds?: string[]
}

export type APIMessage = UserMessage | AssistantMessage

export type StdoutMessageEnvelope = {
  type: string
  message?: Message
  data?: Record<string, unknown>
}

export type StreamEvent =
  | {
      type: 'text_delta'
      text: string
      id?: string
      metadata?: Record<string, unknown>
    }
  | {
      type: 'thinking_delta'
      text: string
      id?: string
      metadata?: Record<string, unknown>
    }
  | {
      type: 'tool_use'
      name: string
      input?: Record<string, unknown>
      id?: string
      metadata?: Record<string, unknown>
    }
  | {
      type: 'tool_result'
      id?: string
      content?: unknown
      is_error?: boolean
      metadata?: Record<string, unknown>
    }
  | {
      type: 'message_stop'
      stop_reason?: string | null
      model?: string
      usage?: Record<string, unknown>
    }
  | {
      type: 'error'
      error: string
      code?: string | number
    }
export type CollapsedReadSearchGroup = any;
export type GroupedToolUseMessage = any;
export type NormalizedAssistantMessage = any;
export type SystemStopHookSummaryMessage = any;
export type SystemBridgeStatusMessage = any;
export type SystemTurnDurationMessage = any;
export type SystemThinkingMessage = any;
export type SystemMemorySavedMessage = any;
export type PartialCompactDirection = any;
export type SystemInformationalMessage = any;
export type HookResultMessage = any;
export type StopHookInfo = any;
export type SystemCompactBoundaryMessage = any;
export type CompactMetadata = any;
export type SystemFileSnapshotMessage = any;
