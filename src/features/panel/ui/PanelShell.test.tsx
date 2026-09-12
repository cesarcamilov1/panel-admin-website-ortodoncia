import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PanelShell } from './PanelShell'

function renderPanel(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<PanelShell />}>
          <Route index element={<p>Inicio</p>} />
          <Route path="pacientes" element={<p>Listado de pacientes</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('<PanelShell />', () => {
  it('titles the current section', () => {
    renderPanel()
    expect(screen.getByRole('heading', { name: 'Hoy en la clínica' })).toBeInTheDocument()
  })

  it('navigates from the sidebar', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('link', { name: /Pacientes/ }))

    expect(screen.getByText('Listado de pacientes')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pacientes' })).toBeInTheDocument()
  })

  it('opens the new appointment modal from the topbar', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: /Nueva cita/ }))

    expect(screen.getByRole('dialog', { name: 'Nueva cita' })).toBeInTheDocument()
  })

  it('announces the appointment once it is booked', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: /Nueva cita/ }))
    await user.click(screen.getByRole('button', { name: 'Agendar cita' }))

    expect(screen.getByRole('status')).toHaveTextContent('Cita agendada para el jue 18 a las 10:30.')
  })
})
