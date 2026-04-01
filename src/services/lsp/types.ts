export type LspServerState =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'error'

export type ScopedLspServerConfig = {
  command: string
  args?: string[]
  env?: Record<string, string>
  workspaceFolder?: string
  initializationOptions?: Record<string, unknown>
  maxRestarts?: number
  restartOnCrash?: boolean
  shutdownTimeout?: number
}
export type LspServerConfig = any;
