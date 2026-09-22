import { ApiError, parseProblemResponse } from './problem'

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const DEFAULT_TIMEOUT_MS = 15000
const DEFAULT_BINARY_MIME = 'application/octet-stream'

type BodyKind = 'none' | 'json' | 'binary'
type AbortCause = 'caller' | 'timeout'

interface RequestCancellation {
  signal: AbortSignal
  getAbortCause: () => AbortCause | undefined
  cleanup: () => void
}

function createRequestCancellation(signal: AbortSignal | undefined, timeoutMs: number): RequestCancellation {
  const controller = new AbortController()
  let abortCause: AbortCause | undefined
  const abort = (cause: AbortCause) => {
    if (abortCause) return
    abortCause = cause
    controller.abort()
  }
  const abortFromCaller = () => abort('caller')

  if (signal?.aborted) abortFromCaller()
  else signal?.addEventListener('abort', abortFromCaller, { once: true })

  const timer = setTimeout(() => abort('timeout'), timeoutMs)
  return {
    signal: controller.signal,
    getAbortCause: () => abortCause,
    cleanup: () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abortFromCaller)
    },
  }
}

function abortApiError(cause: AbortCause): ApiError {
  return new ApiError({ status: 0, code: cause === 'caller' ? 'CANCELLED' : 'TIMEOUT' })
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

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
  /** Caller-provided key for endpoints whose mutation contract is explicitly idempotent. */
  idempotencyKey?: string
  /** Cancels only this request; timeout cancellation remains reported as TIMEOUT. */
  signal?: AbortSignal
}

export interface UploadOptions extends RequestOptions {
  /** Required for Blob inputs because Blob has no filename metadata. */
  filename?: string
}

/** Existing feature-facing JSON transport contract. */
export interface HttpClient {
  get: <T>(path: string, options?: RequestOptions) => Promise<T>
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>
  del: <T>(path: string, options?: RequestOptions) => Promise<T>
}

/** Extended transport for features that need PATCH or authenticated binary transfer. */
export interface HttpTransport extends HttpClient {
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>
  /** Uploads a File or Blob with a server-required MIME type and filename header. */
  upload: <T>(path: string, body: Blob, options?: UploadOptions) => Promise<T>
  /** Retrieves private response bytes through the authenticated API, never a signed URL. */
  download: (path: string, options?: RequestOptions) => Promise<Blob>
}

export function isHttpTransport(client: HttpClient): client is HttpTransport {
  return 'patch' in client && 'upload' in client && 'download' in client
}

function assertRelativeApiPath(path: string): void {
  if (!path.startsWith('/') || path.startsWith('//') || !path.startsWith('/api/')) {
    throw new Error('HTTP client requires a relative API path starting with /api/.')
  }
}

function buildHeaders(
  bodyKind: BodyKind,
  csrfToken: string | null,
  isMutating: boolean,
  options: RequestOptions,
  binaryMime?: string,
  filename?: string,
): Headers {
  const headers = new Headers()
  headers.set('Accept', 'application/json, application/problem+json')
  if (bodyKind === 'json') headers.set('Content-Type', 'application/json')
  if (bodyKind === 'binary') {
    headers.set('Content-Type', binaryMime || DEFAULT_BINARY_MIME)
    headers.set('X-Filename', filename!)
  }
  if (isMutating && csrfToken) headers.set('X-CSRF-Token', csrfToken)
  if (options.ifMatch !== undefined) headers.set('If-Match', `"${options.ifMatch}"`)
  if (options.idempotencyKey !== undefined) headers.set('Idempotency-Key', options.idempotencyKey)
  return headers
}

export function isWireSafeFilename(filename: string): boolean {
  return (
    filename.length > 0 &&
    filename.length <= 255 &&
    filename.trim() === filename &&
    /^[\x20-\x7e]+$/.test(filename) &&
    !filename.includes('/') &&
    !filename.includes('\\') &&
    !filename.includes('..') &&
    filename !== '.'
  )
}

function getUploadFilename(body: Blob, explicitFilename: string | undefined): string {
  const fileName =
    explicitFilename ??
    (typeof File !== 'undefined' && body instanceof File ? body.name : undefined)

  if (!fileName || !isWireSafeFilename(fileName)) {
    throw new Error('Binary uploads require a safe printable ASCII filename without paths or control characters.')
  }

  return fileName
}

