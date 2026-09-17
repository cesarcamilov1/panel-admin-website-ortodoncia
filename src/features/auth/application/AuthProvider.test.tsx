import { act, render, screen, waitFor } from '@testing-library/react'
import { createRef, forwardRef, useImperativeHandle } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { HttpClient } from '../../../shared/api/http'
import { useHttp } from '../../../shared/api/httpContext'
import { ApiError } from '../../../shared/api/problem'
import type { AuthApi } from './authApi'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './authContext'

const USER = {
  id: 'id-1',
  email: 'mariana@clinica.mx',
  firstName: 'Mariana',
  lastName: 'Cázares',
  role: 'OWNER_DENTIST' as const,
  mfaRequired: false,
}

function fakeApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    login: vi.fn(),
    verifyMfa: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    logoutAll: vi.fn().mockResolvedValue(undefined),
    me: vi.fn().mockRejectedValue(new ApiError({ status: 401, code: 'AUTHENTICATION_REQUIRED' })),
    rotateCsrf: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    ...overrides,
  }
}

function Probe() {
  const { state } = useAuth()
  if (state.status === 'loading') return <p>loading</p>
  if (state.status === 'anonymous') return <p>anonymous</p>
  if (state.status === 'unavailable') return <p>unavailable:{state.error.code}</p>
  return <p>authenticated:{state.user.email}</p>
}

type AuthHandle = ReturnType<typeof useAuth>

const Capture = forwardRef<AuthHandle>((_props, ref) => {
  const auth = useAuth()
  useImperativeHandle(ref, () => auth, [auth])
  return <Probe />
})

