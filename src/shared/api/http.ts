import { ApiError, parseProblemResponse } from './problem'

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const DEFAULT_TIMEOUT_MS = 15000

export interface HttpClientOptions {
  baseUrl: string
  getCsrfToken: () => string | null
  setCsrfToken: (token: string) => void
  onUnauthorized: () => void
  onCsrfInvalid?: () => void
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export interface RequestOptions {
  /** Aggregate version for optimistic concurrency, sent as a strong entity tag. */
  ifMatch?: number
}

export interface HttpClient {
  get: <T>(path: string) => Promise<T>
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>
  del: <T>(path: string, options?: RequestOptions) => Promise<T>
}

function buildHeaders(
  hasBody: boolean,
  csrfToken: string | null,
  isMutating: boolean,
  options: RequestOptions,
): Headers {
  const headers = new Headers()
  headers.set('Accept', 'application/json, application/problem+json')
  if (hasBody) headers.set('Content-Type', 'application/json')
  if (isMutating && csrfToken) headers.set('X-CSRF-Token', csrfToken)
  if (options.ifMatch !== undefined) headers.set('If-Match', `"${options.ifMatch}"`)
  return headers
}

async function parseSuccess<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T
  const text = await response.text()
  if (!text) return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    throw new ApiError({ status: response.status, code: 'MALFORMED_RESPONSE' })
  }
}

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  async function rawRequest(
    method: string,
    path: string,
    body: unknown,
    requestOptions: RequestOptions,
  ): Promise<Response> {
    const isMutating = MUTATING_METHODS.has(method)
    const headers = buildHeaders(
      body !== undefined,
      options.getCsrfToken(),
      isMutating,
      requestOptions,
    )
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      return await fetchImpl(`${options.baseUrl}${path}`, {
        method,
        credentials: 'include',
        cache: 'no-store',
        headers,
        signal: controller.signal,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError({ status: 0, code: 'TIMEOUT' })
      }
      throw new ApiError({ status: 0, code: 'NETWORK' })
    } finally {
      clearTimeout(timer)
    }
  }

  async function rotateCsrf(): Promise<void> {
    // Rotation is its own request: it must never inherit the caller's precondition.
    const data = await request<{ csrf_token: string }>('GET', '/api/v1/auth/csrf', undefined, {}, true)
    options.setCsrfToken(data.csrf_token)
  }

  async function request<T>(
    method: string,
    path: string,
    body: unknown,
    requestOptions: RequestOptions,
    isRetry = false,
  ): Promise<T> {
    const response = await rawRequest(method, path, body, requestOptions)

    if (response.ok) {
      return parseSuccess<T>(response)
    }

    const error = await parseProblemResponse(response.clone())

    if (error.status === 403 && error.code === 'CSRF_INVALID' && !isRetry) {
      options.onCsrfInvalid?.()
      await rotateCsrf()
      return request<T>(method, path, body, requestOptions, true)
    }

    if (error.status === 401 && error.code === 'AUTHENTICATION_REQUIRED') {
      options.onUnauthorized()
    }

    throw error
  }

  return {
    get: <T>(path: string) => request<T>('GET', path, undefined, {}),
    post: <T>(path: string, body?: unknown, requestOptions: RequestOptions = {}) =>
      request<T>('POST', path, body, requestOptions),
    put: <T>(path: string, body?: unknown, requestOptions: RequestOptions = {}) =>
      request<T>('PUT', path, body, requestOptions),
    del: <T>(path: string, requestOptions: RequestOptions = {}) =>
      request<T>('DELETE', path, undefined, requestOptions),
  }
}
