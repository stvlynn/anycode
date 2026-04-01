type ProactiveReason = 'command' | 'system' | 'user'

let active = false
let paused = false
let contextBlocked = false
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function activateProactive(_reason: ProactiveReason): void {
  active = true
  emit()
}

export function deactivateProactive(): void {
  active = false
  emit()
}

export function isProactiveActive(): boolean {
  return active
}

export function pauseProactive(): void {
  paused = true
  emit()
}

export function resumeProactive(): void {
  paused = false
  emit()
}

export function isProactivePaused(): boolean {
  return paused
}

export function setContextBlocked(value: boolean): void {
  contextBlocked = value
  emit()
}

export function getContextBlocked(): boolean {
  return contextBlocked
}

export function subscribeToProactiveChanges(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
