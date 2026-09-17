import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAuthClient } from './authClient'

function problemResponse(status: number, code: string) {
  return new Response(JSON.stringify({ status, code, title: code }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}

describe('createAuthClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates an api and an empty csrf token store', () => {
    const client = createAuthClient(() => {})

    expect(client.csrfTokenStore.get()).toBeNull()
    expect(client.api.login).toBeTypeOf('function')
  })

  it('clears its own csrf token store before calling onUnauthorized', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(problemResponse(401, 'AUTHENTICATION_REQUIRED')))
    const onUnauthorized = vi.fn()
    const client = createAuthClient(onUnauthorized)
    client.csrfTokenStore.set('token-1')

    await expect(client.api.me()).rejects.toBeDefined()

    expect(client.csrfTokenStore.get()).toBeNull()
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })
})
