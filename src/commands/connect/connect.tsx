import Fuse from 'fuse.js'
import * as React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Spinner } from '../../components/Spinner.js'
import TextInput from '../../components/TextInput.js'
import { Select } from '../../components/CustomSelect/index.js'
import { FuzzyPicker } from '../../components/design-system/FuzzyPicker.js'
import { Pane } from '../../components/design-system/Pane.js'
import { Box, Text } from '../../ink.js'
import {
  getModelsDevDataset,
  refreshModelsDevCache,
  type ModelsDevRawProvider,
} from '../../models/modelsDev.js'
import {
  isProviderConfigured,
  isSwitchableModelProvider,
  verifyProviderConnection,
} from '../../providers/registry.js'
import type { LocalJSXCommandCall } from '../../types/command.js'
import {
  getSettingsForSource,
  updateSettingsForSource,
} from '../../utils/settings/settings.js'

type ProviderItem = {
  id: string
  name: string
  envVars: string[]
  modelCount: number
  connected: boolean
  switchable: boolean
  baseURL?: string
  suggestion?: string
  description: string
  searchText: string
}

type Props = {
  onDone: Parameters<LocalJSXCommandCall>[0]
  initialProviderId?: string
}

type Step = 'pick' | 'apiKey' | 'baseURL' | 'defaultModel' | 'confirm'

const PROVIDER_PRIORITY: Record<string, number> = {
  anthropic: 0,
  openai: 1,
  gemini: 2,
}

function getProviderDescription(provider: ModelsDevRawProvider): string {
  const envHint =
    provider.env.length > 0 ? provider.env.join(' or ') : 'custom configuration'
  return `${provider.models ? Object.keys(provider.models).length : 0} models · ${envHint}`
}

function getSuggestedDefaultModel(provider: ModelsDevRawProvider): string {
  if (provider.id === 'openai') {
    return 'gpt-5'
  }
  if (provider.id === 'gemini') {
    return 'gemini-2.5-pro'
  }

  const models = Object.values(provider.models)
  return models[0]?.id ?? ''
}

function buildProviderItems(
  providers: Record<string, ModelsDevRawProvider>,
): ProviderItem[] {
  return Object.values(providers)
    .map(provider => ({
      id: provider.id,
      name: provider.name,
      envVars: provider.env,
      modelCount: Object.keys(provider.models).length,
      connected:
        provider.id === 'anthropic' || isProviderConfigured(provider.id),
      switchable:
        provider.id === 'anthropic' || isSwitchableModelProvider(provider.id),
      baseURL: provider.api,
      suggestion: getSuggestedDefaultModel(provider),
      description: getProviderDescription(provider),
      searchText: `${provider.id} ${provider.name} ${provider.env.join(' ')}`,
    }))
    .sort((a, b) => {
      const aPriority = PROVIDER_PRIORITY[a.id] ?? 99
      const bPriority = PROVIDER_PRIORITY[b.id] ?? 99
      if (aPriority !== bPriority) {
        return aPriority - bPriority
      }
      if (a.connected !== b.connected) {
        return a.connected ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
}

function ProviderPicker({
  providers,
  onCancel,
  onDone,
  onSelect,
}: {
  providers: ProviderItem[]
  onCancel: () => void
  onDone: Parameters<LocalJSXCommandCall>[0]
  onSelect: (provider: ProviderItem) => void
}): React.ReactNode {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query.trim()) {
      return providers
    }
    const fuse = new Fuse(providers, {
      keys: ['searchText', 'name', 'id', 'description'],
      threshold: 0.35,
      ignoreLocation: true,
    })
    return fuse.search(query).map(result => result.item)
  }, [providers, query])

  return (
    <FuzzyPicker
      title="Connect provider"
      placeholder="Search providers…"
      items={filtered}
      getKey={provider => provider.id}
      onQueryChange={setQuery}
      onCancel={onCancel}
      onSelect={provider => {
        if (provider.id === 'anthropic') {
          onDone(undefined, {
            display: 'skip',
            nextInput: '/login',
            submitNextInput: true,
          })
          return
        }
        onSelect(provider)
      }}
      selectAction="connect"
      matchLabel={`${filtered.length} provider${filtered.length === 1 ? '' : 's'}`}
      renderItem={provider => (
        <Box flexDirection="column">
          <Text>{provider.name}</Text>
          <Text dimColor>{provider.description}</Text>
        </Box>
      )}
      renderPreview={provider => (
        <Box flexDirection="column" gap={1}>
          <Text bold>{provider.name}</Text>
          <Text dimColor>{provider.id}</Text>
          <Text>{provider.description}</Text>
          {provider.connected ? (
            <Text color="success">Existing saved settings detected</Text>
          ) : null}
          {provider.id === 'anthropic' ? (
            <Text>Anthropic uses Claude Code&apos;s built-in `/login` flow.</Text>
          ) : provider.switchable ? (
            <Text>
              Saving credentials here will unlock this provider in `/models`.
            </Text>
          ) : (
            <Text>
              This provider can be saved in settings, but the current snapshot
              cannot verify or switch to it yet.
            </Text>
          )}
        </Box>
      )}
    />
  )
}

