import type { Command } from '../../commands.js'

export default {
  type: 'local',
  name: 'fork',
  description: 'Fork command placeholder',
  supportsNonInteractive: true,
  load: async () => ({
    async call() {
      return { type: 'skip' as const }
    },
  }),
} satisfies Command
