import type { Command } from '../commands.js'

export default {
  type: 'local',
  name: 'proactive',
  description: 'Proactive command placeholder',
  supportsNonInteractive: true,
  load: async () => ({
    async call() {
      return { type: 'skip' as const }
    },
  }),
} satisfies Command
