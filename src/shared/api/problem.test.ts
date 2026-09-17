import { describe, expect, it } from 'vitest'
import { ApiError, isApiError, parseProblemResponse } from './problem'

function jsonResponse(body: unknown, status: number, contentType = 'application/problem+json') {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': contentType },
  })
}

describe('ApiError', () => {
  it('is recognized by isApiError', () => {
    const error = new ApiError({ status: 401, code: 'INVALID_CREDENTIALS' })
    expect(isApiError(error)).toBe(true)
    expect(isApiError(new Error('nope'))).toBe(false)
    expect(isApiError('nope')).toBe(false)
  })

  it('carries the documented fields', () => {
    const error = new ApiError({
      status: 429,
      code: 'RATE_LIMITED',
      detail: 'too many attempts',
      requestId: 'req-1',
      fields: [{ field: 'email', code: 'required', message: 'requerido' }],
      retryAfterSeconds: 30,
    })
    expect(error.status).toBe(429)
    expect(error.code).toBe('RATE_LIMITED')
    expect(error.detail).toBe('too many attempts')
    expect(error.requestId).toBe('req-1')
    expect(error.fields).toEqual([{ field: 'email', code: 'required', message: 'requerido' }])
    expect(error.retryAfterSeconds).toBe(30)
  })
})

describe('parseProblemResponse', () => {
  it('parses a well-formed problem+json body', async () => {
    const response = jsonResponse(
      {
        type: 'urn:consultorio:problem:invalid-credentials',
        title: 'Invalid credentials',
        status: 401,
        code: 'INVALID_CREDENTIALS',
        detail: 'bad login',
        request_id: 'req-42',
      },
      401,
    )

    const error = await parseProblemResponse(response)

    expect(error.status).toBe(401)
    expect(error.code).toBe('INVALID_CREDENTIALS')
    expect(error.detail).toBe('bad login')
    expect(error.requestId).toBe('req-42')
  })

  it('reads Retry-After on 429 responses', async () => {
    const response = new Response(
      JSON.stringify({ status: 429, code: 'RATE_LIMITED', title: 'Too many' }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/problem+json', 'Retry-After': '17' },
      },
    )

    const error = await parseProblemResponse(response)
    expect(error.retryAfterSeconds).toBe(17)
  })

  it('produces an UNKNOWN-coded error when the body is not parseable', async () => {
    const response = new Response('not json', { status: 500, headers: { 'Content-Type': 'text/plain' } })

    const error = await parseProblemResponse(response)
    expect(error.status).toBe(500)
    expect(error.code).toBe('UNKNOWN')
  })
})
