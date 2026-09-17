import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/problem'
import type { AuthApi } from '../application/authApi'
import { AuthProvider } from '../application/AuthProvider'
import { PublicOnly } from './PublicOnly'
import { RequireAuth } from './RequireAuth'

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
    logout: vi.fn(),
    logoutAll: vi.fn(),
    me: vi.fn().mockRejectedValue(new ApiError({ status: 401, code: 'AUTHENTICATION_REQUIRED' })),
    rotateCsrf: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    ...overrides,
  }
}

function renderApp(api: AuthApi, initialPath = '/') {
  return render(
    <AuthProvider api={api}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<PublicOnly />}>
            <Route path="/login" element={<p>login page</p>} />
          </Route>
          <Route element={<RequireAuth />}>
            <Route path="/" element={<p>dashboard</p>} />
            <Route path="/pacientes" element={<p>pacientes</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('RequireAuth', () => {
  it('shows a loading state before resolving', () => {
    const api = fakeApi({ me: vi.fn().mockReturnValue(new Promise(() => {})) })
    renderApp(api, '/')
    expect(screen.getByRole('status')).toHaveTextContent('Cargando tu sesión…')
  })

  it('redirects an anonymous user to /login', async () => {
    const api = fakeApi()
    renderApp(api, '/pacientes')
    expect(await screen.findByText('login page')).toBeInTheDocument()
  })

  it('renders the protected route for an authenticated user', async () => {
    const api = fakeApi({ me: vi.fn().mockResolvedValue(USER) })
    renderApp(api, '/pacientes')
    expect(await screen.findByText('pacientes')).toBeInTheDocument()
  })

  it('shows a retry screen instead of redirecting when the session is unavailable', async () => {
    const me = vi.fn().mockRejectedValueOnce(new ApiError({ status: 0, code: 'NETWORK' }))
    const api = fakeApi({ me })
    const user = userEvent.setup()
    renderApp(api, '/pacientes')

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos comprobar tu sesión.')
    expect(screen.queryByText('login page')).not.toBeInTheDocument()

    me.mockResolvedValueOnce(USER)
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    await waitFor(() => expect(screen.getByText('pacientes')).toBeInTheDocument())
  })
})

describe('PublicOnly', () => {
  it('redirects an authenticated user away from /login', async () => {
    const api = fakeApi({ me: vi.fn().mockResolvedValue(USER) })
    renderApp(api, '/login')
    expect(await screen.findByText('dashboard')).toBeInTheDocument()
  })

  it('renders /login for an anonymous user', async () => {
    const api = fakeApi()
    renderApp(api, '/login')
    expect(await screen.findByText('login page')).toBeInTheDocument()
  })
})
