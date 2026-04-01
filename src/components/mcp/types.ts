export type ServerInfo = {
  name: string
  status?: string
  description?: string
  transport?: string
}

export type AgentMcpServerInfo = {
  name: string
  transport: 'stdio' | 'sse' | 'http' | 'sdk' | 'claudeai-proxy' | string
  sourceAgents: string[]
  status?: string
  description?: string
}

export type StdioServerInfo = ServerInfo & {
  command?: string
  args?: string[]
}

export type SSEServerInfo = ServerInfo & {
  url?: string
}

export type HTTPServerInfo = ServerInfo & {
  url?: string
}

export type ClaudeAIServerInfo = ServerInfo & {
  id?: string
  url?: string
}

export type MCPViewState =
  | { type: 'list' }
  | { type: 'server'; name: string }
  | { type: 'agent-server'; name: string }
