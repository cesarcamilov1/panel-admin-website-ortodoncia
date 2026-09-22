import type { HttpTransport } from '../../../shared/api/http'
import { ApiError } from '../../../shared/api/problem'
import { fromFiscalDataDto, toFiscalWriteDto, type FiscalData, type FiscalDataDto, type FiscalDraft } from '../domain/fiscal'

const id = encodeURIComponent

export interface FiscalApi {
  get(patientId: string, signal?: AbortSignal): Promise<FiscalData | null>
  put(patientId: string, draft: FiscalDraft, version?: number): Promise<FiscalData>
  delete(patientId: string, version: number): Promise<void>
}

export function createFiscalApi(http: HttpTransport): FiscalApi {
  const path = (patientId: string) => `/api/v1/patients/${id(patientId)}/fiscal-data`
  return {
    async get(patientId, signal) {
      try {
        return fromFiscalDataDto(await http.get<FiscalDataDto>(path(patientId), signal ? { signal } : undefined))
      } catch (error) {
        if (error instanceof ApiError && error.status === 404 && error.code === 'FISCAL_DATA_NOT_FOUND') return null
        throw error
      }
    },
    async put(patientId, draft, version) {
      return fromFiscalDataDto(await http.put<FiscalDataDto>(path(patientId), toFiscalWriteDto(draft), version === undefined ? undefined : { ifMatch: version }))
    },
    async delete(patientId, version) {
      await http.del(path(patientId), { ifMatch: version })
    },
  }
}
