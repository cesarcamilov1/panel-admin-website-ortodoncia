import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../../shared/api/problem'
import type { PracticeLocation } from '../../../locations/domain/location'
import type { ScheduleBlockDraft } from '../../domain/scheduleBlock'
import { ScheduleBlockModal } from './ScheduleBlockModal'

function location(overrides: Partial<PracticeLocation> = {}): PracticeLocation {
  return {
    id: 'loc-1',
    providerUserId: 'prov-1',
    name: 'Sede Polanco',
    address: 'Av. Masaryk 111',
    isActive: true,
    isDefault: true,
    allServices: true,
    travelBufferMinutes: 30,
    ...overrides,
  }
}

function setup(props: Partial<Parameters<typeof ScheduleBlockModal>[0]> = {}) {
  const onClose = vi.fn()
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  render(<ScheduleBlockModal locations={[]} onClose={onClose} onSubmit={onSubmit} {...props} />)
  return { onClose, onSubmit, user: userEvent.setup() }
}

describe('ScheduleBlockModal validation', () => {
  it('blocks an end that is not after the start and does not submit', async () => {
    const { onSubmit, user } = setup()

    await user.type(screen.getByLabelText('Inicio'), '2026-09-20T14:00')
    await user.type(screen.getByLabelText('Fin'), '2026-09-20T13:00')
    await user.click(screen.getByRole('button', { name: 'Crear bloqueo' }))

    expect(await screen.findByText(/el fin debe ser posterior al inicio/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('ScheduleBlockModal submission', () => {
  it('submits the expected draft for a valid block', async () => {
    const { onSubmit, user } = setup()

    await user.selectOptions(screen.getByLabelText('Tipo de bloqueo'), 'Comida')
    await user.type(screen.getByLabelText('Inicio'), '2026-09-20T14:00')
    await user.type(screen.getByLabelText('Fin'), '2026-09-20T15:00')
    await user.type(screen.getByLabelText('Motivo'), 'Comida del equipo')
    await user.click(screen.getByRole('button', { name: 'Crear bloqueo' }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining<Partial<ScheduleBlockDraft>>({
          blockType: 'MEAL',
          startsAt: '2026-09-20T14:00',
          endsAt: '2026-09-20T15:00',
          reason: 'Comida del equipo',
          locationId: '',
        }),
      ),
    )
  })

  it('lets the location field choose a real sede id', async () => {
    const { onSubmit, user } = setup({ locations: [location(), location({ id: 'loc-2', name: 'Sede Roma' })] })

    await user.type(screen.getByLabelText('Inicio'), '2026-09-20T14:00')
    await user.type(screen.getByLabelText('Fin'), '2026-09-20T15:00')
    await user.selectOptions(screen.getByLabelText('Sede'), 'Sede Roma')
    await user.click(screen.getByRole('button', { name: 'Crear bloqueo' }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ locationId: 'loc-2' })),
    )
  })
})

describe('ScheduleBlockModal failures', () => {
  it('shows the mapped server error and keeps the dialog open', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError({ status: 409, code: 'CONFLICT' }))
    const { user } = setup({ onSubmit })

    await user.type(screen.getByLabelText('Inicio'), '2026-09-20T14:00')
    await user.type(screen.getByLabelText('Fin'), '2026-09-20T15:00')
    await user.click(screen.getByRole('button', { name: 'Crear bloqueo' }))

    expect(await screen.findByText(/choca con una cita/i)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('closes on the close button and on Escape', async () => {
    const { onClose, user } = setup()

    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