describe('<AuthProvider />', () => {
  it('starts loading then becomes anonymous when /me fails', async () => {
    const api = fakeApi()
    render(
      <AuthProvider api={api}>
        <Probe />
      </AuthProvider>,
    )

    expect(screen.getByText('loading')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('anonymous')).toBeInTheDocument())
  })

  it('becomes authenticated when /me succeeds on boot', async () => {
    const api = fakeApi({ me: vi.fn().mockResolvedValue(USER) })
    render(
      <AuthProvider api={api}>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() =>
      expect(screen.getByText(`authenticated:${USER.email}`)).toBeInTheDocument(),
    )
  })

  it('login authenticates directly when no mfa is required', async () => {
    const api = fakeApi({
      me: vi.fn().mockRejectedValue(new ApiError({ status: 401, code: 'AUTHENTICATION_REQUIRED' })),
      login: vi.fn().mockResolvedValue({ kind: 'authenticated', csrfToken: 'tok' }),
    })

    const handle = createRef<AuthHandle>()

    render(
      <AuthProvider api={api}>
        <Capture ref={handle} />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByText('anonymous')).toBeInTheDocument())

    ;(api.me as ReturnType<typeof vi.fn>).mockResolvedValue(USER)

    await act(async () => {
      const result = await handle.current!.login({ email: USER.email, password: 'secret123' })
      expect(result).toEqual({ kind: 'authenticated' })
    })

    await waitFor(() =>
      expect(screen.getByText(`authenticated:${USER.email}`)).toBeInTheDocument(),
    )
  })

  it('login returns the mfa challenge without changing state', async () => {
    const api = fakeApi({
      login: vi.fn().mockResolvedValue({ kind: 'mfa', challengeToken: 'chal-1' }),
    })

    const handle = createRef<AuthHandle>()

    render(
      <AuthProvider api={api}>
        <Capture ref={handle} />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByText('anonymous')).toBeInTheDocument())

    let result: unknown
    await act(async () => {
      result = await handle.current!.login({ email: USER.email, password: 'secret123' })
    })

    expect(result).toEqual({ kind: 'mfa', challengeToken: 'chal-1' })
    expect(screen.getByText('anonymous')).toBeInTheDocument()
  })

  it('verifyMfa authenticates the user', async () => {
    const api = fakeApi({
      verifyMfa: vi.fn().mockResolvedValue({ csrfToken: 'tok' }),
    })

    const handle = createRef<AuthHandle>()

    render(
      <AuthProvider api={api}>
        <Capture ref={handle} />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByText('anonymous')).toBeInTheDocument())

    ;(api.me as ReturnType<typeof vi.fn>).mockResolvedValue(USER)

    await act(async () => {
      await handle.current!.verifyMfa({ challengeToken: 'chal-1', code: '123456' })
    })

    await waitFor(() =>
      expect(screen.getByText(`authenticated:${USER.email}`)).toBeInTheDocument(),
    )
  })

  it('logout clears the session and sets anonymous', async () => {
    const api = fakeApi({ me: vi.fn().mockResolvedValue(USER) })

    const handle = createRef<AuthHandle>()

    render(
      <AuthProvider api={api}>
        <Capture ref={handle} />
      </AuthProvider>,
    )
    await waitFor(() =>
      expect(screen.getByText(`authenticated:${USER.email}`)).toBeInTheDocument(),
    )

    await act(async () => {
      await handle.current!.logout()
    })

    expect(api.logout).toHaveBeenCalled()
    expect(screen.getByText('anonymous')).toBeInTheDocument()
  })

  it('logout ignores a 401 from the api', async () => {
    const api = fakeApi({
      me: vi.fn().mockResolvedValue(USER),
      logout: vi.fn().mockRejectedValue(new ApiError({ status: 401, code: 'AUTHENTICATION_REQUIRED' })),
    })

    const handle = createRef<AuthHandle>()

    render(
      <AuthProvider api={api}>
        <Capture ref={handle} />
      </AuthProvider>,
    )
    await waitFor(() =>
      expect(screen.getByText(`authenticated:${USER.email}`)).toBeInTheDocument(),
    )

    await act(async () => {
      await handle.current!.logout()
    })

    expect(screen.getByText('anonymous')).toBeInTheDocument()
  })

  it('resetPassword clears the session and sets anonymous on success', async () => {
    const api = fakeApi({
      me: vi.fn().mockResolvedValue(USER),
      resetPassword: vi.fn().mockResolvedValue(undefined),
    })

    const handle = createRef<AuthHandle>()

    render(
      <AuthProvider api={api}>
        <Capture ref={handle} />
      </AuthProvider>,
    )
    await waitFor(() =>
      expect(screen.getByText(`authenticated:${USER.email}`)).toBeInTheDocument(),
    )

    await act(async () => {
      await handle.current!.resetPassword({ token: 'A'.repeat(43), newPassword: 'abcdefghijkl' })
    })

    expect(api.resetPassword).toHaveBeenCalledWith({ token: 'A'.repeat(43), newPassword: 'abcdefghijkl' })
    expect(screen.getByText('anonymous')).toBeInTheDocument()
  })

  it('logout/logoutAll rethrow a non-401 error and keep the session authenticated', async () => {
    const down = new ApiError({ status: 503, code: 'AUTH_SERVICE_UNAVAILABLE' })
    const api = fakeApi({
      me: vi.fn().mockResolvedValue(USER),
      logout: vi.fn().mockRejectedValue(down),
      logoutAll: vi.fn().mockRejectedValue(down),
    })
    const handle = createRef<AuthHandle>()
    render(
      <AuthProvider api={api}>
        <Capture ref={handle} />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByText(`authenticated:${USER.email}`)).toBeInTheDocument())

    await expect(act(() => handle.current!.logout())).rejects.toThrow()
    await expect(act(() => handle.current!.logoutAll())).rejects.toThrow()
    expect(screen.getByText(`authenticated:${USER.email}`)).toBeInTheDocument()
  })

  it('becomes unavailable on a non-401 /me error, and login throws without authenticating', async () => {
    const down = new ApiError({ status: 0, code: 'NETWORK' })
    const api = fakeApi({
      me: vi.fn().mockRejectedValue(down),
      login: vi.fn().mockResolvedValue({ kind: 'authenticated', csrfToken: 'tok' }),
    })
    const handle = createRef<AuthHandle>()
    render(
      <AuthProvider api={api}>
        <Capture ref={handle} />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByText('unavailable:NETWORK')).toBeInTheDocument())

    await expect(
      act(() => handle.current!.login({ email: USER.email, password: 'secret123' })),
    ).rejects.toThrow()
    expect(screen.queryByText(`authenticated:${USER.email}`)).not.toBeInTheDocument()
  })
})

describe('AuthProvider http publication', () => {
  function HttpProbe() {
    const http = useHttp()
    return <span>{typeof http.put}</span>
  }

  it('publishes the app-wide http client to the tree below it', async () => {
    const client = { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() } as unknown as HttpClient

    render(
      <AuthProvider api={fakeApi()} http={client}>
        <HttpProbe />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByText('function')).toBeInTheDocument())
  })

  it('renders children without a client when none is available, so useHttp still fails loudly', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() =>
      render(
        <AuthProvider api={fakeApi()}>
          <HttpProbe />
        </AuthProvider>,
      ),
    ).toThrow(/HttpProvider/)

    consoleError.mockRestore()
  })
})
