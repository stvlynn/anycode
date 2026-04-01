export type ShellProgress = {
  type: 'shell'
  command?: string
  cwd?: string
  exitCode?: number | null
  status?: 'queued' | 'running' | 'completed' | 'failed'
}

export type BashProgress = ShellProgress & {
  shell: 'bash'
}

export type PowerShellProgress = ShellProgress & {
  shell: 'powershell'
}

export type AgentToolProgress = {
  type: 'agent'
  agentId?: string
  description?: string
  status?: 'queued' | 'running' | 'completed' | 'failed'
}

export type MCPProgress = {
  type: 'mcp'
  server?: string
  action?: string
  status?: 'queued' | 'running' | 'completed' | 'failed'
}

export type REPLToolProgress = {
  type: 'repl'
  message?: string
}

export type SkillToolProgress = {
  type: 'skill'
  skillName?: string
  status?: 'queued' | 'running' | 'completed' | 'failed'
}

export type TaskOutputProgress = {
  type: 'task_output'
  taskId?: string
  status?: 'queued' | 'running' | 'completed' | 'failed'
}

export type WebSearchProgress = {
  type: 'web_search'
  query?: string
  status?: 'queued' | 'running' | 'completed' | 'failed'
}

export type SdkWorkflowProgress = {
  type: 'sdk_workflow'
  title?: string
  step?: string
  done?: boolean
}

export type ToolProgressData =
  | BashProgress
  | PowerShellProgress
  | AgentToolProgress
  | MCPProgress
  | REPLToolProgress
  | SkillToolProgress
  | TaskOutputProgress
  | WebSearchProgress
  | SdkWorkflowProgress
