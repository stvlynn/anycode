import type { Command } from '../commands.js'

export default {
  type: 'local',
  name: 'torch',
  description: 'Torch placeholder',
  supportsNonInteractive: true,
  load: async () => ({
    async call() {
      return { type: 'skip' as const }
    },
  }),
} satisfies Command
