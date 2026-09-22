import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/problem'
import type { HttpTransport } from '../../../shared/api/http'
import { createFiscalApi } from './fiscalApi'

const patientId = '11111111-1111-1111-1111-111111111111'
const dto = { patient_id: patientId, rfc: 'COSC8001137NA', legal_name: 'Persona física', fiscal_postal_code: '01000', tax_regime_code: '612', default_cfdi_use_code: 'G03', billing_email: 'facturas@example.mx', created_at: '', updated_at: '', version: 2 }

function transport() { return { get: vi.fn(), put: vi.fn().mockResolvedValue(dto), del: vi.fn(), post: vi.fn(), patch: vi.fn(), upload: vi.fn(), download: vi.fn() } as unknown as HttpTransport & { get: ReturnType<typeof vi.fn> } }

describe('FiscalApi', () => {
  it('maps only the fiscal-profile not-found response to empty', async () => {
    const http = transport(); http.get.mockRejectedValue(new ApiError({ status: 404, code: 'FISCAL_DATA_NOT_FOUND' }))
    await expect(createFiscalApi(http).get(patientId)).resolves.toBeNull()
    http.get.mockRejectedValue(new ApiError({ status: 503, code: 'DEPENDENCY_UNAVAILABLE' }))
    await expect(createFiscalApi(http).get(patientId)).rejects.toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' })
  })

  it('uses If-Match for update and delete without duplicating expected_version in the body', async () => {
    const http = transport(); const api = createFiscalApi(http)
    await api.put(patientId, { rfc: 'COSC8001137NA', legalName: 'Persona física', postalCode: '01000', taxRegimeCode: '612', cfdiUseCode: 'G03', billingEmail: '' }, 2)
    await api.delete(patientId, 2)
    expect(http.put).toHaveBeenCalledWith(`/api/v1/patients/${patientId}/fiscal-data`, expect.not.objectContaining({ expected_version: expect.anything() }), { ifMatch: 2 })
    expect(http.del).toHaveBeenCalledWith(`/api/v1/patients/${patientId}/fiscal-data`, { ifMatch: 2 })
  })
})
