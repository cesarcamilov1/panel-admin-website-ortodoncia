import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../../shared/api/problem'
import type { PracticeLocation } from '../../../locations/domain/location'
import type { WorkScheduleDraft } from '../../domain/workSchedule'
import { WorkScheduleModal } from './WorkScheduleModal'

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

function setup(props: Partial<Parameters<typeof WorkScheduleModal>[0]> = {}) {
  const onClose = vi.fn()
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  render(<WorkScheduleModal locations={[]} onClose={onClose} onSubmit={onSubmit} {...props} />)
  return { onClose, onSubmit, user: userEvent.setup() }
}

describe('WorkScheduleModal validation', () => {
  it('blocks a range where the end is not after the start and does not submit', async () => {
    const { onSubmit, user } = setup()

    await user.type(screen.getByLabelText('Hora de inicio'), '09:00')
    await user.type(screen.getByLabelText('Hora de fin'), '08:00')
    await user.click(screen.getByRole('button', { name: 'Crear franja' }))

    expect(await screen.findByText(/la hora de fin debe ser posterior/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('WorkScheduleModal submission', () => {
  it('submits the expected draft for a valid range', async () => {
    const { onSubmit, user } = setup({ weekday: 2 })

    await user.type(screen.getByLabelText('Hora de inicio'), '09:00')
    await user.type(screen.getByLabelText('Hora de fin'), '14:00')
    await user.click(screen.getByRole('button', { name: 'Crear franja' }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining<Partial<WorkScheduleDraft>>({
          weekday: 2,
          startLocalTime: '09:00',
          endLocalTime: '14:00',
          intervalWeeks: 1,
          locationId: '',
          isActive: true,
        }),
      ),
    )
  })

  it('lets the location field choose a real sede id', async () => {
    const { onSubmit, user } = setup({ locations: [location(), location({ id: 'loc-2', name: 'Sede Roma' })] })

    await user.type(screen.getByLabelText('Hora de inicio'), '09:00')
    await user.type(screen.getByLabelText('Hora de fin'), '14:00')
    await user.selectOptions(screen.getByLabelText('Sede'), 'Sede Roma')
    await user.click(screen.getByRole('button', { name: 'Crear franja' }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ locationId: 'loc-2' })),
    )
  })

  it('tells two locations with the same name apart', async () => {
    // `practice_locations` has no unique index on `name`, so the option value must be the
    // id: picking the second Sede Roma has to send the second id, not the first.
    const { onSubmit, user } = setup({
      locations: [
        location({ id: 'loc-1', name: 'Sede Roma' }),
        location({ id: 'loc-2', name: 'Sede Roma' }),
      ],
    })

    await user.type(screen.getByLabelText('Hora de inicio'), '09:00')
    await user.type(screen.getByLabelText('Hora de fin'), '14:00')
    const [, second] = screen.getAllByRole('option', { name: 'Sede Roma' })
    await user.selectOptions(screen.getByLabelText('Sede'), second)
    await user.click(screen.getByRole('button', { name: 'Crear franja' }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ locationId: 'loc-2' })),
    )
  })
})

describe('WorkScheduleModal failures', () => {
  it('shows the mapped server error and keeps the dialog open', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError({ status: 409, code: 'CONFLICT' }))
    const { user } = setup({ onSubmit })

    await user.type(screen.getByLabelText('Hora de inicio'), '09:00')
    await user.type(screen.getByLabelText('Hora de fin'), '14:00')
    await user.click(screen.getByRole('button', { name: 'Crear franja' }))

    expect(await screen.findByText(/se encima/i)).toBeInTheDocument()
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
