import type { HttpClient } from '../../../shared/api/http'
import {
  type CatalogService,
  type CatalogServiceDto,
  type FiscalConfig,
  type FiscalConfigDraft,
  type FiscalConfigDto,
  type ServiceDraft,
  type ServiceListDto,
  fromCatalogServiceDto,
  fromFiscalConfigDto,
  toFiscalConfigWriteDto,
  toServiceWriteDto,
} from '../domain/service'

export interface ListServicesOptions {
  /** `active=false` makes the backend return the whole catalog, not just the inactive rows. */
  includeInactive?: boolean
}

export interface UpdateServiceInput {
  id: string
  draft: ServiceDraft
  version: number
}

export interface PutFiscalConfigInput {
  serviceId: string
  draft: FiscalConfigDraft
  /** Absent on the first configuration: there is no version to guard yet. */
  version?: number
}

export interface ServicesApi {
  list: (options?: ListServicesOptions) => Promise<CatalogService[]>
  create: (draft: ServiceDraft) => Promise<CatalogService>
  update: (input: UpdateServiceInput) => Promise<CatalogService>
  putFiscalConfig: (input: PutFiscalConfigInput) => Promise<FiscalConfig>
}

function mapList(payload: ServiceListDto | undefined): CatalogService[] {
  if (!payload || !Array.isArray(payload.items)) return []
  return payload.items.map(fromCatalogServiceDto)
}

export function createServicesApi(http: HttpClient): ServicesApi {
  return {
    async list(options = {}) {
      const active = options.includeInactive ? 'false' : 'true'
      const payload = await http.get<ServiceListDto>(`/api/v1/services?active=${active}`)
      return mapList(payload)
    },

    async create(draft) {
      const dto = await http.post<CatalogServiceDto>('/api/v1/services', toServiceWriteDto(draft))
      return fromCatalogServiceDto(dto)
    },

    async update({ id, draft, version }) {
      // The version travels only in If-Match. Sending it in the body too would risk a
      // mismatch rejection, and If-Match is what turns a stale write into a clean 412.
      const dto = await http.put<CatalogServiceDto>(
        `/api/v1/services/${encodeURIComponent(id)}`,
        toServiceWriteDto(draft),
        { ifMatch: version },
      )
      return fromCatalogServiceDto(dto)
    },

    async putFiscalConfig({ serviceId, draft, version }) {
      const dto = await http.put<FiscalConfigDto>(
        `/api/v1/services/${encodeURIComponent(serviceId)}/fiscal-config`,
        toFiscalConfigWriteDto(draft),
        version === undefined ? {} : { ifMatch: version },
      )
      return fromFiscalConfigDto(dto)
    },
  }
}
