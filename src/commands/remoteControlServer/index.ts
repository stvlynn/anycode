import type { Command } from '../../commands.js'

export default {
  type: 'local',
  name: 'remoteControlServer',
  description: 'Remote control server placeholder',
  supportsNonInteractive: true,
  load: async () => ({
    async call() {
      return { type: 'skip' as const }
    },
  }),
} satisfies Command
