export const DEFAULT_GRANT_FLAGS = {}
export const API_RESIZE_PARAMS = {}

export function targetImageSize(width, height) {
  return [width, height]
}

export function buildComputerUseTools() {
  return []
}

export function bindSessionContext() {
  return () => ({ ok: false, error: 'computer use stub' })
}
