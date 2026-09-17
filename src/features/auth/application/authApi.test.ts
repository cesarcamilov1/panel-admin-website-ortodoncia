import { describe, expect, it, vi } from 'vitest'
import type { HttpClient } from '../../../shared/api/http'
import { isApiError } from '../../../shared/api/problem'
import { createAuthApi } from './authApi'

function fakeHttp(overrides: Partial<HttpClient> = {}): HttpClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    ...overrides,
  } as HttpClient
}

describe('createAuthApi', () => {
  it('login sends the documented body and returns an authenticated result', async () => {
    const post = vi.fn().mockResolvedValue({ mfa_required: false, csrf_token: 'tok' })
    const api = createAuthApi(fakeHttp({ post }))

    const result = await api.login({ email: 'a@b.mx', password: 'secret' })

    expect(post).toHaveBeenCalledWith('/api/v1/auth/login', { email: 'a@b.mx', password: 'secret' })
    expect(result).toEqual({ kind: 'authenticated', csrfToken: 'tok' })
  })

  it('login returns an mfa result when the backend requires it', async () => {
    const post = vi.fn().mockResolvedValue({ mfa_required: true, challenge_token: 'chal' })
    const api = createAuthApi(fakeHttp({ post }))

    const result = await api.login({ email: 'a@b.mx', password: 'secret' })

    expect(result).toEqual({ kind: 'mfa', challengeToken: 'chal' })
  })

  it('login throws a MALFORMED_RESPONSE error when mfa_required is true but challenge_token is missing', async () => {
    const post = vi.fn().mockResolvedValue({ mfa_required: true })
    const api = createAuthApi(fakeHttp({ post }))

    await expect(api.login({ email: 'a@b.mx', password: 'secret' })).rejects.toSatisfy(
      (error: unknown) => isApiError(error) && error.status === 200 && error.code === 'MALFORMED_RESPONSE',
    )
  })

  it('login throws a MALFORMED_RESPONSE error when mfa_required is false but csrf_token is missing', async () => {
    const post = vi.fn().mockResolvedValue({ mfa_required: false })
    const api = createAuthApi(fakeHttp({ post }))

    await expect(api.login({ email: 'a@b.mx', password: 'secret' })).rejects.toSatisfy(
      (error: unknown) => isApiError(error) && error.status === 200 && error.code === 'MALFORMED_RESPONSE',
    )
  })

  it('verifyMfa sends challenge_token and code', async () => {
    const post = vi.fn().mockResolvedValue({ csrf_token: 'tok' })
    const api = createAuthApi(fakeHttp({ post }))

    const result = await api.verifyMfa({ challengeToken: 'chal', code: '123456' })

    expect(post).toHaveBeenCalledWith('/api/v1/auth/mfa/verify', { challenge_token: 'chal', code: '123456' })
    expect(result).toEqual({ csrfToken: 'tok' })
  })

  it('logout posts to the logout endpoint', async () => {
    const post = vi.fn().mockResolvedValue(undefined)
    const api = createAuthApi(fakeHttp({ post }))
    await api.logout()
    expect(post).toHaveBeenCalledWith('/api/v1/auth/logout')
  })

  it('logoutAll posts to the logout-all endpoint', async () => {
    const post = vi.fn().mockResolvedValue(undefined)
    const api = createAuthApi(fakeHttp({ post }))
    await api.logoutAll()
    expect(post).toHaveBeenCalledWith('/api/v1/auth/logout-all')
  })

  it('me maps the dto into a CurrentUser', async () => {
    const get = vi.fn().mockResolvedValue({
      id: 'id-1',
      email: 'a@b.mx',
      first_name: 'Ana',
      last_name: 'Pérez',
      role: 'ASSISTANT',
      mfa_required: false,
    })
    const api = createAuthApi(fakeHttp({ get }))

    const user = await api.me()

    expect(get).toHaveBeenCalledWith('/api/v1/auth/me')
    expect(user).toEqual({
      id: 'id-1',
      email: 'a@b.mx',
      firstName: 'Ana',
      lastName: 'Pérez',
      role: 'ASSISTANT',
      mfaRequired: false,
    })
  })

  it('rotateCsrf gets the csrf endpoint', async () => {
    const get = vi.fn().mockResolvedValue({ csrf_token: 'fresh' })
    const api = createAuthApi(fakeHttp({ get }))
    const result = await api.rotateCsrf()
    expect(get).toHaveBeenCalledWith('/api/v1/auth/csrf')
    expect(result).toEqual({ csrfToken: 'fresh' })
  })

  it('forgotPassword sends the email', async () => {
    const post = vi.fn().mockResolvedValue({ message: 'ok' })
    const api = createAuthApi(fakeHttp({ post }))
    await api.forgotPassword('a@b.mx')
    expect(post).toHaveBeenCalledWith('/api/v1/auth/password/forgot', { email: 'a@b.mx' })
  })

  it('resetPassword sends token and new_password', async () => {
    const post = vi.fn().mockResolvedValue(undefined)
    const api = createAuthApi(fakeHttp({ post }))
    await api.resetPassword({ token: 'tok', newPassword: 'a-new-password-123' })
    expect(post).toHaveBeenCalledWith('/api/v1/auth/password/reset', {
      token: 'tok',
      new_password: 'a-new-password-123',
    })
  })
})