function FieldStep({
  title,
  description,
  placeholder,
  value,
  onChange,
  onSubmit,
  onExit,
  mask,
}: {
  title: string
  description: React.ReactNode
  placeholder: string
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onExit: () => void
  mask?: string
}): React.ReactNode {
  const [cursorOffset, setCursorOffset] = useState(value.length)

  useEffect(() => {
    setCursorOffset(value.length)
  }, [value])

  return (
    <Pane color="permission">
      <Box flexDirection="column" gap={1}>
        <Text bold>{title}</Text>
        {description}
        <TextInput
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          onExit={onExit}
          placeholder={placeholder}
          focus
          showCursor
          mask={mask}
          columns={80}
          cursorOffset={cursorOffset}
          onChangeCursorOffset={setCursorOffset}
        />
        <Text dimColor>Enter to continue · Esc to cancel</Text>
      </Box>
    </Pane>
  )
}

function ConfirmStep({
  provider,
  apiKey,
  baseURL,
  defaultModel,
  error,
  onSave,
  onCancel,
}: {
  provider: ProviderItem
  apiKey: string
  baseURL: string
  defaultModel: string
  error: string | null
  onSave: () => void
  onCancel: () => void
}): React.ReactNode {
  return (
    <Pane color="permission">
      <Box flexDirection="column" gap={1}>
        <Text bold>Save provider settings</Text>
        <Text>{provider.name}</Text>
        <Text dimColor>{provider.id}</Text>
        <Text>API key: {apiKey ? 'configured' : 'not set'}</Text>
        <Text>Base URL: {baseURL || '(not set)'}</Text>
        <Text>
          Default model: {defaultModel || provider.suggestion || '(not set)'}
        </Text>
        {error ? <Text color="error">{error}</Text> : null}
        <Select
          options={[
            {
              label: 'Save and verify',
              value: 'save',
              description: provider.switchable
                ? 'Write settings and then open /models'
                : 'Write settings and keep this provider in config',
            },
            {
              label: 'Cancel',
              value: 'cancel',
              description: 'Exit without saving anything',
            },
          ]}
          onChange={value => {
            if (value === 'save') {
              onSave()
              return
            }
            onCancel()
          }}
          onCancel={onCancel}
          visibleOptionCount={2}
        />
      </Box>
    </Pane>
  )
}

