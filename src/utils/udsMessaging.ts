let onEnqueue: (() => void) | null = null

export function getUdsMessagingSocketPath(): string {
  return '/tmp/claude-code-snapshot.sock'
}

export function setOnEnqueue(callback: (() => void) | null): void {
  onEnqueue = callback
}

export function notifyEnqueue(): void {
  onEnqueue?.()
}
export const startUdsMessaging: any = (() => {}) as any;
export const getDefaultUdsSocketPath: any = (() => {}) as any;
