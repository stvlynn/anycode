import type { AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from '../../services/analytics/index.js'
import { getMainLoopModelOverride } from '../../bootstrap/state.js'
import { getSettings_DEPRECATED } from '../settings/settings.js'
import { isEnvTruthy } from '../envUtils.js'

export type APIProvider = 'firstParty' | 'bedrock' | 'vertex' | 'foundry'
export type ActiveProvider = string

export function isAnthropicLikeModelName(model: string): boolean {
  return /\b(claude|sonnet|haiku|opus)\b/i.test(model)
}

export function getAPIProvider(): APIProvider {
  return isEnvTruthy(process.env.CLAUDE_CODE_USE_BEDROCK)
    ? 'bedrock'
    : isEnvTruthy(process.env.CLAUDE_CODE_USE_VERTEX)
      ? 'vertex'
      : isEnvTruthy(process.env.CLAUDE_CODE_USE_FOUNDRY)
        ? 'foundry'
        : 'firstParty'
}

export function getAPIProviderForStatsig(): AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS {
  return getAPIProvider() as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
}

export function getActiveModelProvider(): ActiveProvider {
  const runtimeOverride = getMainLoopModelOverride()
  if (typeof runtimeOverride === 'string' && runtimeOverride.includes('/')) {
    return runtimeOverride.split('/')[0] as ActiveProvider
  }

  const explicitProvider = process.env.CLAUDE_CODE_PROVIDER
  if (explicitProvider) {
    return explicitProvider as ActiveProvider
  }

  const explicitModel = process.env.CLAUDE_CODE_MODEL || process.env.ANTHROPIC_MODEL
  if (explicitModel?.includes('/')) {
    return explicitModel.split('/')[0] as ActiveProvider
  }

  const settings = (getSettings_DEPRECATED() || {}) as {
    model?: string
    providers?: Record<string, { enabled?: boolean }>
  }

  if (settings.model?.includes('/')) {
    return settings.model.split('/')[0] as ActiveProvider
  }

  const enabled = Object.entries(settings.providers || {}).find(
    ([, value]) => value?.enabled,
  )
  if (enabled) {
    return enabled[0] as ActiveProvider
  }

  return 'anthropic'
}

/**
 * Check if ANTHROPIC_BASE_URL is a first-party Anthropic API URL.
 * Returns true if not set (default API) or points to api.anthropic.com
 * (or api-staging.anthropic.com for ant users).
 */
export function isFirstPartyAnthropicBaseUrl(): boolean {
  const baseUrl = process.env.ANTHROPIC_BASE_URL
  if (!baseUrl) {
    return true
  }
  try {
    const host = new URL(baseUrl).host
    const allowedHosts = ['api.anthropic.com']
    if (process.env.USER_TYPE === 'ant') {
      allowedHosts.push('api-staging.anthropic.com')
    }
    return allowedHosts.includes(host)
  } catch {
    return false
  }
}
