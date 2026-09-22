import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ClinicalApi } from '../application/clinicalApi'
import { ApiError } from '../../../shared/api/problem'
import { ClinicalTab, NotesTab, OdontogramTab } from './ClinicalRecordTabs'

const patientId = '11111111-1111-1111-1111-111111111111'
const odontogramId = '22222222-2222-2222-2222-222222222222'

function api(): ClinicalApi {
  return {
    listAddresses: vi.fn().mockResolvedValue([]), createAddress: vi.fn(), updateAddress: vi.fn(),
    listEmergencyContacts: vi.fn().mockResolvedValue([]), createEmergencyContact: vi.fn(), updateEmergencyContact: vi.fn(),
    listMedicalHistory: vi.fn().mockResolvedValue([]), createMedicalHistory: vi.fn(),
    listItems: vi.fn().mockResolvedValue([]), createItem: vi.fn(), updateItem: vi.fn(),
    listEncounters: vi.fn().mockResolvedValue([]), createEncounter: vi.fn(), getEncounter: vi.fn(), completeEncounter: vi.fn(), voidEncounter: vi.fn(),
    listDiagnoses: vi.fn(), createDiagnosis: vi.fn(),
    listNotes: vi.fn(), createNote: vi.fn(), getNote: vi.fn(), updateNote: vi.fn(), signNote: vi.fn(), listAmendments: vi.fn(), addAmendment: vi.fn(),
    listOdontograms: vi.fn().mockResolvedValue([{ id: odontogramId, patientId, encounterId: '', versionNumber: 2, status: 'SIGNED', signedAt: '2026-01-01T00:00:00Z', createdBy: 'user-1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', version: 3 }]),
    createOdontogram: vi.fn(),
    getOdontogram: vi.fn().mockResolvedValue({ id: odontogramId, patientId, encounterId: '', versionNumber: 2, status: 'SIGNED', signedAt: '2026-01-01T00:00:00Z', createdBy: 'user-1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', version: 3 }),
    listOdontogramEntries: vi.fn().mockResolvedValue([{ id: 'entry-1', odontogramId, toothNumber: 16, surface: 'OCCLUSAL', conditionCode: 'CARIES', status: 'ACTIVE', notes: 'Lesión observada', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }]),
    createOdontogramEntry: vi.fn(), signOdontogram: vi.fn(),
  }
}