async function parseJsonSuccess<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T
  const text = await response.text()
  if (!text) return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    throw new ApiError({ status: response.status, code: 'MALFORMED_RESPONSE' })
  }
}

function parseBlobSuccess(response: Response): Promise<Blob> {
  return response.blob()
}

export function createHttpClient(options: HttpClientOptions): HttpTransport {
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  async function rawRequest(
    method: string,
    path: string,
    body: unknown,
    bodyKind: BodyKind,
    requestOptions: RequestOptions,
    cancellation: RequestCancellation,
    binaryMime?: string,
    filename?: string,
  ): Promise<Response> {
    assertRelativeApiPath(path)
    const isMutating = MUTATING_METHODS.has(method)
    const headers = buildHeaders(
      bodyKind,
      options.getCsrfToken(),
      isMutating,
      requestOptions,
      binaryMime,
      filename,
    )

    try {
      return await fetchImpl(`${options.baseUrl}${path}`, {
        method,
        credentials: 'include',
        cache: 'no-store',
        headers,
        signal: cancellation.signal,
        body:
          bodyKind === 'json' && body !== undefined
            ? JSON.stringify(body)
            : bodyKind === 'binary'
              ? (body as Blob)
              : undefined,
      })
    } catch (error) {
      const abortCause = cancellation.getAbortCause()
      if (isAbortError(error) && abortCause) throw abortApiError(abortCause)
      throw new ApiError({ status: 0, code: 'NETWORK' })
    }
  }

  async function rotateCsrf(): Promise<void> {
    // Rotation is its own request: it must never inherit the caller's precondition or idempotency key.
    const data = await request<{ csrf_token: string }>('GET', '/api/v1/auth/csrf', undefined, 'none', {}, true)
    options.setCsrfToken(data.csrf_token)
  }

  async function request<T>(
    method: string,
    path: string,
    body: unknown,
    bodyKind: BodyKind,
    requestOptions: RequestOptions,
    isRetry = false,
    parseSuccess: (response: Response) => Promise<T> = parseJsonSuccess,
    binaryMime?: string,
    filename?: string,
  ): Promise<T> {
    const cancellation = createRequestCancellation(requestOptions.signal, timeoutMs)
    try {
      const response = await rawRequest(
        method,
        path,
        body,
        bodyKind,
        requestOptions,
        cancellation,
        binaryMime,
        filename,
      )

      if (response.ok) return await parseSuccess(response)

      const error = await parseProblemResponse(response.clone())

      if (error.status === 403 && error.code === 'CSRF_INVALID' && !isRetry) {
        options.onCsrfInvalid?.()
        await rotateCsrf()
        return request<T>(
          method,
          path,
          body,
          bodyKind,
          requestOptions,
          true,
          parseSuccess,
          binaryMime,
          filename,
        )
      }

      if (error.status === 401 && error.code === 'AUTHENTICATION_REQUIRED') options.onUnauthorized()

      throw error
    } catch (error) {
      const abortCause = cancellation.getAbortCause()
      if (isAbortError(error) && abortCause) throw abortApiError(abortCause)
      throw error
    } finally {
      cancellation.cleanup()
    }
  }

  return {
    get: <T>(path: string, requestOptions: RequestOptions = {}) =>
      request<T>('GET', path, undefined, 'none', requestOptions),
    post: <T>(path: string, body?: unknown, requestOptions: RequestOptions = {}) =>
      request<T>('POST', path, body, body === undefined ? 'none' : 'json', requestOptions),
    put: <T>(path: string, body?: unknown, requestOptions: RequestOptions = {}) =>
      request<T>('PUT', path, body, body === undefined ? 'none' : 'json', requestOptions),
    patch: <T>(path: string, body?: unknown, requestOptions: RequestOptions = {}) =>
      request<T>('PATCH', path, body, body === undefined ? 'none' : 'json', requestOptions),
    del: <T>(path: string, requestOptions: RequestOptions = {}) =>
      request<T>('DELETE', path, undefined, 'none', requestOptions),
    upload: <T>(path: string, body: Blob, uploadOptions: UploadOptions = {}) => {
      const filename = getUploadFilename(body, uploadOptions.filename)
      return request<T>('POST', path, body, 'binary', uploadOptions, false, parseJsonSuccess, body.type, filename)
    },
    download: (path: string, requestOptions: RequestOptions = {}) =>
      request<Blob>('GET', path, undefined, 'none', requestOptions, false, parseBlobSuccess),
  }
}
