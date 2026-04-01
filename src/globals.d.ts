declare const MACRO: {
  VERSION: string
  BUILD_TIME?: string
  PACKAGE_URL?: string
  [key: string]: unknown
}

declare module 'react/compiler-runtime' {
  export const c: (...args: unknown[]) => unknown[]
}

declare module '@anthropic-ai/claude-agent-sdk' {
  export type PermissionMode = any
}
declare module '@opentelemetry/exporter-metrics-otlp-grpc'
declare module '@opentelemetry/exporter-metrics-otlp-http'
declare module '@opentelemetry/exporter-metrics-otlp-proto'
declare module '@opentelemetry/exporter-prometheus'
declare module '@opentelemetry/exporter-logs-otlp-grpc'
declare module '@opentelemetry/exporter-logs-otlp-proto'
declare module '@opentelemetry/exporter-trace-otlp-grpc'
declare module '@opentelemetry/exporter-trace-otlp-proto'
declare module 'p-map'
declare module 'tree-kill'
declare module 'asciichart'
declare module 'color-diff-napi'
declare module 'highlight.js'
declare module 'bidi-js'
declare module 'xss'
declare module 'plist'
declare module 'audio-capture-napi'
declare module 'sharp'
declare module 'image-processor-napi'
declare module 'turndown'
declare module 'shell-quote'
declare module 'cacache'
declare module 'cli-highlight'
declare module '@ant/claude-for-chrome-mcp'
declare module '@ant/claude-for-chrome-mcp/sentinelApps'
declare module '@ant/claude-for-chrome-mcp/types'
declare module '@ant/computer-use-mcp'
declare module '@ant/computer-use-mcp/types'
declare module '@ant/computer-use-mcp/sentinelApps'
declare module '@ant/computer-use-input'
declare module '@ant/computer-use-swift'
declare module '@anthropic-ai/mcpb'
declare module '@anthropic-ai/sandbox-runtime'
declare module 'url-handler-napi'
declare module 'fflate'
declare module 'proper-lockfile'
declare module 'undici'

declare module '*.md' {
  const content: string
  export default content
}

declare module '*.txt' {
  const content: string
  export default content
}

declare module '*.node' {
  const content: unknown
  export default content
}
