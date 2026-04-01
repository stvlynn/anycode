export function parseConnectUrl(url: string): {
  serverUrl: string
  authToken?: string
} {
  try {
    const parsed = new URL(url)
    return {
      serverUrl: `${parsed.protocol}//${parsed.host}${parsed.pathname}`,
      authToken: parsed.searchParams.get('token') ?? undefined,
    }
  } catch {
    return { serverUrl: url }
  }
}
