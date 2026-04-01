// @ts-nocheck
import type { Task } from '../../Task.js'
import type { AppState } from '../../state/AppState.js'

export type MonitorMcpTaskState = {
  id: string
  type: 'monitor_mcp'
  status: 'running' | 'completed' | 'failed' | 'stopped'
  startTime: number
  title?: string
}

export const MonitorMcpTask: Task = {
  type: 'monitor_mcp',
  name: 'MonitorMcpTask',
}

export function killMonitorMcp(
  _taskId: string,
  _setAppState: ((updater: (prev: AppState) => AppState) => void) | undefined,
): void {}

export function killMonitorMcpTasksForAgent(_agentId: string): void {}
// @ts-nocheck
// @ts-nocheck
// @ts-nocheck
