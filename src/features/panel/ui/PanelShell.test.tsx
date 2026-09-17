import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFakeAuthApi, renderAuthenticated } from '../../../test/auth'
import { PanelShell } from './PanelShell'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function renderPanel(initialPath = '/') {
  const api = createFakeAuthApi({
    me: vi.fn().mockResolvedValue({
      id: 'id-1',
      email: 'mariana@clinica.mx',
      firstName: 'Mariana',
      lastName: 'Cázares',
      role: 'OWNER_DENTIST',
      mfaRequired: true,
    }),
  })

  return renderAuthenticated(
    <Routes>
      <Route element={<PanelShell />}>
        <Route index element={<p>Inicio</p>} />
        <Route path="pacientes" element={<p>Listado de pacientes</p>} />
      </Route>
    </Routes>,
    { route: initialPath, api },
  )
}

describe('<PanelShell />', () => {
  it('titles the current section', async () => {
    renderPanel()
    expect(await screen.findByRole('heading', { name: 'Hoy en la clínica' })).toBeInTheDocument()
  })

  it('renders the authenticated user in the sidebar', async () => {
    renderPanel()
    await waitFor(() => expect(screen.getByText('Mariana Cázares')).toBeInTheDocument())
    expect(screen.getByText('Odontólogo titular')).toBeInTheDocument()
  })

  it('navigates from the sidebar', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(await screen.findByRole('link', { name: /Pacientes/ }))

    expect(screen.getByText('Listado de pacientes')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pacientes' })).toBeInTheDocument()
  })

  it('opens the new appointment modal from the topbar', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(await screen.findByRole('button', { name: /Nueva cita/ }))

    expect(screen.getByRole('dialog', { name: 'Nueva cita' })).toBeInTheDocument()
  })

  it('announces the appointment once it is booked', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(await screen.findByRole('button', { name: /Nueva cita/ }))
    await user.click(screen.getByRole('button', { name: 'Agendar cita' }))

    expect(screen.getByRole('status')).toHaveTextContent('Cita agendada para el jue 18 a las 10:30.')
  })

  it('logs out and lands on /login', async () => {
    const api = createFakeAuthApi({
      me: vi.fn().mockResolvedValue({
        id: 'id-1',
        email: 'mariana@clinica.mx',
        firstName: 'Mariana',
        lastName: 'Cázares',
        role: 'OWNER_DENTIST',
        mfaRequired: true,
      }),
    })
    const user = userEvent.setup()

    renderAuthenticated(
      <Routes>
        <Route element={<PanelShell />}>
          <Route index element={<p>Inicio</p>} />
        </Route>
        <Route path="/login" element={<p>login page</p>} />
      </Routes>,
      { route: '/', api },
    )

    await user.click(await screen.findByRole('button', { name: 'Opciones de la cuenta' }))
    await user.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }))

    expect(api.logout).toHaveBeenCalled()
    expect(await screen.findByText('login page')).toBeInTheDocument()
  })
})

describe('mobile navigation', () => {
  function mobileViewport() {
    const media = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('matchMedia', vi.fn(() => media))
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
    return media
  }

  it('keeps closed navigation out of the document and closes after navigating', async () => {
    mobileViewport()
    const user = userEvent.setup()
    renderPanel()
    const toggle = await screen.findByRole('button', { name: 'Abrir menú' })
    expect(screen.queryByRole('link', { name: /Pacientes/ })).not.toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(screen.getByRole('dialog', { name: 'Menú del panel' })).toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await user.click(screen.getByRole('link', { name: /Pacientes/ }))
    expect(screen.getByText('Listado de pacientes')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(toggle).toHaveFocus()
  })

  it('dismisses from the close button and native Escape cancellation', async () => {
    mobileViewport()
    const user = userEvent.setup()
    renderPanel()
    const toggle = await screen.findByRole('button', { name: 'Abrir menú' })
    await user.click(toggle)
    await user.click(screen.getByRole('button', { name: 'Cerrar menú' }))
    expect(toggle).toHaveFocus()
    await user.click(toggle)
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(toggle).toHaveFocus()
  })

  it('closes and restores desktop navigation when the viewport grows', async () => {
    const media = mobileViewport()
    const user = userEvent.setup()
    renderPanel()
    await user.click(await screen.findByRole('button', { name: 'Abrir menú' }))
    act(() => media.addEventListener.mock.calls[0][1]({ matches: false }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Abrir menú' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Pacientes/ })).toBeInTheDocument()
  })
})
