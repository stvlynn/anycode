import type { Command } from '../../types/command.js'

export function createWorkflowCommand(name = 'workflow'): Command {
  return {
    type: 'local',
    name,
    description: 'Workflow command placeholder',
    supportsNonInteractive: true,
    load: async () => ({
      async call() {
        return { type: 'skip' as const }
      },
    }),
  }
}

export function getWorkflowCommands(_cwd?: string): Command[] {
  return [createWorkflowCommand()]
}
