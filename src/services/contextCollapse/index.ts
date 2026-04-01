import type { Message } from '../../types/message.js'

export type ContextCollapseResult = {
  messages: Message[]
  committed?: boolean
}

export async function applyCollapsesIfNeeded(
  messages: Message[],
): Promise<ContextCollapseResult> {
  return { messages, committed: false }
}

export function recoverFromOverflow(messages: Message[]): ContextCollapseResult {
  return { messages, committed: false }
}

export function isContextCollapseEnabled(): boolean {
  return false
}

export function isWithheldPromptTooLong(): boolean {
  return false
}

export function resetContextCollapse(): void {}

export function getStats(): {
  collapsedSpans: number
  collapsedMessages: number
  health: string
} {
  return {
    collapsedSpans: 0,
    collapsedMessages: 0,
    health: 'ok',
  }
}
export const subscribe: any = (() => {}) as any;
