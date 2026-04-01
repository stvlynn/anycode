import type { Command } from '../commands.js'

export default {
  type: 'local',
  name: 'force-snip',
  description: 'Force snip placeholder',
  supportsNonInteractive: true,
  load: async () => ({
    async call() {
      return { type: 'skip' as const }
    },
  }),
} satisfies Command
