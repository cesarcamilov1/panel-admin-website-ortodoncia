import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/problem'
import { createFakeAuthApi, renderAuthenticated } from '../../../test/auth'
import { AccountPage } from './AccountPage'

const USER = {
  id: 'id-1',
  email: 'mariana@clinica.mx',
  firstName: 'Mariana',
  lastName: 'Cázares',
  role: 'OWNER_DENTIST' as const,
  mfaRequired: true,
}

function renderAccount(api = createFakeAuthApi({ me: vi.fn().mockResolvedValue(USER) })) {
  return renderAuthenticated(
    <Routes>
      <Route path="/cuenta" element={<AccountPage />} />
      <Route path="/login" element={<p>login page</p>} />
    </Routes>,
    { route: '/cuenta', api },
  )
}

describe('<AccountPage />', () => {
  it('shows the read-only profile fields for the authenticated user', async () => {
    renderAccount()
    expect(await screen.findByDisplayValue('Mariana')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Cázares')).toBeInTheDocument()
    expect(screen.getByDisplayValue('mariana@clinica.mx')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Odontólogo titular')).toBeInTheDocument()
  })

  it('shows the mfa status from the current user', async () => {
    renderAccount()
    expect(await screen.findByText('Segundo factor activo')).toBeInTheDocument()
  })

  it('shows mfa not required when the user does not need it', async () => {
    renderAccount(
      createFakeAuthApi({ me: vi.fn().mockResolvedValue({ ...USER, mfaRequired: false }) }),
    )
    expect(await screen.findByText('Segundo factor no requerido')).toBeInTheDocument()
  })

  it('requests a password reset email on "Cambiar contraseña"', async () => {
    const api = createFakeAuthApi({ me: vi.fn().mockResolvedValue(USER) })
    const user = userEvent.setup()
    renderAccount(api)

    await user.click(await screen.findByRole('button', { name: 'Cambiar contraseña' }))

    expect(api.forgotPassword).toHaveBeenCalledWith(USER.email)
    expect(
      await screen.findByText(`Te enviamos un enlace a ${USER.email} para cambiar tu contraseña.`),
    ).toBeInTheDocument()
  })

  it('shows an error alert when the password reset request fails', async () => {
    const api = createFakeAuthApi({
      me: vi.fn().mockResolvedValue(USER),
      forgotPassword: vi
        .fn()
        .mockRejectedValue(new ApiError({ status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 30 })),
    })
    const user = userEvent.setup()
    renderAccount(api)

    const button = await screen.findByRole('button', { name: 'Cambiar contraseña' })
    await user.click(button)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Demasiados intentos. Espera 30 segundos e inténtalo de nuevo.',
    )
    expect(button).toBeEnabled()
  })

  it('logs out of all devices and navigates to /login', async () => {
    const api = createFakeAuthApi({ me: vi.fn().mockResolvedValue(USER) })
    const user = userEvent.setup()
    renderAccount(api)

    await user.click(
      await screen.findByRole('button', { name: 'Cerrar sesión en todos los equipos' }),
    )

    expect(api.logoutAll).toHaveBeenCalled()
    await waitFor(() => expect(screen.getByText('login page')).toBeInTheDocument())
  })

  it('shows an alert and stays authenticated when logoutAll fails', async () => {
    const api = createFakeAuthApi({
      me: vi.fn().mockResolvedValue(USER),
      logoutAll: vi.fn().mockRejectedValue(new ApiError({ status: 503, code: 'AUTH_SERVICE_UNAVAILABLE' })),
    })
    const user = userEvent.setup()
    renderAccount(api)

    await user.click(
      await screen.findByRole('button', { name: 'Cerrar sesión en todos los equipos' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El servicio no está disponible por ahora. Inténtalo más tarde.',
    )
    expect(screen.queryByText('login page')).not.toBeInTheDocument()
  })
})
