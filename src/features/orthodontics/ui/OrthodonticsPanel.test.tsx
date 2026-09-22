import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ClinicalApi } from '../../patient-record/application/clinicalApi'
import type { OrthodonticsApi } from '../application/orthodonticsApi'
import { OrthodonticsPanel } from './OrthodonticsPanel'

const patientId = '11111111-1111-1111-1111-111111111111'
const caseId = '22222222-2222-2222-2222-222222222222'

function api(): OrthodonticsApi {
  return {
    listCases: vi.fn().mockResolvedValue([{ id: caseId, patientId, treatmentPlanId: '', providerUserId: 'user-1', startedOn: '', estimatedEndOn: '', monthlyFee: '', currency: 'MXN', notes: '', status: 'PLANNED', completedOn: '', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', version: 2 }]),
    createCase: vi.fn(), getCase: vi.fn().mockResolvedValue({ id: caseId, patientId, treatmentPlanId: '', providerUserId: 'user-1', startedOn: '', estimatedEndOn: '', monthlyFee: '', currency: 'MXN', notes: '', status: 'PLANNED', completedOn: '', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', version: 2 }),
    transitionCase: vi.fn(() => new Promise<never>(() => {})), listVisits: vi.fn().mockResolvedValue([]), addVisit: vi.fn(),
  }
}

const clinicalApi = { listEncounters: vi.fn().mockResolvedValue([]) } as unknown as ClinicalApi

describe('OrthodonticsPanel', () => {
  it('allows a case status mutation to start only once while it is pending', async () => {
    const user = userEvent.setup()
    const orthodontics = api()
    render(<OrthodonticsPanel api={orthodontics} clinicalApi={clinicalApi} patientId={patientId} userId="user-1" owner />)

    await user.click(await screen.findByRole('button', { name: new RegExp(caseId) }))
    await user.selectOptions(await screen.findByLabelText('Cambiar estado'), 'ACTIVE')
    await user.click(await screen.findByRole('button', { name: 'Cambiar estado' }))
    const confirm = await screen.findByRole('button', { name: 'Confirmar cambio' })
    await user.dblClick(confirm)

    expect(orthodontics.transitionCase).toHaveBeenCalledTimes(1)
    expect(confirm).toBeDisabled()
  })

  it('does not offer case mutations to an owner who is not the recorded provider', async () => {
    const user = userEvent.setup()
    render(<OrthodonticsPanel api={api()} clinicalApi={clinicalApi} patientId={patientId} userId="another-owner" owner />)

    await user.click(await screen.findByRole('button', { name: new RegExp(caseId) }))

    expect(screen.queryByLabelText('Cambiar estado')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar visita' })).not.toBeInTheDocument()
  })
})
