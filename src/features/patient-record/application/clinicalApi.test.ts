import { describe, expect, it, vi } from 'vitest'
import { createClinicalApi } from './clinicalApi'
import type { HttpTransport } from '../../../shared/api/http'

const patientId = '11111111-1111-1111-1111-111111111111'
const encounterId = '22222222-2222-2222-2222-222222222222'
const noteId = '33333333-3333-3333-3333-333333333333'
const odontogramId = '44444444-4444-4444-4444-444444444444'

function transport() {
  return {
    get: vi.fn().mockResolvedValue({ items: [] }), post: vi.fn().mockImplementation((path: string) => Promise.resolve(path.includes('/amendments') ? { amendment: {}, note: {} } : {})),
    put: vi.fn(), patch: vi.fn().mockResolvedValue({}), del: vi.fn(), upload: vi.fn(), download: vi.fn(),
  } as unknown as HttpTransport
}

describe('ClinicalApi', () => {
  it('uses the patient subresource endpoints and maps patch payloads', async () => {
    const http = transport()
    const api = createClinicalApi(http)
    await api.listAddresses(patientId)
    await api.createAddress(patientId, { addressType: 'HOME', street: 'Calle 1', exteriorNumber: '', interiorNumber: '', neighborhood: '', municipality: '', state: '', postalCode: '', countryCode: 'MX', isPrimary: true })
    await api.updateAddress(patientId, 'resource-id', { street: 'Calle 2' })
    await api.listEmergencyContacts(patientId)
    await api.createEmergencyContact(patientId, { name: 'Ana', relationship: '', phoneE164: '+525512345678', isPrimary: true })
    await api.updateEmergencyContact(patientId, 'resource-id', { relationship: 'Madre' })
    await api.listMedicalHistory(patientId)
    await api.createMedicalHistory(patientId, { conditions: ['Diabetes'], smoker: false, summaryNotes: '', confirmedAt: '' })
    await api.listItems(patientId, 'conditions')
    await api.createItem(patientId, 'allergies', { name: 'Penicilina', reaction: 'Erupción' })
    await api.updateItem(patientId, 'medications', 'resource-id', { dose: '10 mg' })

    expect(http.get).toHaveBeenCalledWith(`/api/v1/patients/${patientId}/addresses`, undefined)
    expect(http.post).toHaveBeenCalledWith(`/api/v1/patients/${patientId}/medical-history`, { schema_version: 'v1', answers: { conditions: ['Diabetes'], smoker: false }, summary_notes: null, confirmed_at: null })
    expect(http.patch).toHaveBeenCalledWith(`/api/v1/patients/${patientId}/medications/resource-id`, { dose: '10 mg' })
  })

  it('covers the versioned encounter, note, and odontogram workflows', async () => {
    const http = transport()
    const api = createClinicalApi(http)
    await api.listEncounters(patientId)
    await api.createEncounter({ patientId, providerUserId: '55555555-5555-5555-5555-555555555555', startedAt: '2026-01-01T09:00:00Z' })
    await api.getEncounter(encounterId)
    await api.completeEncounter(encounterId, 2)
    await api.voidEncounter(encounterId, 3, 'Duplicado')
    await api.listDiagnoses(encounterId)
    await api.createDiagnosis(encounterId, { description: 'Caries' })
    await api.listNotes(encounterId)
    await api.createNote({ encounterId, noteType: 'SOAP' })
    await api.getNote(noteId)
    await api.updateNote(noteId, 2, { noteType: 'SOAP', plan: 'Control' })
    await api.signNote(noteId, 3)
    await api.listAmendments(noteId)
    await api.addAmendment(noteId, 4, { reason: 'Corrección', amendmentText: 'Texto corregido' })
    await api.listOdontograms(patientId)
    await api.createOdontogram({ patientId, encounterId })
    await api.getOdontogram(odontogramId)
    await api.listOdontogramEntries(odontogramId)
    await api.createOdontogramEntry(odontogramId, 5, { toothNumber: 16, surface: 'OCCLUSAL', status: 'CARIES' })
    await api.signOdontogram(odontogramId, 6)

    expect(http.get).toHaveBeenCalledWith(`/api/v1/encounters?patient_id=${patientId}&limit=100`, undefined)
    expect(http.post).toHaveBeenCalledWith(`/api/v1/encounters/${encounterId}/complete`, { expected_version: 2 }, { ifMatch: 2 })
    expect(http.patch).toHaveBeenCalledWith(`/api/v1/clinical-notes/${noteId}`, { note_type: 'SOAP', plan: 'Control', expected_version: 2 }, { ifMatch: 2 })
    expect(http.post).toHaveBeenCalledWith(`/api/v1/odontograms/${odontogramId}/entries`, { tooth_number: 16, surface: 'OCCLUSAL', status: 'CARIES', expected_version: 5 }, { ifMatch: 5 })
  })
})
