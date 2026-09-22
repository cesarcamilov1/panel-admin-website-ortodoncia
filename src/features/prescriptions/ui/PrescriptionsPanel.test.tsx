import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/problem'
import type { ClinicalApi } from '../../patient-record/application/clinicalApi'
import type { PrescriptionsApi } from '../application/prescriptionsApi'
import { PrescriptionsPanel } from './PrescriptionsPanel'

const patientId = '11111111-1111-1111-1111-111111111111'
const prescriptionId = '22222222-2222-2222-2222-222222222222'

function api(): PrescriptionsApi {
  return {
    list: vi.fn().mockResolvedValue([{ id: prescriptionId, patientId, encounterId: '', providerUserId: 'user-1', status: 'DRAFT', instructions: '', issuedAt: '', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', version: 2 }]),
    create: vi.fn(), get: vi.fn().mockResolvedValue({ id: prescriptionId, patientId, encounterId: '', providerUserId: 'user-1', status: 'DRAFT', instructions: '', issuedAt: '', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', version: 2 }),
    update: vi.fn(), issue: vi.fn(() => new Promise<never>(() => {})), void: vi.fn(), listItems: vi.fn().mockResolvedValue([]), addItem: vi.fn(),
  }
}

const clinicalApi = { listEncounters: vi.fn().mockResolvedValue([]) } as unknown as ClinicalApi

describe('PrescriptionsPanel', () => {
  it('allows an issue request to start only once while it is pending', async () => {
    const user = userEvent.setup()
    const prescriptions = api()
    render(<PrescriptionsPanel api={prescriptions} clinicalApi={clinicalApi} patientId={patientId} userId="user-1" role="OWNER_DENTIST" />)

    await user.click(await screen.findByRole('button', { name: new RegExp(prescriptionId) }))
    await user.click(await screen.findByRole('button', { name: 'Emitir receta' }))
    const confirm = await screen.findByRole('button', { name: 'Confirmar' })
    await user.dblClick(confirm)

    expect(prescriptions.issue).toHaveBeenCalledTimes(1)
    expect(confirm).toBeDisabled()
  })

  it('keeps selected detail and its conflict error visible while the parent list refreshes', async () => {
    const user = userEvent.setup()
    const prescriptions = api()
    prescriptions.issue = vi.fn().mockRejectedValue(new ApiError({ status: 412, code: 'PRECONDITION_FAILED' }))
    prescriptions.list = vi.fn()
      .mockResolvedValueOnce([{ id: prescriptionId, patientId, encounterId: '', providerUserId: 'user-1', status: 'DRAFT', instructions: '', issuedAt: '', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', version: 2 }])
      .mockImplementation(() => new Promise<never>(() => {}))
    render(<PrescriptionsPanel api={prescriptions} clinicalApi={clinicalApi} patientId={patientId} userId="user-1" role="OWNER_DENTIST" />)

    await user.click(await screen.findByRole('button', { name: new RegExp(prescriptionId) }))
    await user.click(await screen.findByRole('button', { name: 'Emitir receta' }))
    await user.click(await screen.findByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByText(/La receta cambió en otra sesión/)).toBeInTheDocument()
    expect(screen.getByText('Versión 2')).toBeInTheDocument()
  })
})
