import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/problem'
import type { AuthApi } from '../application/authApi'
import { AuthProvider } from '../application/AuthProvider'
import { forgetDevice, rememberDevice } from '../application/sessionPreference'
import { LoginPage } from './LoginPage'

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

function renderLogin(api: AuthApi, initialEntry: { pathname: string; state?: unknown } = { pathname: '/login' }) {
  return render(
    <AuthProvider api={api}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>dashboard</p>} />
          <Route path="/pacientes" element={<p>pacientes</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('<LoginPage />', () => {
  beforeEach(() => {
    forgetDevice()
  })

  it('shows client validation errors before calling the api', async () => {
    const api = fakeApi()
    const user = userEvent.setup()
    renderLogin(api)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled())

    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('El correo es obligatorio.')).toBeInTheDocument()
    expect(api.login).not.toHaveBeenCalled()
  })

  it('shows a generic message for invalid credentials', async () => {
    const api = fakeApi({
      login: vi.fn().mockRejectedValue(new ApiError({ status: 401, code: 'INVALID_CREDENTIALS' })),
    })
    const user = userEvent.setup()
    renderLogin(api)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled())

    await user.type(screen.getByLabelText('Correo'), 'mariana@clinica.mx')
    await user.type(screen.getByLabelText('Contraseña'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.')
  })

  it('navigates to / on successful login', async () => {
    const api = fakeApi({
      login: vi.fn().mockResolvedValue({ kind: 'authenticated', csrfToken: 'tok' }),
    })
    ;(api.me as ReturnType<typeof vi.fn>).mockResolvedValue(USER)
    const user = userEvent.setup()
    renderLogin(api)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled())

    await user.type(screen.getByLabelText('Correo'), 'mariana@clinica.mx')
    await user.type(screen.getByLabelText('Contraseña'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('dashboard')).toBeInTheDocument()
  })

  it('navigates to the sanitized from path after login', async () => {
    const api = fakeApi({
      login: vi.fn().mockResolvedValue({ kind: 'authenticated', csrfToken: 'tok' }),
    })
    ;(api.me as ReturnType<typeof vi.fn>).mockResolvedValue(USER)
    const user = userEvent.setup()
    renderLogin(api, { pathname: '/login', state: { from: '/pacientes' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled())

    await user.type(screen.getByLabelText('Correo'), 'mariana@clinica.mx')
    await user.type(screen.getByLabelText('Contraseña'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('pacientes')).toBeInTheDocument()
  })

  it('walks through the mfa step', async () => {
    const api = fakeApi({
      login: vi.fn().mockResolvedValue({ kind: 'mfa', challengeToken: 'chal-1' }),
      verifyMfa: vi.fn().mockResolvedValue({ csrfToken: 'tok' }),
    })
    ;(api.me as ReturnType<typeof vi.fn>).mockResolvedValue(USER)
    const user = userEvent.setup()
    renderLogin(api)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled())

    await user.type(screen.getByLabelText('Correo'), 'mariana@clinica.mx')
    await user.type(screen.getByLabelText('Contraseña'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('heading', { name: 'Código de verificación' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Código'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))

    expect(api.verifyMfa).toHaveBeenCalledWith({ challengeToken: 'chal-1', code: '123456' })
    expect(await screen.findByText('dashboard')).toBeInTheDocument()
  })

  it('remembers the device email on success when the checkbox is checked', async () => {
    const api = fakeApi({
      login: vi.fn().mockResolvedValue({ kind: 'authenticated', csrfToken: 'tok' }),
    })
    ;(api.me as ReturnType<typeof vi.fn>).mockResolvedValue(USER)
    const user = userEvent.setup()
    renderLogin(api)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled())

    await user.type(screen.getByLabelText('Correo'), 'mariana@clinica.mx')
    await user.type(screen.getByLabelText('Contraseña'), 'secret123')
    await user.click(screen.getByLabelText('Mantener la sesión en este equipo'))
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await screen.findByText('dashboard')
    expect(localStorage.getItem('citas-menu.auth.remember')).toContain('mariana@clinica.mx')
  })

  it('prefills the email from a remembered device', async () => {
    rememberDevice('remembered@clinica.mx')
    const api = fakeApi()
    renderLogin(api)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled())
    expect(screen.getByLabelText('Correo')).toHaveValue('remembered@clinica.mx')
    expect(screen.getByLabelText('Mantener la sesión en este equipo')).toBeChecked()
  })

  it('disables the submit button while a rate limit countdown is active', async () => {
    const api = fakeApi({
      login: vi.fn().mockRejectedValue(new ApiError({ status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 5 })),
    })
    const user = userEvent.setup()
    renderLogin(api)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled())

    await user.type(screen.getByLabelText('Correo'), 'mariana@clinica.mx')
    await user.type(screen.getByLabelText('Contraseña'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(screen.getByRole('button', { name: /Espera/ })).toBeDisabled())
  })
})
