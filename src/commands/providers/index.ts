import type { Command } from '../../commands.js'

export default {
  type: 'local-jsx',
  name: 'providers',
  description: 'List configured model providers and current models.dev status',
  immediate: true,
  load: () => import('./providers.js'),
} satisfies Command
