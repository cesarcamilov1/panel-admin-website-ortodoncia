import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../../shared/api/problem'
import { DEFAULT_FAKE_USER, createFakeAuthApi, renderAuthenticated } from '../../../../test/auth'
import { PanelActionsContext } from '../../application/panelContext'
import { UserMenu } from './UserMenu'

function renderMenu(api = createFakeAuthApi({ me: vi.fn().mockResolvedValue(DEFAULT_FAKE_USER) }), notify = vi.fn()) {
  return renderAuthenticated(
    <PanelActionsContext value={{ openNewAppointment: vi.fn(), notify }}>
    <Routes>
      <Route path="/" element={<UserMenu />} />
      <Route path="/login" element={<p>login page</p>} />
      <Route path="/cuenta" element={<p>cuenta page</p>} />
    </Routes>
    </PanelActionsContext>,
    { api },
  )
}

describe('<UserMenu />', () => {
  it('opens and closes the menu', async () => {
    const user = userEvent.setup()
    renderMenu()
    await waitFor(() => screen.getByRole('button', { name: 'Opciones de la cuenta' }))

    const toggle = screen.getByRole('button', { name: 'Opciones de la cuenta' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('navigates to account on "Mi cuenta"', async () => {
    const user = userEvent.setup()
    renderMenu()
    await user.click(await screen.findByRole('button', { name: 'Opciones de la cuenta' }))
    await user.click(screen.getByRole('menuitem', { name: 'Mi cuenta' }))
    expect(await screen.findByText('cuenta page')).toBeInTheDocument()
  })

  it('logs out and navigates to /login', async () => {
    const api = createFakeAuthApi()
    const user = userEvent.setup()
    renderMenu(api)
    await user.click(await screen.findByRole('button', { name: 'Opciones de la cuenta' }))
    await user.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }))

    expect(api.logout).toHaveBeenCalled()
    expect(await screen.findByText('login page')).toBeInTheDocument()
  })

  it('shows an error and stays on the panel when logout fails', async () => {
    const api = createFakeAuthApi({
      logout: vi.fn().mockRejectedValue(new ApiError({ status: 503, code: 'AUTH_SERVICE_UNAVAILABLE' })),
    })
    const notify = vi.fn()
    const user = userEvent.setup()
    renderMenu(api, notify)
    await user.click(await screen.findByRole('button', { name: 'Opciones de la cuenta' }))
    await user.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }))

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith('El servicio no está disponible por ahora. Inténtalo más tarde.'),
    )
    expect(screen.queryByText('login page')).not.toBeInTheDocument()
  })
})