const encounter = { id: 'encounter-1', appointmentId: '', patientId, providerUserId: 'other-provider', status: 'OPEN' as const, startedAt: '2026-01-01T00:00:00Z', endedAt: '', voidReason: '', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', version: 1 }
const draftNote = { id: 'note-1', encounterId: encounter.id, patientId, providerUserId: 'other-provider', noteType: 'SOAP', subjective: '', objective: '', assessment: '', plan: '', additionalNotes: '', status: 'DRAFT' as const, signedAt: '', contentHash: '', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', version: 1 }

function deferred<T>() {
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((_resolve, rejectPromise) => { reject = rejectPromise })
  return { promise, reject }
}

describe('ClinicalRecordTabs', () => {
  it('does not offer encounter actions or diagnoses to a different owner provider', async () => {
    const client = api()
    client.listEncounters = vi.fn().mockResolvedValue([encounter])
    client.getEncounter = vi.fn().mockResolvedValue(encounter)
    client.listDiagnoses = vi.fn().mockResolvedValue([])
    const user = userEvent.setup()
    render(<ClinicalTab api={client} patientId={patientId} userId="current-provider" owner />)

    await user.click(await screen.findByRole('button', { name: /Atención abierta/ }))

    expect(await screen.findByText('Detalle de atención')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Completar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Agregar diagnóstico' })).not.toBeInTheDocument()
  })

  it('allows an assistant to edit a draft note but never sign another provider note', async () => {
    const client = api()
    client.listEncounters = vi.fn().mockResolvedValue([encounter])
    client.listNotes = vi.fn().mockResolvedValue([draftNote])
    client.getNote = vi.fn().mockResolvedValue(draftNote)
    const user = userEvent.setup()
    render(<NotesTab api={client} patientId={patientId} userId="assistant-1" owner={false} />)

    await user.selectOptions(await screen.findByLabelText('Atención'), encounter.id)
    await user.click(await screen.findByRole('button', { name: /SOAP/ }))

    expect(await screen.findByRole('button', { name: 'Editar borrador' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Firmar nota' })).not.toBeInTheDocument()
  })

  it('does not offer draft editing to an owner who is not the note provider', async () => {
    const client = api()
    client.listEncounters = vi.fn().mockResolvedValue([encounter])
    client.listNotes = vi.fn().mockResolvedValue([draftNote])
    client.getNote = vi.fn().mockResolvedValue(draftNote)
    const user = userEvent.setup()
    render(<NotesTab api={client} patientId={patientId} userId="current-provider" owner />)

    await user.selectOptions(await screen.findByLabelText('Atención'), encounter.id)
    await user.click(await screen.findByRole('button', { name: /SOAP/ }))

    expect(await screen.findByText('Detalle de nota')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar borrador' })).not.toBeInTheDocument()
  })

  it('keeps an encounter conflict readable and blocks a stale second completion when refresh fails', async () => {
    const client = api()
    const ownedEncounter = { ...encounter, providerUserId: 'current-provider' }
    client.listEncounters = vi.fn().mockResolvedValue([ownedEncounter])
    const refresh = deferred<typeof ownedEncounter>()
    client.getEncounter = vi.fn().mockResolvedValueOnce(ownedEncounter).mockReturnValueOnce(refresh.promise)
    client.listDiagnoses = vi.fn().mockResolvedValue([])
    client.completeEncounter = vi.fn().mockRejectedValue(new ApiError({ status: 412, code: 'VERSION_CONFLICT' }))
    const user = userEvent.setup()
    render(<ClinicalTab api={client} patientId={patientId} userId="current-provider" owner />)

    await user.click(await screen.findByRole('button', { name: /Atención abierta/ }))
    await user.click(await screen.findByRole('button', { name: 'Completar' }))
    await user.click(await screen.findByRole('button', { name: /Confirmar finalización/ }))

    expect(await screen.findByText(/El registro cambió en otra sesión/)).toBeInTheDocument()
    await waitFor(() => expect(client.getEncounter).toHaveBeenCalledTimes(2))
    refresh.reject(new ApiError({ status: 500, code: 'UNAVAILABLE' }))
    expect(await screen.findByText(/El servicio no está disponible/)).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: /Confirmar finalización/ })
    expect(confirm).toBeDisabled()
    await user.click(confirm)
    expect(client.completeEncounter).toHaveBeenCalledTimes(1)
  })

  it('keeps a note conflict readable and blocks a stale second edit when detail refresh fails', async () => {
    const client = api()
    client.listEncounters = vi.fn().mockResolvedValue([encounter])
    client.listNotes = vi.fn().mockResolvedValue([draftNote])
    const refresh = deferred<typeof draftNote>()
    client.getNote = vi.fn().mockResolvedValueOnce(draftNote).mockReturnValueOnce(refresh.promise)
    client.updateNote = vi.fn().mockRejectedValue(new ApiError({ status: 412, code: 'VERSION_CONFLICT' }))
    const user = userEvent.setup()
    render(<NotesTab api={client} patientId={patientId} userId="assistant-1" owner={false} />)

    await user.selectOptions(await screen.findByLabelText('Atención'), encounter.id)
    await user.click(await screen.findByRole('button', { name: /SOAP/ }))
    await user.click(await screen.findByRole('button', { name: 'Editar borrador' }))
    await user.click(await screen.findByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(client.getNote).toHaveBeenCalledTimes(2))
    refresh.reject(new ApiError({ status: 500, code: 'UNAVAILABLE' }))
    expect(await screen.findByText(/El registro cambió en otra sesión/)).toBeInTheDocument()
    expect(await screen.findByText(/El servicio no está disponible/)).toBeInTheDocument()
    const save = screen.getByRole('button', { name: 'Guardar' })
    expect(save).toBeDisabled()
    await user.click(save)
    expect(client.updateNote).toHaveBeenCalledTimes(1)
  })

  it('keeps a note signing conflict visible after refreshing authoritative detail', async () => {
    const client = api()
    const ownedNote = { ...draftNote, providerUserId: 'current-provider' }
    client.listEncounters = vi.fn().mockResolvedValue([encounter])
    client.listNotes = vi.fn().mockResolvedValue([ownedNote])
    client.getNote = vi.fn().mockResolvedValue(ownedNote)
    client.signNote = vi.fn().mockRejectedValue(new ApiError({ status: 412, code: 'VERSION_CONFLICT' }))
    const user = userEvent.setup()
    render(<NotesTab api={client} patientId={patientId} userId="current-provider" owner />)

    await user.selectOptions(await screen.findByLabelText('Atención'), encounter.id)
    await user.click(await screen.findByRole('button', { name: /SOAP/ }))
    await user.click(await screen.findByRole('button', { name: 'Firmar nota' }))
    await user.click(await screen.findByRole('button', { name: 'Confirmar firma' }))

    expect(await screen.findByText(/El registro cambió en otra sesión/)).toBeInTheDocument()
    expect(client.getNote).toHaveBeenCalledTimes(2)
  })

  it('keeps an odontogram conflict readable and blocks a stale second signature when refresh fails', async () => {
    const client = api()
    const draftOdontogram = { id: odontogramId, patientId, encounterId: '', versionNumber: 2, status: 'DRAFT' as const, signedAt: '', createdBy: 'user-1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', version: 3 }
    client.listOdontograms = vi.fn().mockResolvedValue([draftOdontogram])
    const refresh = deferred<typeof draftOdontogram>()
    client.getOdontogram = vi.fn().mockResolvedValueOnce(draftOdontogram).mockReturnValueOnce(refresh.promise)
    client.signOdontogram = vi.fn().mockRejectedValue(new ApiError({ status: 412, code: 'VERSION_CONFLICT' }))
    const user = userEvent.setup()
    render(<OdontogramTab api={client} patientId={patientId} owner />)

    await user.click(await screen.findByRole('button', { name: /Versión 2/ }))
    await user.click(await screen.findByRole('button', { name: 'Firmar odontograma' }))
    await user.click(await screen.findByRole('button', { name: 'Confirmar firma' }))

    expect(await screen.findByText(/El registro cambió en otra sesión/)).toBeInTheDocument()
    await waitFor(() => expect(client.getOdontogram).toHaveBeenCalledTimes(2))
    refresh.reject(new ApiError({ status: 500, code: 'UNAVAILABLE' }))
    expect(await screen.findByText(/El servicio no está disponible/)).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: 'Confirmar firma' })
    expect(confirm).toBeDisabled()
    await user.click(confirm)
    expect(client.signOdontogram).toHaveBeenCalledTimes(1)
  })

  it('shows immutable entries for signed odontograms without offering draft mutations', async () => {
    const user = userEvent.setup()
    render(<OdontogramTab api={api()} patientId={patientId} owner />)

    await user.click(await screen.findByRole('button', { name: /Versión 2/ }))

    expect(await screen.findByText(/Pieza 16 · OCCLUSAL/)).toBeInTheDocument()
    expect(screen.getByText(/Lesión observada/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Agregar entrada' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Firmar odontograma' })).not.toBeInTheDocument()
  })
})
