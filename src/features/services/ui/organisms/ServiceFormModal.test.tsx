import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../../shared/api/problem'
import type { CatalogService } from '../../domain/service'
import { ServiceFormModal } from './ServiceFormModal'

const existing: CatalogService = {
  id: 'svc-1',
  code: 'LIMP-01',
  name: 'Limpieza dental',
  description: 'Profilaxis y pulido',
  durationMinutes: 45,
  defaultPrice: '850.00',
  currency: 'MXN',
  isActive: true,
  createdAt: '2026-01-10T15:00:00Z',
  updatedAt: '2026-02-11T09:30:00Z',
  version: 3,
}

function setup(props: Partial<Parameters<typeof ServiceFormModal>[0]> = {}) {
  const onClose = vi.fn()
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  render(<ServiceFormModal onClose={onClose} onSubmit={onSubmit} {...props} />)
  return { onClose, onSubmit, user: userEvent.setup() }
}

describe('ServiceFormModal in create mode', () => {
  it('opens as a labelled dialog with an empty form', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Nuevo servicio' })).toBeInTheDocument()
    expect(screen.getByLabelText('Código')).toHaveValue('')
    expect(screen.getByLabelText('Nombre')).toHaveValue('')
  })

  it('submits the trimmed draft when every field is valid', async () => {
    const { onSubmit, user } = setup()

    await user.type(screen.getByLabelText('Código'), 'ORTO-01')
    await user.type(screen.getByLabelText('Nombre'), 'Ortodoncia ajuste')
    await user.clear(screen.getByLabelText('Duración (minutos)'))
    await user.type(screen.getByLabelText('Duración (minutos)'), '30')
    await user.type(screen.getByLabelText('Precio (MXN)'), '600.00')
    await user.click(screen.getByRole('button', { name: 'Crear servicio' }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        code: 'ORTO-01',
        name: 'Ortodoncia ajuste',
        description: '',
        durationMinutes: 30,
        defaultPrice: '600.00',
        isActive: true,
      }),
    )
  })

  it('blocks submission and shows why when the code breaks the server pattern', async () => {
    const { onSubmit, user } = setup()

    await user.type(screen.getByLabelText('Código'), 'limp 01')
    await user.type(screen.getByLabelText('Nombre'), 'Limpieza')
    await user.type(screen.getByLabelText('Precio (MXN)'), '850')
    await user.click(screen.getByRole('button', { name: 'Crear servicio' }))

    expect(await screen.findByText(/mayúsculas/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects a duration that is not a multiple of five', async () => {
    const { onSubmit, user } = setup()

    await user.type(screen.getByLabelText('Código'), 'ORTO-01')
    await user.type(screen.getByLabelText('Nombre'), 'Ortodoncia')
    await user.clear(screen.getByLabelText('Duración (minutos)'))
    await user.type(screen.getByLabelText('Duración (minutos)'), '37')
    await user.type(screen.getByLabelText('Precio (MXN)'), '600')
    await user.click(screen.getByRole('button', { name: 'Crear servicio' }))

    expect(await screen.findByText(/múltiplos de 5/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects a price with a thousands separator', async () => {
    const { onSubmit, user } = setup()

    await user.type(screen.getByLabelText('Código'), 'ORTO-01')
    await user.type(screen.getByLabelText('Nombre'), 'Ortodoncia')
    await user.type(screen.getByLabelText('Precio (MXN)'), '1,850.00')
    await user.click(screen.getByRole('button', { name: 'Crear servicio' }))

    expect(await screen.findByText(/separador de miles/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('ServiceFormModal in edit mode', () => {
  it('prefills every field from the service and renames the action', () => {
    setup({ service: existing })

    expect(screen.getByRole('dialog', { name: 'Editar servicio' })).toBeInTheDocument()
    expect(screen.getByLabelText('Código')).toHaveValue('LIMP-01')
    expect(screen.getByLabelText('Nombre')).toHaveValue('Limpieza dental')
    expect(screen.getByLabelText('Descripción')).toHaveValue('Profilaxis y pulido')
    expect(screen.getByLabelText('Duración (minutos)')).toHaveValue('45')
    expect(screen.getByLabelText('Precio (MXN)')).toHaveValue('850')
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument()
  })

  it('keeps the price string byte-for-byte when it is not edited', async () => {
    const { onSubmit, user } = setup({
      service: { ...existing, defaultPrice: '1234.567890' },
    })

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ defaultPrice: '1234.567890' })),
    )
  })

  it('can pause the service from the form', async () => {
    const { onSubmit, user } = setup({ service: existing })

    await user.click(screen.getByRole('switch', { name: /disponible para agendar/i }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ isActive: false })),
    )
  })
})

describe('ServiceFormModal failures', () => {
  it('shows the server message and stays open when saving fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError({ status: 403, code: 'FORBIDDEN' }))
    const { user } = setup({ service: existing, onSubmit })

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText(/permiso/i)).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Editar servicio' })).toBeInTheDocument()
  })

  it('maps server field errors back onto the offending input', async () => {
    const onSubmit = vi.fn().mockRejectedValue(
      new ApiError({
        status: 400,
        code: 'VALIDATION_ERROR',
        fields: [{ field: 'code', code: 'duplicate', message: 'Ese código ya existe.' }],
      }),
    )
    const { user } = setup({ service: existing, onSubmit })

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Ese código ya existe.')).toBeInTheDocument()
  })

  it('closes on the close button and on Escape', async () => {
    const { onClose, user } = setup()

    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('disables the action while the save is in flight', async () => {
    let release = () => {}
    const onSubmit = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { release = resolve }),
    )
    const { user } = setup({ service: existing, onSubmit })

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()

    release()
  })
})


