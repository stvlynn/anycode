export type LocalWorkflowTaskState = {
  id: string
  type: 'local_workflow'
  status: 'running' | 'completed' | 'failed' | 'stopped'
  startTime: number
}

export function killWorkflowTask(): void {}
export function skipWorkflowAgent(): void {}
export function retryWorkflowAgent(): void {}
