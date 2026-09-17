import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../../shared/api/problem'
import type { PracticeLocation } from '../../domain/location'
import { LocationFormModal } from './LocationFormModal'

const existing: PracticeLocation = {
  id: 'loc-1',
  providerUserId: 'prov-1',
  name: 'Sede Polanco',
  address: 'Av. Masaryk 111',
  isActive: true,
  isDefault: true,
  allServices: true,
  travelBufferMinutes: 30,
}

function setup(props: Partial<Parameters<typeof LocationFormModal>[0]> = {}) {
  const onClose = vi.fn()
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  render(<LocationFormModal onClose={onClose} onSubmit={onSubmit} {...props} />)
  return { onClose, onSubmit, user: userEvent.setup() }
}

describe('LocationFormModal in create mode', () => {
  it('opens as a labelled dialog with an empty form', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Nueva sede' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre de la sede')).toHaveValue('')
    expect(screen.getByLabelText('Margen de traslado (minutos)')).toHaveValue(0)
  })

  it('warns that a new sede starts with no services enabled', () => {
    setup()
    expect(screen.getByText(/sin servicios/i)).toBeInTheDocument()
  })

  it('submits the trimmed draft', async () => {
    const { onSubmit, user } = setup()

    await user.type(screen.getByLabelText('Nombre de la sede'), '  Sede Roma  ')
    await user.type(screen.getByLabelText('Dirección'), 'Orizaba 20')
    await user.clear(screen.getByLabelText('Margen de traslado (minutos)'))
    await user.type(screen.getByLabelText('Margen de traslado (minutos)'), '15')
    await user.click(screen.getByRole('button', { name: 'Crear sede' }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Sede Roma',
        address: 'Orizaba 20',
        travelBufferMinutes: 15,
      }),
    )
  })

  it('blocks an empty name', async () => {
    const { onSubmit, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Crear sede' }))

    expect(await screen.findByText(/nombre de la sede es obligatorio/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects a travel buffer beyond the server ceiling', async () => {
    const { onSubmit, user } = setup()

    await user.type(screen.getByLabelText('Nombre de la sede'), 'Sede Roma')
    await user.clear(screen.getByLabelText('Margen de traslado (minutos)'))
    await user.type(screen.getByLabelText('Margen de traslado (minutos)'), '1441')
    await user.click(screen.getByRole('button', { name: 'Crear sede' }))

    expect(await screen.findByText(/0 a 1440/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('LocationFormModal in edit mode', () => {
  it('prefills the fields and renames the action', () => {
    setup({ location: existing })

    expect(screen.getByRole('dialog', { name: 'Editar sede' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre de la sede')).toHaveValue('Sede Polanco')
    expect(screen.getByLabelText('Dirección')).toHaveValue('Av. Masaryk 111')
    expect(screen.getByLabelText('Margen de traslado (minutos)')).toHaveValue(30)
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument()
  })

  it('does not repeat the new-sede services warning when editing', () => {
    setup({ location: existing })
    expect(screen.queryByText(/nace sin servicios/i)).not.toBeInTheDocument()
  })

  it('marks the default sede so it is not confused with the others', () => {
    setup({ location: existing })
    expect(screen.getByText(/principal/i)).toBeInTheDocument()
  })
})

describe('LocationFormModal failures', () => {
  it('shows the server message and stays open', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError({ status: 403, code: 'FORBIDDEN' }))
    const { user } = setup({ location: existing, onSubmit })

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText(/titular/i)).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Editar sede' })).toBeInTheDocument()
  })

  it('maps a server field error onto the offending input', async () => {
    const onSubmit = vi.fn().mockRejectedValue(
      new ApiError({
        status: 400,
        code: 'VALIDATION_ERROR',
        fields: [{ field: 'name', code: 'duplicate', message: 'Ya existe una sede con ese nombre.' }],
      }),
    )
    const { user } = setup({ location: existing, onSubmit })

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Ya existe una sede con ese nombre.')).toBeInTheDocument()
  })

  it('closes on the close button and on Escape', async () => {
    const { onClose, user } = setup()

    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
