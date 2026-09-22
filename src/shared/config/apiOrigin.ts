const LOCAL_API_PROXY_TARGET = 'http://localhost:8080'

function validateOrigin(value: string, variableName: string, requireHttps: boolean): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${variableName} must be an origin-only URL.`)
  }

  const hasPath = url.pathname !== '/'
  if (
    (requireHttps && url.protocol !== 'https:') ||
    (!requireHttps && url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    hasPath ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${variableName} must be an origin-only ${requireHttps ? 'HTTPS ' : ''}URL.`)
  }

  return url.origin
}

/**
 * Resolves the browser-visible API origin. Empty intentionally means same-origin, so deployed
 * panels do not need a second public host. API routes remain relative `/api/v1/...` paths.
 */
export function resolveApiBaseUrl(value: string | undefined, isProduction: boolean): string {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return ''
  return validateOrigin(trimmed, 'VITE_API_BASE_URL', isProduction)
}

/** Every Vite build is a deployable artifact, regardless of its selected mode. */
export function resolveApiBaseUrlForCommand(value: string | undefined, command: 'serve' | 'build'): string {
  return resolveApiBaseUrl(value, command === 'build')
}

/**
 * Vite reads this server-only value while starting development mode; it is never exposed through
 * import.meta.env. Restrict it to an origin to keep proxy routing independent of request paths.
 */
export function resolveDevApiProxyTarget(value: string | undefined): string {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return LOCAL_API_PROXY_TARGET
  return validateOrigin(trimmed, 'DEV_API_PROXY_TARGET', false)
}
