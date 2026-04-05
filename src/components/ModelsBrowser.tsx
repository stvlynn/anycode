import Fuse from 'fuse.js'
import * as React from 'react'
import { useEffect, useMemo, useState } from 'react'
import type { LocalJSXCommandOnDone } from '../types/command.js'
import { useMainLoopModel } from '../hooks/useMainLoopModel.js'
import {
  getModelsDevDataset,
  refreshModelsDevCache,
  type ModelsDevDataset,
  type ModelsDevRawModel,
} from '../models/modelsDev.js'
import {
  isProviderConfigured,
  listSwitchableModelProviders,
} from '../providers/registry.js'
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from '../services/analytics/index.js'
import { useAppState, useSetAppState } from '../state/AppState.js'
import { isBilledAsExtraUsage } from '../utils/extraUsage.js'
import {
  clearFastModeCooldown,
  isFastModeAvailable,
  isFastModeEnabled,
  isFastModeSupportedByModel,
} from '../utils/fastMode.js'
import { isOpus1mMergeEnabled } from '../utils/model/model.js'
import { modelDisplayString } from '../utils/model/model.js'
import { Box, Text } from '../ink.js'
import { Spinner } from './Spinner.js'
import { FuzzyPicker } from './design-system/FuzzyPicker.js'
import { Pane } from './design-system/Pane.js'

type Props = {
  onDone: LocalJSXCommandOnDone
}

type ModelItem = {
  kind: 'model'
  key: string
  searchText: string
  providerId: string
  providerName: string
  modelId: string
  value: string
  label: string
  connected: boolean
  current: boolean
  description: string
  model: ModelsDevRawModel
}

type ConnectItem = {
  kind: 'connect'
  key: string
  searchText: string
  providerId: string
  providerName: string
  label: string
  description: string
}

type BrowserItem = ModelItem | ConnectItem

const PROVIDER_PRIORITY: Record<string, number> = {
  anthropic: 0,
  openai: 1,
  gemini: 2,
}

function getProviderModelValue(providerId: string, modelId: string): string {
  return providerId === 'anthropic' ? modelId : `${providerId}/${modelId}`
}

