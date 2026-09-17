import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/problem'
import type { AuthApi } from '../application/authApi'
import { AuthProvider } from '../application/AuthProvider'
import { ForgotPasswordPage } from './ForgotPasswordPage'

function fakeApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    login: vi.fn(),
    verifyMfa: vi.fn(),
    logout: vi.fn(),
    logoutAll: vi.fn(),
    me: vi.fn().mockRejectedValue(new ApiError({ status: 401, code: 'AUTHENTICATION_REQUIRED' })),
    rotateCsrf: vi.fn(),
    forgotPassword: vi.fn().mockResolvedValue(undefined),
    resetPassword: vi.fn(),
    ...overrides,
  }
}

function renderPage(api: AuthApi) {
  return render(
    <AuthProvider api={api}>
      <MemoryRouter initialEntries={['/recuperar']}>
        <Routes>
          <Route path="/recuperar" element={<ForgotPasswordPage />} />
          <Route path="/login" element={<p>login page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('<ForgotPasswordPage />', () => {
  it('validates the email before submitting', async () => {
    const api = fakeApi()
    const user = userEvent.setup()
    renderPage(api)

    await user.click(screen.getByRole('button', { name: 'Enviar instrucciones' }))

    expect(await screen.findByText('El correo es obligatorio.')).toBeInTheDocument()
    expect(api.forgotPassword).not.toHaveBeenCalled()
  })

  it('shows the same neutral success message regardless of account existence', async () => {
    const api = fakeApi()
    const user = userEvent.setup()
    renderPage(api)

    await user.type(screen.getByLabelText('Correo'), 'mariana@clinica.mx')
    await user.click(screen.getByRole('button', { name: 'Enviar instrucciones' }))

    expect(
      await screen.findByText(
        'Si el correo está registrado, recibirás las instrucciones en unos minutos. Revisa también tu carpeta de spam.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Correo')).not.toBeInTheDocument()
  })

  it('disables the submit button during a rate limit countdown', async () => {
    const api = fakeApi({
      forgotPassword: vi
        .fn()
        .mockRejectedValue(new ApiError({ status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 8 })),
    })
    const user = userEvent.setup()
    renderPage(api)

    await user.type(screen.getByLabelText('Correo'), 'mariana@clinica.mx')
    await user.click(screen.getByRole('button', { name: 'Enviar instrucciones' }))

    await waitFor(() => expect(screen.getByRole('button', { name: /Espera/ })).toBeDisabled())
  })

  it('links back to the login page', async () => {
    const api = fakeApi()
    renderPage(api)
    expect(screen.getByRole('link', { name: 'Volver al inicio de sesión' })).toHaveAttribute(
      'href',
      '/login',
    )
  })
})