function ConnectProviderWizard({
  onDone,
  initialProviderId,
}: Props): React.ReactNode {
  const [providers, setProviders] = useState<ProviderItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<ProviderItem | null>(
    null,
  )
  const [step, setStep] = useState<Step>(initialProviderId ? 'pick' : 'pick')
  const [apiKey, setApiKey] = useState('')
  const [baseURL, setBaseURL] = useState('')
  const [defaultModel, setDefaultModel] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const didResolveInitialProvider = useRef(false)

  function handleCancel(): void {
    onDone('Cancelled provider connection', { display: 'system' })
  }

  function openProvider(provider: ProviderItem): void {
    const existing =
      getSettingsForSource('userSettings')?.providers?.[provider.id] ?? {}
    setSelectedProvider(provider)
    setApiKey(existing.apiKey ?? '')
    setBaseURL(existing.baseURL ?? '')
    setDefaultModel(existing.defaultModel ?? '')
    setSaveError(null)
    setStep('apiKey')
  }

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      setIsLoading(true)
      setLoadError(null)

      const refreshed = await refreshModelsDevCache().catch(() => null)
      const dataset = refreshed ?? (await getModelsDevDataset()).data

      if (!cancelled) {
        setProviders(buildProviderItems(dataset))
        setIsLoading(false)
      }
    }

    void load().catch(error => {
      if (!cancelled) {
        setLoadError(error instanceof Error ? error.message : String(error))
        setIsLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!initialProviderId || didResolveInitialProvider.current || providers.length === 0) {
      return
    }

    didResolveInitialProvider.current = true
    const normalized = initialProviderId.toLowerCase()
    const matched = providers.find(
      provider =>
        provider.id.toLowerCase() === normalized ||
        provider.name.toLowerCase() === normalized,
    )
    if (!matched) {
      onDone(`Provider '${initialProviderId}' not found`, { display: 'system' })
      return
    }

    if (matched.id === 'anthropic') {
      onDone(undefined, {
        display: 'skip',
        nextInput: '/login',
        submitNextInput: true,
      })
      return
    }

    openProvider(matched)
  }, [initialProviderId, onDone, providers])

  async function handleSave(): Promise<void> {
    if (!selectedProvider) {
      return
    }

    const trimmedApiKey = apiKey.trim()
    const trimmedBaseURL = baseURL.trim()
    const trimmedDefaultModel = defaultModel.trim()

    if (
      selectedProvider.switchable &&
      selectedProvider.id !== 'anthropic' &&
      !trimmedApiKey
    ) {
      setSaveError(`An API key is required for ${selectedProvider.name}.`)
      return
    }

    if (!trimmedApiKey && !trimmedBaseURL && !trimmedDefaultModel) {
      setSaveError('Enter at least one setting before saving.')
      return
    }

    setIsSaving(true)

    try {
      const result = updateSettingsForSource('userSettings', {
        providers: {
          [selectedProvider.id]: {
            apiKey: trimmedApiKey || undefined,
            baseURL: trimmedBaseURL || undefined,
            defaultModel: trimmedDefaultModel || undefined,
          },
        },
      } as never)

      if (result.error) {
        setSaveError(result.error.message)
        setIsSaving(false)
        return
      }

      const verification = await verifyProviderConnection(selectedProvider.id)
      const defaultModelLabel =
        trimmedDefaultModel || selectedProvider.suggestion || 'not set'

      if (selectedProvider.switchable) {
        const message = verification.ok
          ? `Saved ${selectedProvider.name} credentials. Recommended model: ${defaultModelLabel}`
          : `Saved ${selectedProvider.name} settings, but verification failed: ${verification.message ?? 'unknown error'}`

        onDone(message, {
          nextInput: '/models',
          submitNextInput: true,
        })
        return
      }

      onDone(
        `Saved ${selectedProvider.name} settings. Verification is unavailable in this public snapshot.`,
        { display: 'system' },
      )
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error))
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Pane color="permission">
        <Box flexDirection="column" gap={1}>
          <Text bold>Connect provider</Text>
          <Box>
            <Spinner />
            <Text>Loading models.dev provider directory…</Text>
          </Box>
        </Box>
      </Pane>
    )
  }

  if (loadError) {
    return (
      <Pane color="permission">
        <Box flexDirection="column" gap={1}>
          <Text bold>Connect provider</Text>
          <Text color="error">{loadError}</Text>
        </Box>
      </Pane>
    )
  }

  if (isSaving) {
    return (
      <Pane color="permission">
        <Box flexDirection="column" gap={1}>
          <Text bold>Connect provider</Text>
          <Box>
            <Spinner />
            <Text>Saving settings and verifying provider…</Text>
          </Box>
        </Box>
      </Pane>
    )
  }

  if (!selectedProvider || step === 'pick') {
    return (
      <ProviderPicker
        providers={providers}
        onCancel={handleCancel}
        onDone={onDone}
        onSelect={openProvider}
      />
    )
  }

  if (step === 'apiKey') {
    return (
      <FieldStep
        title={`Connect ${selectedProvider.name}`}
        description={
          <Box flexDirection="column">
            <Text dimColor>{selectedProvider.id}</Text>
            <Text>
              Enter an API key for {selectedProvider.name}. This will be stored
              in your user settings.
            </Text>
            {selectedProvider.envVars.length > 0 ? (
              <Text dimColor>
                Known environment variables: {selectedProvider.envVars.join(' or ')}
              </Text>
            ) : null}
          </Box>
        }
        value={apiKey}
        onChange={setApiKey}
        onSubmit={() => setStep('baseURL')}
        onExit={handleCancel}
        placeholder="API key"
        mask="*"
      />
    )
  }

  if (step === 'baseURL') {
    return (
      <FieldStep
        title={`${selectedProvider.name} base URL`}
        description={
          <Box flexDirection="column">
            <Text>Optional. Leave this alone unless you need a proxy or custom endpoint.</Text>
            {selectedProvider.baseURL ? (
              <Text dimColor>Default: {selectedProvider.baseURL}</Text>
            ) : null}
          </Box>
        }
        value={baseURL}
        onChange={setBaseURL}
        onSubmit={() => setStep('defaultModel')}
        onExit={handleCancel}
        placeholder={selectedProvider.baseURL || 'https://…'}
      />
    )
  }

  if (step === 'defaultModel') {
    return (
      <FieldStep
        title={`${selectedProvider.name} default model`}
        description={
          <Box flexDirection="column">
            <Text>Optional. This is only a saved preference for the provider.</Text>
            {selectedProvider.suggestion ? (
              <Text dimColor>Suggested: {selectedProvider.suggestion}</Text>
            ) : null}
          </Box>
        }
        value={defaultModel}
        onChange={setDefaultModel}
        onSubmit={() => setStep('confirm')}
        onExit={handleCancel}
        placeholder={selectedProvider.suggestion || 'model-id'}
      />
    )
  }

  return (
    <ConfirmStep
      provider={selectedProvider}
      apiKey={apiKey}
      baseURL={baseURL}
      defaultModel={defaultModel}
      error={saveError}
      onSave={() => {
        void handleSave()
      }}
      onCancel={handleCancel}
    />
  )
}

export const call: LocalJSXCommandCall = async (
  onDone,
  _context,
  args,
): Promise<React.ReactNode> => {
  const initialProviderId = args?.trim() || undefined
  return (
    <ConnectProviderWizard
      onDone={onDone}
      initialProviderId={initialProviderId}
    />
  )
}
