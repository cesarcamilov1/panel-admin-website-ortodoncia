import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHttpClient } from './http'
import { isApiError } from './problem'

function problemResponse(status: number, code: string, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ status, code, title: code, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function delayedAbortRejection(signal: AbortSignal, delayMs = 2000): Promise<never> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener(
      'abort',
      () => setTimeout(() => reject(new DOMException('aborted', 'AbortError')), delayMs),
      { once: true },
    )
  })
}

describe('createHttpClient', () => {
  let fetchImpl: ReturnType<typeof vi.fn>
  let getCsrfToken: Mock<() => string | null>
  let setCsrfToken: Mock<(token: string) => void>
  let onUnauthorized: Mock<() => void>

  beforeEach(() => {
    fetchImpl = vi.fn()
    getCsrfToken = vi.fn(() => null as string | null)
    setCsrfToken = vi.fn()
    onUnauthorized = vi.fn()
  })

  function client() {
    return createHttpClient({
      baseUrl: '',
      getCsrfToken,
      setCsrfToken,
      onUnauthorized,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
  }

  it('sends a JSON body with the expected headers on post', async () => {
    fetchImpl.mockResolvedValueOnce(jsonResponse({ ok: true }))

    const http = client()
    await http.post('/api/v1/auth/login', { email: 'a@b.com', password: 'x' })

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/auth/login')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(init.cache).toBe('no-store')
    const headers = init.headers as Headers
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('Accept')).toBe('application/json, application/problem+json')
    expect(JSON.parse(init.body as string)).toEqual({ email: 'a@b.com', password: 'x' })
  })

  it('does not send Content-Type when there is no body', async () => {
    fetchImpl.mockResolvedValueOnce(jsonResponse({ ok: true }))
    const http = client()
    await http.get('/api/v1/auth/me')

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Headers
    expect(headers.has('Content-Type')).toBe(false)
  })

  it('injects the csrf token only on mutating requests when one is set', async () => {
    getCsrfToken.mockReturnValue('token-123')
    fetchImpl.mockResolvedValueOnce(jsonResponse({ ok: true }))

    const http = client()
    await http.post('/api/v1/auth/logout')

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Headers
    expect(headers.get('X-CSRF-Token')).toBe('token-123')
  })

  it('does not inject the csrf token on GET requests', async () => {
    getCsrfToken.mockReturnValue('token-123')
    fetchImpl.mockResolvedValueOnce(jsonResponse({ ok: true }))

    const http = client()
    await http.get('/api/v1/auth/me')

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Headers
    expect(headers.has('X-CSRF-Token')).toBe(false)
  })

  it('returns undefined for a 204 response', async () => {
    fetchImpl.mockResolvedValueOnce(new Response(null, { status: 204 }))
    const http = client()
    const result = await http.post('/api/v1/auth/logout')
    expect(result).toBeUndefined()
  })

  it('parses a problem+json error response into an ApiError', async () => {
    fetchImpl.mockResolvedValueOnce(problemResponse(400, 'MALFORMED_REQUEST', { detail: 'bad body' }))
    const http = client()

    await expect(http.post('/api/v1/auth/login', {})).rejects.toSatisfy((error: unknown) => {
      return isApiError(error) && error.status === 400 && error.code === 'MALFORMED_REQUEST'
    })
  })

  it('reads Retry-After on 429', async () => {
    fetchImpl.mockResolvedValue(
      new Response(JSON.stringify({ status: 429, code: 'RATE_LIMITED' }), {
        status: 429,
        headers: { 'Content-Type': 'application/problem+json', 'Retry-After': '30' },
      }),
    )
    const http = client()
    await expect(http.post('/api/v1/auth/login', {})).rejects.toSatisfy((error: unknown) => {
      return isApiError(error) && error.retryAfterSeconds === 30
    })
  })

  it('calls onUnauthorized for AUTHENTICATION_REQUIRED but not INVALID_CREDENTIALS', async () => {
    fetchImpl.mockResolvedValueOnce(problemResponse(401, 'AUTHENTICATION_REQUIRED'))
    const http = client()
    await expect(http.get('/api/v1/auth/me')).rejects.toBeDefined()
    expect(onUnauthorized).toHaveBeenCalledTimes(1)

    onUnauthorized.mockClear()
    fetchImpl.mockResolvedValueOnce(problemResponse(401, 'INVALID_CREDENTIALS'))
    await expect(http.post('/api/v1/auth/login', {})).rejects.toBeDefined()
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('rotates the csrf token and retries once on CSRF_INVALID', async () => {
    getCsrfToken.mockReturnValue('stale-token')
    setCsrfToken.mockImplementation((token: string) => getCsrfToken.mockReturnValue(token))
    fetchImpl
      .mockResolvedValueOnce(problemResponse(403, 'CSRF_INVALID'))
      .mockResolvedValueOnce(jsonResponse({ csrf_token: 'fresh-token' }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))

    const http = client()
    const result = await http.post('/api/v1/auth/logout')

    expect(result).toEqual({ ok: true })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(fetchImpl.mock.calls[1][0]).toBe('/api/v1/auth/csrf')
    expect(setCsrfToken).toHaveBeenCalledWith('fresh-token')
    const retryHeaders = (fetchImpl.mock.calls[2][1] as RequestInit).headers as Headers
    expect(retryHeaders.get('X-CSRF-Token')).toBe('fresh-token')
  })

  it('does not retry a second time when CSRF_INVALID persists', async () => {
    getCsrfToken.mockReturnValue('stale-token')
    fetchImpl
      .mockResolvedValueOnce(problemResponse(403, 'CSRF_INVALID'))
      .mockResolvedValueOnce(jsonResponse({ csrf_token: 'fresh-token' }))
      .mockResolvedValueOnce(problemResponse(403, 'CSRF_INVALID'))

    const http = client()
    await expect(http.post('/api/v1/auth/logout')).rejects.toSatisfy((error: unknown) => {
      return isApiError(error) && error.code === 'CSRF_INVALID'
    })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('calls onUnauthorized once and does not retry again when csrf rotation itself is unauthorized', async () => {
    getCsrfToken.mockReturnValue('stale-token')
    fetchImpl
      .mockResolvedValueOnce(problemResponse(403, 'CSRF_INVALID'))
      .mockResolvedValueOnce(problemResponse(401, 'AUTHENTICATION_REQUIRED'))

    const http = client()
    await expect(http.post('/api/v1/auth/logout')).rejects.toSatisfy((error: unknown) => {
      return isApiError(error) && error.status === 401 && error.code === 'AUTHENTICATION_REQUIRED'
    })

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('wraps a non-JSON success body into a MALFORMED_RESPONSE ApiError', async () => {
    fetchImpl.mockResolvedValueOnce(
      new Response('not json', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )
    const http = client()
    await expect(http.get('/api/v1/auth/me')).rejects.toSatisfy((error: unknown) => {
      return isApiError(error) && error.status === 200 && error.code === 'MALFORMED_RESPONSE'
    })
  })

  it('produces a TIMEOUT ApiError when the request exceeds the timeout', async () => {
    vi.useFakeTimers()
    fetchImpl.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const error = new DOMException('aborted', 'AbortError')
            reject(error)
          })
        }),
    )

    const http = createHttpClient({
      baseUrl: '',
      getCsrfToken,
      setCsrfToken,
      onUnauthorized,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 1000,
    })

    const pending = http.get('/api/v1/auth/me')
    const assertion = expect(pending).rejects.toSatisfy((error: unknown) => {
      return isApiError(error) && error.code === 'TIMEOUT' && error.status === 0
    })
    await vi.advanceTimersByTimeAsync(1000)
    await assertion
    vi.useRealTimers()
  })

  it('preserves TIMEOUT when a caller abort follows a delayed fetch rejection', async () => {
    vi.useFakeTimers()
    const caller = new AbortController()
    fetchImpl.mockImplementation((_url: string, init: RequestInit) => delayedAbortRejection(init.signal!))
    const http = createHttpClient({
      baseUrl: '',
      getCsrfToken,
      setCsrfToken,
      onUnauthorized,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 1000,
    })

    try {
      const pending = http.get('/api/v1/auth/me', { signal: caller.signal })
      const assertion = expect(pending).rejects.toSatisfy((error: unknown) => {
        return isApiError(error) && error.code === 'TIMEOUT'
      })
      await vi.advanceTimersByTimeAsync(1000)
      caller.abort()
      await vi.advanceTimersByTimeAsync(2000)
      await assertion
    } finally {
      vi.useRealTimers()
    }
  })

  it('preserves CANCELLED when timeout follows a delayed fetch rejection', async () => {
    vi.useFakeTimers()
    const caller = new AbortController()
    fetchImpl.mockImplementation((_url: string, init: RequestInit) => delayedAbortRejection(init.signal!))
    const http = createHttpClient({
      baseUrl: '',
      getCsrfToken,
      setCsrfToken,
      onUnauthorized,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 1000,
    })

    try {
      const pending = http.get('/api/v1/auth/me', { signal: caller.signal })
      const assertion = expect(pending).rejects.toSatisfy((error: unknown) => {
        return isApiError(error) && error.code === 'CANCELLED'
      })
      caller.abort()
      await vi.advanceTimersByTimeAsync(3000)
      await assertion
    } finally {
      vi.useRealTimers()
    }
  })

  it('produces a NETWORK ApiError when fetch rejects', async () => {
    fetchImpl.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const http = client()
    await expect(http.get('/api/v1/auth/me')).rejects.toSatisfy((error: unknown) => {
      return isApiError(error) && error.code === 'NETWORK' && error.status === 0
    })
  })
})

describe('createHttpClient mutating verbs', () => {
  let fetchImpl: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchImpl = vi.fn()
  })

  function client() {
    return createHttpClient({
      baseUrl: '',
      getCsrfToken: () => 'token-123',
      setCsrfToken: vi.fn(),
      onUnauthorized: vi.fn(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
  }

  it('sends a PUT with body, csrf token and no If-Match by default', async () => {
    fetchImpl.mockResolvedValueOnce(jsonResponse({ id: 'svc-1' }))

    const http = client()
    const result = await http.put('/api/v1/services/svc-1', { name: 'Limpieza' })

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/services/svc-1')
    expect(init.method).toBe('PUT')
    const headers = init.headers as Headers
    expect(headers.get('X-CSRF-Token')).toBe('token-123')
    expect(headers.has('If-Match')).toBe(false)
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Limpieza' })
    expect(result).toEqual({ id: 'svc-1' })
  })

  it('sends the version as a quoted If-Match entity tag', async () => {
    fetchImpl.mockResolvedValueOnce(jsonResponse({ id: 'svc-1' }))

    const http = client()
    await http.put('/api/v1/services/svc-1', { name: 'Limpieza' }, { ifMatch: 4 })

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Headers).get('If-Match')).toBe('"4"')
  })

  it('sends a DELETE without a body', async () => {
    fetchImpl.mockResolvedValueOnce(new Response(null, { status: 204 }))

    const http = client()
    const result = await http.del('/api/v1/schedules/svc-1')

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('DELETE')
    expect(init.body).toBeUndefined()
    expect((init.headers as Headers).has('Content-Type')).toBe(false)
    expect(result).toBeUndefined()
  })

  it('preserves the If-Match header when retrying after a csrf rotation', async () => {
    fetchImpl
      .mockResolvedValueOnce(problemResponse(403, 'CSRF_INVALID'))
      .mockResolvedValueOnce(jsonResponse({ csrf_token: 'fresh-token' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'svc-1' }))

    const http = client()
    await http.put('/api/v1/services/svc-1', { name: 'Limpieza' }, { ifMatch: 7 })

    expect(fetchImpl).toHaveBeenCalledTimes(3)
    const retryHeaders = (fetchImpl.mock.calls[2][1] as RequestInit).headers as Headers
    expect(retryHeaders.get('If-Match')).toBe('"7"')
  })

  it('does not send If-Match on the csrf rotation request itself', async () => {
    fetchImpl
      .mockResolvedValueOnce(problemResponse(403, 'CSRF_INVALID'))
      .mockResolvedValueOnce(jsonResponse({ csrf_token: 'fresh-token' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'svc-1' }))

    const http = client()
    await http.put('/api/v1/services/svc-1', {}, { ifMatch: 7 })

    const rotationHeaders = (fetchImpl.mock.calls[1][1] as RequestInit).headers as Headers
    expect(rotationHeaders.has('If-Match')).toBe(false)
  })

  it('sends PATCH JSON with the CSRF token and optimistic version', async () => {
    fetchImpl.mockResolvedValueOnce(jsonResponse({ id: 'patient-1' }))

    const http = client()
    await http.patch('/api/v1/patients/patient-1', { phone: '5550100' }, { ifMatch: 3 })

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('PATCH')
    expect((init.headers as Headers).get('X-CSRF-Token')).toBe('token-123')
    expect((init.headers as Headers).get('If-Match')).toBe('"3"')
    expect(JSON.parse(init.body as string)).toEqual({ phone: '5550100' })
  })

  it('preserves an explicit idempotency key while retrying after CSRF rotation', async () => {
    fetchImpl
      .mockResolvedValueOnce(problemResponse(403, 'CSRF_INVALID'))
      .mockResolvedValueOnce(jsonResponse({ csrf_token: 'fresh-token' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'appointment-1' }))

    const http = client()
    await http.post('/api/v1/appointments', { patient_id: 'patient-1' }, { idempotencyKey: 'idempotency-key-123' })

    const firstHeaders = (fetchImpl.mock.calls[0][1] as RequestInit).headers as Headers
    const retryHeaders = (fetchImpl.mock.calls[2][1] as RequestInit).headers as Headers
    expect(firstHeaders.get('Idempotency-Key')).toBe('idempotency-key-123')
    expect(retryHeaders.get('Idempotency-Key')).toBe('idempotency-key-123')
  })

  it('uploads a File as its binary MIME body with an X-Filename header', async () => {
    fetchImpl.mockResolvedValueOnce(jsonResponse({ id: 'file-1' }, 201))
    const file = new File(['pdf bytes'], 'consent.pdf', { type: 'application/pdf' })

    const http = client()
    await http.upload('/api/v1/files?patient_id=patient-1&category=CONSENT', file)

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Headers
    expect(init.method).toBe('POST')
    expect(init.body).toBe(file)
    expect(headers.get('Content-Type')).toBe('application/pdf')
    expect(headers.get('X-Filename')).toBe('consent.pdf')
  })

  it('uploads a Blob with an explicit filename and falls back to octet-stream for a missing MIME', async () => {
    fetchImpl.mockResolvedValueOnce(jsonResponse({ id: 'file-1' }, 201))
    const blob = new Blob(['bytes'])

    const http = client()
    await http.upload('/api/v1/files?patient_id=patient-1&category=CONSENT', blob, {
      filename: 'scan.bin',
    })

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Headers
    expect(init.body).toBe(blob)
    expect(headers.get('Content-Type')).toBe('application/octet-stream')
    expect(headers.get('X-Filename')).toBe('scan.bin')
  })

  it('rejects unsafe wire filenames before native Headers conversion or any network request', async () => {
    const http = client()

    expect(() => http.upload('/api/v1/files?patient_id=patient-1&category=CONSENT', new File(['pdf'], 'firma😀.pdf', { type: 'application/pdf' }))).toThrow(/printable ASCII/i)
    expect(() => http.upload('/api/v1/files?patient_id=patient-1&category=CONSENT', new File(['pdf'], 'firma\r\nX-Injected: true.pdf', { type: 'application/pdf' }))).toThrow(/printable ASCII/i)

    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('downloads an authenticated binary response without JSON parsing', async () => {
    fetchImpl.mockResolvedValueOnce(
      new Response('private file', { status: 200, headers: { 'Content-Type': 'application/pdf' } }),
    )

    const http = client()
    const result = await http.download('/api/v1/files/file-1/download?patient_id=patient-1')

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('GET')
    expect(init.credentials).toBe('include')
    expect(result).toBeInstanceOf(Blob)
    expect(await result.text()).toBe('private file')
  })

  it('maps caller cancellation to a CANCELLED ApiError', async () => {
    const abortController = new AbortController()
    fetchImpl.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )

    const http = client()
    const pending = http.download('/api/v1/files/file-1/download?patient_id=patient-1', {
      signal: abortController.signal,
    })
    abortController.abort()

    await expect(pending).rejects.toSatisfy((error: unknown) => {
      return isApiError(error) && error.code === 'CANCELLED' && error.status === 0
    })
  })

  it.each([
    ['get', (http: ReturnType<typeof client>, signal: AbortSignal) => http.get('/api/v1/auth/me', { signal })],
    [
      'download',
      (http: ReturnType<typeof client>, signal: AbortSignal) =>
        http.download('/api/v1/files/file-1/download?patient_id=patient-1', { signal }),
    ],
  ] as const)('preserves the first abort cause while parsing a delayed %s body', async (_method, request) => {
    for (const [firstCause, expectedCode] of [
      ['timeout', 'TIMEOUT'],
      ['caller', 'CANCELLED'],
    ] as const) {
      vi.useFakeTimers()
      const caller = new AbortController()
      fetchImpl.mockImplementation((_url: string, init: RequestInit) =>
        Promise.resolve({
          ok: true,
          status: 200,
          text: () => delayedAbortRejection(init.signal!),
          blob: () => delayedAbortRejection(init.signal!),
        } as unknown as Response),
      )
      const http = createHttpClient({
        baseUrl: '',
        getCsrfToken: () => null,
        setCsrfToken: vi.fn(),
        onUnauthorized: vi.fn(),
        fetchImpl: fetchImpl as unknown as typeof fetch,
        timeoutMs: 1000,
      })

      try {
        const pending = request(http, caller.signal)
        const assertion = expect(pending).rejects.toSatisfy((error: unknown) => {
          return isApiError(error) && error.code === expectedCode
        })
        await vi.advanceTimersByTimeAsync(0)
        if (firstCause === 'timeout') {
          await vi.advanceTimersByTimeAsync(1000)
          caller.abort()
        } else {
          caller.abort()
          await vi.advanceTimersByTimeAsync(1000)
        }
        await vi.advanceTimersByTimeAsync(2000)
        await assertion
      } finally {
        vi.useRealTimers()
      }
    }
  })

  it('rejects absolute and protocol-relative request paths', async () => {
    const http = client()

    await expect(http.get('https://invalid.example/api/v1/patients')).rejects.toThrow('relative API path')
    await expect(http.get('//invalid.example/api/v1/patients')).rejects.toThrow('relative API path')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
