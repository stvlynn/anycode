import type { SystemTheme } from './systemTheme.js'

export function watchSystemTheme(
  _querier: unknown,
  _onTheme: (theme: SystemTheme) => void,
): () => void {
  return () => {}
}
