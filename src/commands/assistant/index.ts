import type { Command } from '../../commands.js'

export default {
  type: 'local',
  name: 'assistant',
  description: 'Assistant command placeholder',
  supportsNonInteractive: true,
  load: async () => ({
    async call() {
      return { type: 'skip' as const }
    },
  }),
} satisfies Command
