import type { HttpClient } from '../../../shared/api/http'
import { ApiError } from '../../../shared/api/problem'
import {
  type CatalogService,
  type ServiceListDto,
  fromCatalogServiceDto,
} from '../../services/domain/service'
import {
  type LocationDraft,
  type PracticeLocation,
  type PracticeLocationDto,
  type PracticeLocationListDto,
  byDefaultThenName,
  fromLocationDto,
  toLocationWriteDto,
} from '../domain/location'

const MAX_LOCATION_SERVICES = 200

export interface ListLocationsQuery {
  providerUserId: string
}

export interface CreateLocationInput {
  providerUserId: string
  draft: LocationDraft
}

export interface UpdateLocationInput extends CreateLocationInput {
  id: string
}

export interface LocationServicesQuery {
  locationId: string
  providerUserId: string
}

export interface ReplaceLocationServicesInput extends LocationServicesQuery {
  serviceIds: string[]
}

export interface LocationsApi {
  list: (query: ListLocationsQuery) => Promise<PracticeLocation[]>
  create: (input: CreateLocationInput) => Promise<PracticeLocation>
  update: (input: UpdateLocationInput) => Promise<PracticeLocation>
  listServices: (query: LocationServicesQuery) => Promise<CatalogService[]>
  replaceServices: (input: ReplaceLocationServicesInput) => Promise<void>
}

/**
 * `provider_user_id` is `required: true` on every location endpoint, and no endpoint in
 * the API lists providers. Failing here beats a request the server answers with 404.
 */
function requireProvider(providerUserId: string): string {
  if (!providerUserId) {
    throw new ApiError({
      status: 0,
      code: 'VALIDATION_ERROR',
      detail: 'Falta el profesional al que pertenecen las sedes.',
    })
  }
  return encodeURIComponent(providerUserId)
}

export function createLocationsApi(http: HttpClient): LocationsApi {
  return {
    async list({ providerUserId }) {
      const provider = requireProvider(providerUserId)
      const payload = await http.get<PracticeLocationListDto>(
        `/api/v1/schedules/locations?provider_user_id=${provider}`,
      )
      if (!payload || !Array.isArray(payload.items)) return []
      return byDefaultThenName(payload.items.map(fromLocationDto))
    },

    async create({ providerUserId, draft }) {
      requireProvider(providerUserId)
      const dto = await http.post<PracticeLocationDto>(
        '/api/v1/schedules/locations',
        toLocationWriteDto(draft, providerUserId),
      )
      return fromLocationDto(dto)
    },

    async update({ id, providerUserId, draft }) {
      requireProvider(providerUserId)
      // PracticeLocation carries no version, so there is no precondition to send.
      const dto = await http.put<PracticeLocationDto>(
        `/api/v1/schedules/locations/${encodeURIComponent(id)}`,
        toLocationWriteDto(draft, providerUserId),
      )
      return fromLocationDto(dto)
    },

    async listServices({ locationId, providerUserId }) {
      const provider = requireProvider(providerUserId)
      const payload = await http.get<ServiceListDto>(
        `/api/v1/schedules/locations/${encodeURIComponent(locationId)}/services?provider_user_id=${provider}`,
      )
      if (!payload || !Array.isArray(payload.items)) return []
      return payload.items.map(fromCatalogServiceDto)
    },

    async replaceServices({ locationId, providerUserId, serviceIds }) {
      requireProvider(providerUserId)
      const unique = [...new Set(serviceIds)]
      if (unique.length > MAX_LOCATION_SERVICES) {
        throw new ApiError({
          status: 0,
          code: 'VALIDATION_ERROR',
          detail: `Una sede no puede tener más de ${MAX_LOCATION_SERVICES} servicios.`,
        })
      }
      await http.put<void>(
        `/api/v1/schedules/locations/${encodeURIComponent(locationId)}/services`,
        { provider_user_id: providerUserId, service_ids: unique },
      )
    },
  }
}
