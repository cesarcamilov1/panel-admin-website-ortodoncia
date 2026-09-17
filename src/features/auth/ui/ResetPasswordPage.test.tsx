import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/problem'
import type { AuthApi } from '../application/authApi'
import { AuthProvider } from '../application/AuthProvider'
import { ResetPasswordPage } from './ResetPasswordPage'

const TOKEN = 'A'.repeat(43)

function fakeApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    login: vi.fn(),
    verifyMfa: vi.fn(),
    logout: vi.fn(),
    logoutAll: vi.fn(),
    me: vi.fn().mockRejectedValue(new ApiError({ status: 401, code: 'AUTHENTICATION_REQUIRED' })),
    rotateCsrf: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

const USER = {
  id: 'id-1',
  email: 'mariana@clinica.mx',
  firstName: 'Mariana',
  lastName: 'Cázares',
  role: 'OWNER_DENTIST' as const,
  mfaRequired: false,
}

function renderPage(api: AuthApi, hash: string) {
  window.history.pushState(null, '', `/reset-password${hash}`)
  return render(
    <AuthProvider api={api}>
      <MemoryRouter initialEntries={[`/reset-password${hash}`]}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/login" element={<p>login page</p>} />
          <Route path="/recuperar" element={<p>recuperar page</p>} />
          <Route path="/" element={<p>dashboard</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('<ResetPasswordPage />', () => {
  beforeEach(() => {
    window.history.pushState(null, '', '/')
  })

  it('reads the token from the hash and scrubs it from the url', async () => {
    const api = fakeApi()
    renderPage(api, `#token=${TOKEN}`)

    expect(await screen.findByLabelText('Nueva contraseña')).toBeInTheDocument()
    expect(window.location.hash).toBe('')
  })

  it('shows an error state when the hash has no valid token', async () => {
    const api = fakeApi()
    renderPage(api, '#token=too-short')

    expect(await screen.findByText('El enlace no es válido o está incompleto.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /recuperación/i })).toBeInTheDocument()
  })

  it('validates the password confirmation before submitting', async () => {
    const api = fakeApi()
    const user = userEvent.setup()
    renderPage(api, `#token=${TOKEN}`)

    await user.type(await screen.findByLabelText('Nueva contraseña'), 'abcdefghijkl')
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'different-one')
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(await screen.findByText('Las contraseñas no coinciden.')).toBeInTheDocument()
    expect(api.resetPassword).not.toHaveBeenCalled()
  })

  it('submits the token and new password on success', async () => {
    const api = fakeApi()
    const user = userEvent.setup()
    renderPage(api, `#token=${TOKEN}`)

    await user.type(await screen.findByLabelText('Nueva contraseña'), 'abcdefghijkl')
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'abcdefghijkl')
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(api.resetPassword).toHaveBeenCalledWith({ token: TOKEN, newPassword: 'abcdefghijkl' })
    expect(await screen.findByText('Tu contraseña se actualizó. Inicia sesión con la nueva contraseña.')).toBeInTheDocument()
  })

  it('renders the form for an authenticated user when the token is valid', async () => {
    const api = fakeApi({ me: vi.fn().mockResolvedValue(USER) })
    renderPage(api, `#token=${TOKEN}`)

    expect(await screen.findByLabelText('Nueva contraseña')).toBeInTheDocument()
  })

  it('redirects an authenticated user to / when there is no valid token', async () => {
    const api = fakeApi({ me: vi.fn().mockResolvedValue(USER) })
    renderPage(api, '#token=too-short')

    expect(await screen.findByText('dashboard')).toBeInTheDocument()
  })

  it('maps an invalid/expired token error on submit', async () => {
    const api = fakeApi({
      resetPassword: vi.fn().mockRejectedValue(new ApiError({ status: 401, code: 'INVALID_CREDENTIALS' })),
    })
    const user = userEvent.setup()
    renderPage(api, `#token=${TOKEN}`)

    await user.type(await screen.findByLabelText('Nueva contraseña'), 'abcdefghijkl')
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'abcdefghijkl')
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(await screen.findByText('El enlace ya no es válido. Solicita uno nuevo.')).toBeInTheDocument()
  })
})
