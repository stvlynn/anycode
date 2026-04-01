import { useMemo } from 'react'

export function useFrustrationDetection(): {
  shouldShowFrustrationPrompt: boolean
} {
  return useMemo(
    () => ({
      shouldShowFrustrationPrompt: false,
    }),
    [],
  )
}
