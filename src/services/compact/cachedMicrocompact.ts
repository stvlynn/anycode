export type CacheEditsBlock = {
  type: 'cache_edits'
  content?: unknown
}

export type PinnedCacheEdits = {
  userMessageIndex: number
  block: CacheEditsBlock
}

export type CachedMCState = {
  pinnedEdits: PinnedCacheEdits[]
}

export function createCachedMCState(): CachedMCState {
  return { pinnedEdits: [] }
}

export function getCachedMCConfig(): {
  enabled: boolean
  threshold: number
} {
  return { enabled: false, threshold: 0 }
}
export const markToolsSentToAPI: any = (() => {}) as any;
export const isCachedMicrocompactEnabled: any = (() => {}) as any;
export const isModelSupportedForCacheEditing: any = (() => {}) as any;
export const registerToolResult: any = (() => {}) as any;
export const registerToolMessage: any = (() => {}) as any;
export const getToolResultsToDelete: any = (() => {}) as any;
export const createCacheEditsBlock: any = (() => {}) as any;