function formatContextWindow(model: ModelsDevRawModel): string {
  if (!model.limit.context) {
    return 'context unknown'
  }
  const value = model.limit.context
  if (value >= 1_000_000) {
    return `${Math.round(value / 100_000) / 10}M context`
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}k context`
  }
  return `${value} context`
}

function formatPricing(model: ModelsDevRawModel): string | null {
  if (!model.cost?.input || !model.cost?.output) {
    return null
  }
  return `$${model.cost.input}/$${model.cost.output} per Mtok`
}

function buildItems(
  dataset: ModelsDevDataset,
  currentModel: string,
): BrowserItem[] {
  const items: BrowserItem[] = []

  for (const providerId of listSwitchableModelProviders()) {
    const provider = dataset[providerId]
    if (!provider) {
      continue
    }

    const connected = providerId === 'anthropic' || isProviderConfigured(providerId)
    const priority = PROVIDER_PRIORITY[providerId] ?? 99

    if (!connected) {
      items.push({
        kind: 'connect',
        key: `connect:${providerId}`,
        searchText: `connect ${provider.name} ${providerId}`,
        providerId,
        providerName: provider.name,
        label: `Connect ${provider.name}`,
        description: provider.env.length
          ? `Add credentials for ${provider.env.join(' or ')}`
          : 'Configure this provider before selecting a model',
      })
      continue
    }

    const models = Object.values(provider.models).sort((a, b) => {
      const aDefault = getProviderModelValue(providerId, a.id) === currentModel ? -1 : 0
      const bDefault = getProviderModelValue(providerId, b.id) === currentModel ? -1 : 0
      if (aDefault !== bDefault) {
        return aDefault - bDefault
      }
      return a.name.localeCompare(b.name)
    })

    for (const model of models) {
      const value = getProviderModelValue(providerId, model.id)
      const pricing = formatPricing(model)
      const descriptionParts = [provider.name, formatContextWindow(model)]
      if (pricing) {
        descriptionParts.push(pricing)
      }

      items.push({
        kind: 'model',
        key: `${priority}:${providerId}:${model.id}`,
        searchText: `${provider.name} ${providerId} ${model.name} ${model.id} ${value}`,
        providerId,
        providerName: provider.name,
        modelId: model.id,
        value,
        label: model.name,
        connected,
        current: value === currentModel,
        description: descriptionParts.join(' · '),
        model,
      })
    }
  }

  return items.sort((a, b) => {
    const aPriority = PROVIDER_PRIORITY[a.providerId] ?? 99
    const bPriority = PROVIDER_PRIORITY[b.providerId] ?? 99
    if (aPriority !== bPriority) {
      return aPriority - bPriority
    }
    if (a.kind !== b.kind) {
      return a.kind === 'model' ? -1 : 1
    }
    return a.label.localeCompare(b.label)
  })
}

export function ModelsBrowser({ onDone }: Props): React.ReactNode {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<BrowserItem[]>([])
  const [query, setQuery] = useState('')

  const currentModel = useMainLoopModel()
  const mainLoopModel = useAppState(state => state.mainLoopModel) as
    | string
    | null
  const mainLoopModelForSession = useAppState(
    state => state.mainLoopModelForSession,
  ) as string | null
  const isFastMode = useAppState(state => state.fastMode)
  const setAppState = useSetAppState()

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      setIsLoading(true)
      setError(null)

      const refreshed = await refreshModelsDevCache().catch(() => null)
      const dataset = refreshed ?? (await getModelsDevDataset()).data

      if (!cancelled) {
        setItems(buildItems(dataset, currentModel))
        setIsLoading(false)
      }
    }

    void load().catch(loadError => {
      if (!cancelled) {
        setError(loadError instanceof Error ? loadError.message : String(loadError))
        setIsLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [currentModel])

  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      return items
    }

    const fuse = new Fuse(items, {
      keys: ['searchText', 'label', 'providerName', 'description'],
      threshold: 0.35,
      ignoreLocation: true,
    })
    return fuse.search(query).map(result => result.item)
  }, [items, query])

  function handleCancel(): void {
    const currentDisplay =
      mainLoopModelForSession
        ? modelDisplayString(mainLoopModelForSession)
        : modelDisplayString(mainLoopModel)
    onDone(`Kept model as ${currentDisplay}`, { display: 'system' })
  }

  function handleSelectModel(model: string, displayLabel: string): void {
    logEvent('tengu_models_command_menu', {
      action: model as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      from_model:
        currentModel as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      to_model: model as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })

    setAppState(prev => ({
      ...prev,
      mainLoopModel: model,
      mainLoopModelForSession: null,
    }))

    let message = `Set model to ${displayLabel}`
    let wasFastModeToggledOn: boolean | undefined

    if (isFastModeEnabled()) {
      clearFastModeCooldown()
      if (!isFastModeSupportedByModel(model) && isFastMode) {
        setAppState(prev => ({
          ...prev,
          fastMode: false,
        }))
        wasFastModeToggledOn = false
      } else if (
        isFastModeSupportedByModel(model) &&
        isFastModeAvailable() &&
        isFastMode
      ) {
        message += ' · Fast mode ON'
        wasFastModeToggledOn = true
      }
    }

    if (
      isBilledAsExtraUsage(
        model,
        wasFastModeToggledOn === true,
        isOpus1mMergeEnabled(),
      )
    ) {
      message += ' · Billed as extra usage'
    }
    if (wasFastModeToggledOn === false) {
      message += ' · Fast mode OFF'
    }

    onDone(message)
  }

  function handleSelect(item: BrowserItem): void {
    if (item.kind === 'connect') {
      onDone(undefined, {
        display: 'skip',
        nextInput: `/connect ${item.providerId}`,
        submitNextInput: true,
      })
      return
    }
    handleSelectModel(item.value, item.label)
  }

  if (isLoading) {
    return (
      <Pane color="permission">
        <Box flexDirection="column" gap={1}>
          <Text bold>Select Model</Text>
          <Box>
            <Spinner />
            <Text>Loading models.dev catalog…</Text>
          </Box>
        </Box>
      </Pane>
    )
  }

  if (error) {
    return (
      <Pane color="permission">
        <Box flexDirection="column" gap={1}>
          <Text bold>Select Model</Text>
          <Text color="error">Failed to load models: {error}</Text>
        </Box>
      </Pane>
    )
  }

  return (
    <FuzzyPicker
      title="Select model"
      placeholder="Search models or providers…"
      items={filteredItems}
      getKey={item => item.key}
      onQueryChange={setQuery}
      onCancel={handleCancel}
      onSelect={handleSelect}
      selectAction="switch model"
      matchLabel={`${filteredItems.length} item${filteredItems.length === 1 ? '' : 's'}`}
      emptyMessage={query ? 'No models match your search' : 'No models available'}
      renderItem={(item, isFocused) => (
        <Box flexDirection="column">
          <Text color={isFocused ? 'permission' : undefined}>
            {item.kind === 'model' && item.current ? '● ' : ''}
            {item.label}
          </Text>
          <Text dimColor>{item.description}</Text>
        </Box>
      )}
      renderPreview={item => {
        if (item.kind === 'connect') {
          return (
            <Box flexDirection="column" gap={1}>
              <Text bold>{item.label}</Text>
              <Text dimColor>{item.description}</Text>
              <Text>Press Enter to open `/connect {item.providerId}`.</Text>
            </Box>
          )
        }

        const pricing = formatPricing(item.model)
        const capabilityBits = [
          item.model.tool_call ? 'tools' : null,
          item.model.reasoning ? 'reasoning' : null,
          item.model.attachment ? 'attachments' : null,
        ].filter(Boolean)

        return (
          <Box flexDirection="column" gap={1}>
            <Text bold>{item.label}</Text>
            <Text dimColor>{item.value}</Text>
            <Text>{item.description}</Text>
            {pricing ? <Text>Pricing: {pricing}</Text> : null}
            <Text>
              Capabilities:{' '}
              {capabilityBits.length > 0 ? capabilityBits.join(', ') : 'basic'}
            </Text>
            {item.current ? <Text color="success">Currently selected</Text> : null}
          </Box>
        )
      }}
    />
  )
}
