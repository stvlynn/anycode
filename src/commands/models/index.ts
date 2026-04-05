import type { Command } from '../../commands.js'
import { shouldInferenceConfigCommandBeImmediate } from '../../utils/immediateCommand.js'

export default {
  type: 'local-jsx',
  name: 'models',
  description: 'Browse and switch available models',
  get immediate() {
    return shouldInferenceConfigCommandBeImmediate()
  },
  load: () => import('./models.js'),
} satisfies Command
