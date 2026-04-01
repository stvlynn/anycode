import type { Command } from '../commands.js'

export default {
  type: 'local',
  name: 'subscribe-pr',
  description: 'Subscribe PR placeholder',
  supportsNonInteractive: true,
  load: async () => ({
    async call() {
      return { type: 'skip' as const }
    },
  }),
} satisfies Command
