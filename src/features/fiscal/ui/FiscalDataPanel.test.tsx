import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/problem'
import type { FiscalApi } from '../application/fiscalApi'
import { FiscalDataPanel } from './FiscalDataPanel'

const patientId = '11111111-1111-1111-1111-111111111111'
const profile = { patientId, rfc: 'COSC8001137NA', legalName: 'Persona física', postalCode: '01000', taxRegimeCode: '612', cfdiUseCode: 'G03', billingEmail: '', createdAt: '', updatedAt: '', version: 2 }
const api = (overrides: Partial<FiscalApi> = {}): FiscalApi => ({ get: vi.fn().mockResolvedValue(profile), put: vi.fn().mockResolvedValue(profile), delete: vi.fn(), ...overrides })

describe('FiscalDataPanel', () => {
  it('renders a true empty fiscal profile and saves with an in-flight duplicate guard', async () => {
    const value = api({ get: vi.fn().mockResolvedValue(null), put: vi.fn().mockImplementation(() => new Promise(() => {})) })
    render(<FiscalDataPanel api={value} patientId={patientId} canManage />)
    await screen.findByText('No hay datos fiscales registrados.')
    await userEvent.type(screen.getByLabelText('RFC'), 'COSC8001137NA')
    await userEvent.type(screen.getByLabelText('Razón social'), 'Persona física')
    await userEvent.type(screen.getByLabelText('Código postal fiscal'), '01000')
    await userEvent.type(screen.getByLabelText('Régimen fiscal'), '612')
    await userEvent.type(screen.getByLabelText('Uso CFDI predeterminado'), 'G03')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar datos fiscales' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardando…' }))
    expect(value.put).toHaveBeenCalledTimes(1)
  })

  it('does not swallow a fiscal read failure', async () => {
    render(<FiscalDataPanel api={api({ get: vi.fn().mockRejectedValue(new ApiError({ status: 503, code: 'DEPENDENCY_UNAVAILABLE' })) })} patientId={patientId} canManage />)
    expect(await screen.findByText(/servicio fiscal/i)).toBeInTheDocument()
  })

  it('requires explicit deletion confirmation and explains the recent-MFA server rejection', async () => {
    const value = api({ delete: vi.fn().mockRejectedValue(new ApiError({ status: 403, code: 'FORBIDDEN' })) })
    render(<FiscalDataPanel api={value} patientId={patientId} canManage />)
    await screen.findByDisplayValue('COSC8001137NA')
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar datos fiscales' }))
    expect(value.delete).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar eliminación' }))
    expect(await screen.findByText(/MFA reciente/i)).toBeInTheDocument()
  })

  it('does not expose mutations to denied roles', async () => {
    render(<FiscalDataPanel api={api()} patientId={patientId} canManage={false} />)
    await screen.findByDisplayValue('COSC8001137NA')
    expect(screen.queryByRole('button', { name: 'Guardar datos fiscales' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Eliminar datos fiscales' })).not.toBeInTheDocument()
  })
})
