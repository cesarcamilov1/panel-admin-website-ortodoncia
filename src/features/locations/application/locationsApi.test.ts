import { type Mock, describe, expect, it, vi } from 'vitest'
import type { HttpClient } from '../../../shared/api/http'
import { ApiError } from '../../../shared/api/problem'
import type { CatalogServiceDto } from '../../services/domain/service'
import type { LocationDraft, PracticeLocationDto } from '../domain/location'
import { createLocationsApi } from './locationsApi'

const PROVIDER = '22222222-2222-2222-2222-222222222222'
const LOCATION = '11111111-1111-1111-1111-111111111111'

const dto: PracticeLocationDto = {
  id: LOCATION,
  provider_user_id: PROVIDER,
  name: 'Sede Polanco',
  address: 'Av. Masaryk 111',
  is_active: true,
  is_default: true,
  all_services: false,
  travel_buffer_minutes: 30,
}

const serviceDto: CatalogServiceDto = {
  id: 'svc-1',
  code: 'LIMP-01',
  name: 'Limpieza dental',
  duration_minutes: 45,
  default_price: '850.00',
  currency: 'MXN',
  is_active: true,
  created_at: '2026-01-10T15:00:00Z',
  updated_at: '2026-02-11T09:30:00Z',
  version: 3,
}

const draft: LocationDraft = {
  name: 'Sede Roma',
  address: 'Orizaba 20',
  travelBufferMinutes: 15,
}

type HttpSpies = Record<keyof HttpClient, Mock>

function stubHttp(overrides: Partial<HttpSpies> = {}): { http: HttpClient; spies: HttpSpies } {
  const spies: HttpSpies = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
    ...overrides,
  }
  return { http: spies as unknown as HttpClient, spies }
}

describe('locationsApi.list', () => {
  it('always sends the required provider and maps the rows', async () => {
    const { http, spies } = stubHttp({ get: vi.fn().mockResolvedValue({ items: [dto] }) })
    const result = await createLocationsApi(http).list({ providerUserId: PROVIDER })

    expect(spies.get).toHaveBeenCalledWith(
      `/api/v1/schedules/locations?provider_user_id=${PROVIDER}`,
    )
    expect(result).toHaveLength(1)
    expect(result[0].travelBufferMinutes).toBe(30)
  })

  it('refuses to call without a provider, because the server requires it', async () => {
    const { http, spies } = stubHttp({ get: vi.fn() })

    await expect(createLocationsApi(http).list({ providerUserId: '' })).rejects.toBeInstanceOf(
      ApiError,
    )
    expect(spies.get).not.toHaveBeenCalled()
  })

  it('returns an empty list when the payload carries no items array', async () => {
    const { http } = stubHttp({ get: vi.fn().mockResolvedValue({}) })
    await expect(createLocationsApi(http).list({ providerUserId: PROVIDER })).resolves.toEqual([])
  })

  it('keeps the server ordering: default first, then by name', async () => {
    const { http } = stubHttp({
      get: vi.fn().mockResolvedValue({
        items: [
          { ...dto, id: 'b', name: 'Sede Roma', is_default: false },
          { ...dto, id: 'a', name: 'Aguascalientes', is_default: true },
        ],
      }),
    })
    const result = await createLocationsApi(http).list({ providerUserId: PROVIDER })
    expect(result.map((row) => row.name)).toEqual(['Aguascalientes', 'Sede Roma'])
  })
})

describe('locationsApi.create', () => {
  it('posts the write payload with the provider', async () => {
    const { http, spies } = stubHttp({ post: vi.fn().mockResolvedValue(dto) })
    const created = await createLocationsApi(http).create({ providerUserId: PROVIDER, draft })

    expect(spies.post).toHaveBeenCalledWith('/api/v1/schedules/locations', {
      provider_user_id: PROVIDER,
      name: 'Sede Roma',
      address: 'Orizaba 20',
      travel_buffer_minutes: 15,
    })
    expect(created.id).toBe(LOCATION)
  })
})

describe('locationsApi.update', () => {
  it('puts to the location path and never sends If-Match, since there is no version', async () => {
    const { http, spies } = stubHttp({ put: vi.fn().mockResolvedValue(dto) })
    await createLocationsApi(http).update({ id: LOCATION, providerUserId: PROVIDER, draft })

    const [path, body, options] = spies.put.mock.calls[0] as [string, unknown, unknown]
    expect(path).toBe(`/api/v1/schedules/locations/${LOCATION}`)
    expect(body).toEqual({
      provider_user_id: PROVIDER,
      name: 'Sede Roma',
      address: 'Orizaba 20',
      travel_buffer_minutes: 15,
    })
    expect(options).toBeUndefined()
  })
})

describe('locationsApi.listServices', () => {
  it('reads the allowlist of a location with the provider', async () => {
    const { http, spies } = stubHttp({ get: vi.fn().mockResolvedValue({ items: [serviceDto] }) })
    const result = await createLocationsApi(http).listServices({
      locationId: LOCATION,
      providerUserId: PROVIDER,
    })

    expect(spies.get).toHaveBeenCalledWith(
      `/api/v1/schedules/locations/${LOCATION}/services?provider_user_id=${PROVIDER}`,
    )
    expect(result[0].code).toBe('LIMP-01')
  })
})

describe('locationsApi.replaceServices', () => {
  it('replaces the allowlist and resolves with nothing on 204', async () => {
    const { http, spies } = stubHttp({ put: vi.fn().mockResolvedValue(undefined) })

    await expect(
      createLocationsApi(http).replaceServices({
        locationId: LOCATION,
        providerUserId: PROVIDER,
        serviceIds: ['svc-1', 'svc-1', 'svc-2'],
      }),
    ).resolves.toBeUndefined()

    expect(spies.put).toHaveBeenCalledWith(`/api/v1/schedules/locations/${LOCATION}/services`, {
      provider_user_id: PROVIDER,
      service_ids: ['svc-1', 'svc-2'],
    })
  })

  it('refuses more than the 200 ids the contract allows before touching the network', async () => {
    const { http, spies } = stubHttp({ put: vi.fn() })
    const serviceIds = Array.from({ length: 201 }, (_, index) => `id-${index}`)

    await expect(
      createLocationsApi(http).replaceServices({
        locationId: LOCATION,
        providerUserId: PROVIDER,
        serviceIds,
      }),
    ).rejects.toBeInstanceOf(ApiError)
    expect(spies.put).not.toHaveBeenCalled()
  })

  it('allows an empty allowlist, which leaves the location offering nothing', async () => {
    const { http, spies } = stubHttp({ put: vi.fn().mockResolvedValue(undefined) })

    await createLocationsApi(http).replaceServices({
      locationId: LOCATION,
      providerUserId: PROVIDER,
      serviceIds: [],
    })

    expect(spies.put).toHaveBeenCalledWith(`/api/v1/schedules/locations/${LOCATION}/services`, {
      provider_user_id: PROVIDER,
      service_ids: [],
    })
  })
})
