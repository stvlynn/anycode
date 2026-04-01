export async function tryReactiveCompact(_input: unknown): Promise<null> {
  return null
}

export function isWithheldPromptTooLong(): boolean {
  return false
}

export function isReactiveOnlyMode(): boolean {
  return false
}

export async function reactiveCompactOnPromptTooLong(): Promise<{
  ok: false
  reason: 'too_few_groups' | 'aborted' | 'exhausted'
}> {
  return { ok: false, reason: 'exhausted' }
}
