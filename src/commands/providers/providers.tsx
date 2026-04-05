import * as React from 'react'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { getModelsDevDataset } from '../../models/modelsDev.js'
import {
  listKnownProviders,
  listResolvedModels,
  verifyProviderConnection,
} from '../../providers/registry.js'
import { getActiveModelProvider } from '../../utils/model/providers.js'

export async function call(
  onDone: LocalJSXCommandOnDone,
): Promise<React.ReactNode> {
  const active = getActiveModelProvider()
  const dataset = await getModelsDevDataset()
  const models = await listResolvedModels()
  const checks = await Promise.all(
    listKnownProviders().map(async provider => ({
      provider,
      verification: await verifyProviderConnection(provider.id),
      modelCount: models.filter(model => model.provider === provider.id).length,
    })),
  )

  const lines = [
    `Active provider: ${active}`,
    `Model registry source: ${dataset.source}`,
    '',
    ...checks.map(
      ({ provider, verification, modelCount }) =>
        `- ${provider.name} (${provider.id}) · models: ${modelCount} · ${verification.ok ? 'connected' : `unavailable: ${verification.message ?? 'not configured'}`}`,
    ),
  ]

  onDone(lines.join('\n'), { display: 'system' })
  return null
}