describe.each([undefined, existing])('ServiceFormModal shared inputs (%s)', (service) => {
  const action = service ? 'Guardar cambios' : 'Crear servicio'

  async function prepare() {
    const result = setup({ service })
    if (!service) {
      await result.user.type(screen.getByLabelText('Código'), 'ORTO-01')
      await result.user.type(screen.getByLabelText('Nombre'), 'Ortodoncia')
      await result.user.type(screen.getByLabelText('Precio (MXN)'), '850')
    }
    return result
  }

  it('offers editable duration suggestions from 10 to 180 minutes', () => {
    setup({ service })
    const input = screen.getByLabelText('Duración (minutos)')
    expect(screen.getByRole('combobox', { name: 'Duración (minutos)' })).toBe(input)
    expect(input).toHaveAttribute('inputmode', 'numeric')
    expect(screen.getByText('De 5 a 480, en pasos de 5.')).toBeInTheDocument()
    const listId = input.getAttribute('list')
    expect(listId).toBeTruthy()
    const list = document.getElementById(listId!)
    expect(list?.tagName).toBe('DATALIST')
    expect(Array.from(list!.querySelectorAll('option'), (option) => option.value)).toEqual(
      Array.from({ length: 18 }, (_, index) => String((index + 1) * 10)),
    )
  })

  it('removes the price format hint and shows an integer placeholder', () => {
    setup({ service })
    expect(screen.queryByText('Sin separador de miles. Punto decimal.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Precio (MXN)')).toHaveAttribute('placeholder', '850')
  })

  it.each([5, 10, 180, 185, 480])('accepts the manual duration %i', async (minutes) => {
    const { user, onSubmit } = await prepare()
    const input = screen.getByLabelText('Duración (minutos)')
    await user.clear(input)
    expect(input).toHaveValue('')
    await user.type(input, String(minutes))
    await user.click(screen.getByRole('button', { name: action }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ durationMinutes: minutes }))
  })

  it.each(['', '4', '37', '485', '30.5', 'abc', '1e2'])('rejects the manual duration "%s"', async (minutes) => {
    const { user, onSubmit } = await prepare()
    const input = screen.getByLabelText('Duración (minutos)')
    await user.clear(input)
    if (minutes) await user.type(input, minutes)
    await user.click(screen.getByRole('button', { name: action }))
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('allows entering decimals and hides only zero fractions on blur', async () => {
    const { user, onSubmit } = await prepare()
    const price = screen.getByLabelText('Precio (MXN)')
    await user.clear(price)
    await user.type(price, '850.00')
    expect(price).toHaveValue('850.00')
    await user.tab()
    expect(price).toHaveValue('850')
    await user.clear(price)
    await user.type(price, '850.50')
    await user.tab()
    expect(price).toHaveValue('850.50')
    await user.click(screen.getByRole('button', { name: action }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ defaultPrice: '850.50' }))
  })
})

describe('ServiceFormModal display-only formatting', () => {
  it.each([
    ['850.00', '850'],
    ['0.00', '0'],
    ['850.50', '850.50'],
    ['1234.567890', '1234.567890'],
  ])('displays %s as %s without changing its submitted value', async (original, displayed) => {
    const { user, onSubmit } = setup({ service: { ...existing, defaultPrice: original } })
    const price = screen.getByLabelText('Precio (MXN)')
    expect(price).toHaveValue(displayed)
    await user.click(price)
    await user.tab()
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ defaultPrice: original }))
  })

  it('gives each modal its own duration suggestion list', () => {
    setup()
    setup({ service: existing })
    const ids = screen.getAllByLabelText('Duración (minutos)').map((input) => input.getAttribute('list'))
    expect(ids.every(Boolean)).toBe(true)
    expect(new Set(ids).size).toBe(2)
  })
})
