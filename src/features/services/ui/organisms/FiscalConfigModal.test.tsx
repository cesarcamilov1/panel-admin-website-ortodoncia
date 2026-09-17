import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../../shared/api/problem'
import type { CatalogService } from '../../domain/service'
import { FiscalConfigModal } from './FiscalConfigModal'

const service: CatalogService = {
  id: 'svc-1',
  code: 'LIMP-01',
  name: 'Limpieza dental',
  description: '',
  durationMinutes: 45,
  defaultPrice: '850.00',
  currency: 'MXN',
  isActive: true,
  createdAt: '2026-01-10T15:00:00Z',
  updatedAt: '2026-02-11T09:30:00Z',
  version: 3,
}

function setup(props: Partial<Parameters<typeof FiscalConfigModal>[0]> = {}) {
  const onClose = vi.fn()
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  render(<FiscalConfigModal service={service} onClose={onClose} onSubmit={onSubmit} {...props} />)
  return { onClose, onSubmit, user: userEvent.setup() }
}

describe('FiscalConfigModal', () => {
  it('names the service it is configuring', () => {
    setup()
    expect(screen.getByRole('dialog', { name: /datos fiscales/i })).toBeInTheDocument()
    expect(screen.getByText(/Limpieza dental/)).toBeInTheDocument()
  })

  it('warns that it replaces the configuration, because the API offers no way to read it back', () => {
    setup()
    expect(screen.getByText(/reemplaza/i)).toBeInTheDocument()
  })

  it('starts with one IVA 16% transfer rule, the ordinary Mexican case', () => {
    setup()
    expect(screen.getByLabelText('Clave SAT del impuesto 1')).toHaveValue('002')
    expect(screen.getByLabelText('Tasa o cuota 1')).toHaveValue('0.160000')
  })

  it('submits the mapped draft when every field is valid', async () => {
    const { onSubmit, user } = setup()

    await user.type(screen.getByLabelText('Clave de producto o servicio SAT'), '86121600')
    await user.type(screen.getByLabelText('Clave de unidad SAT'), 'E48')
    await user.type(screen.getByLabelText('Clave de objeto de impuesto SAT'), '02')
    await user.type(screen.getByLabelText('Vigente desde'), '2026-01-01')
    await user.click(screen.getByRole('button', { name: 'Guardar datos fiscales' }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        satProductServiceCode: '86121600',
        satUnitCode: 'E48',
        satTaxObjectCode: '02',
        defaultInvoiceDescription: '',
        validFrom: '2026-01-01',
        validTo: '',
        taxRules: [
          {
            taxKind: 'TRANSFER',
            satTaxCode: '002',
            factorType: 'Tasa',
            rateOrQuota: '0.160000',
            isActive: true,
            validFrom: '2026-01-01',
            validTo: '',
          },
        ],
      }),
    )
  })

  it('rejects a SAT product code that is not eight digits', async () => {
    const { onSubmit, user } = setup()

    await user.type(screen.getByLabelText('Clave de producto o servicio SAT'), '8612160')
    await user.type(screen.getByLabelText('Clave de unidad SAT'), 'E48')
    await user.type(screen.getByLabelText('Clave de objeto de impuesto SAT'), '02')
    await user.type(screen.getByLabelText('Vigente desde'), '2026-01-01')
    await user.click(screen.getByRole('button', { name: 'Guardar datos fiscales' }))

    expect(await screen.findByText(/8 dígitos/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('requires a start date for the fiscal validity', async () => {
    const { onSubmit, user } = setup()

    await user.type(screen.getByLabelText('Clave de producto o servicio SAT'), '86121600')
    await user.type(screen.getByLabelText('Clave de unidad SAT'), 'E48')
    await user.type(screen.getByLabelText('Clave de objeto de impuesto SAT'), '02')
    await user.click(screen.getByRole('button', { name: 'Guardar datos fiscales' }))

    expect(await screen.findByText('La vigencia necesita una fecha de inicio válida.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('adds and removes tax rules, keeping at least one', async () => {
    const { user } = setup()

    await user.click(screen.getByRole('button', { name: /agregar impuesto/i }))
    expect(screen.getByLabelText('Clave SAT del impuesto 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Quitar impuesto 2' }))
    expect(screen.queryByLabelText('Clave SAT del impuesto 2')).not.toBeInTheDocument()

    expect(screen.queryByRole('button', { name: 'Quitar impuesto 1' })).not.toBeInTheDocument()
  })

  it('drops the rate when the factor is Exento', async () => {
    const { onSubmit, user } = setup()

    await user.type(screen.getByLabelText('Clave de producto o servicio SAT'), '86121600')
    await user.type(screen.getByLabelText('Clave de unidad SAT'), 'E48')
    await user.type(screen.getByLabelText('Clave de objeto de impuesto SAT'), '02')
    await user.type(screen.getByLabelText('Vigente desde'), '2026-01-01')
    await user.selectOptions(screen.getByLabelText('Factor 1'), 'Exento')
    expect(screen.getByLabelText('Tasa o cuota 1')).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Guardar datos fiscales' }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          taxRules: [expect.objectContaining({ factorType: 'Exento', rateOrQuota: '' })],
        }),
      ),
    )
  })

  it('maps the withholding label to the server token', async () => {
    const { onSubmit, user } = setup()

    await user.type(screen.getByLabelText('Clave de producto o servicio SAT'), '86121600')
    await user.type(screen.getByLabelText('Clave de unidad SAT'), 'E48')
    await user.type(screen.getByLabelText('Clave de objeto de impuesto SAT'), '02')
    await user.type(screen.getByLabelText('Vigente desde'), '2026-01-01')
    await user.selectOptions(screen.getByLabelText('Tipo 1'), 'Retención')
    await user.click(screen.getByRole('button', { name: 'Guardar datos fiscales' }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          taxRules: [expect.objectContaining({ taxKind: 'WITHHOLDING' })],
        }),
      ),
    )
  })

  it('surfaces the validator being unavailable without closing', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(new ApiError({ status: 503, code: 'DEPENDENCY_UNAVAILABLE' }))
    const { user } = setup({ onSubmit })

    await user.type(screen.getByLabelText('Clave de producto o servicio SAT'), '86121600')
    await user.type(screen.getByLabelText('Clave de unidad SAT'), 'E48')
    await user.type(screen.getByLabelText('Clave de objeto de impuesto SAT'), '02')
    await user.type(screen.getByLabelText('Vigente desde'), '2026-01-01')
    await user.click(screen.getByRole('button', { name: 'Guardar datos fiscales' }))

    expect(await screen.findByText(/validador fiscal/i)).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: /datos fiscales/i })).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const { onClose, user } = setup()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
