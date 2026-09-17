import { type Mock, describe, expect, it, vi } from 'vitest'
import type { HttpClient, RequestOptions } from '../../../shared/api/http'
import { ApiError } from '../../../shared/api/problem'
import type { CatalogServiceDto, FiscalConfigDraft, ServiceDraft } from '../domain/service'
import { createServicesApi } from './servicesApi'

const dto: CatalogServiceDto = {
  id: '11111111-1111-1111-1111-111111111111',
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

const draft: ServiceDraft = {
  code: 'LIMP-01',
  name: 'Limpieza dental',
  description: 'Profilaxis',
  durationMinutes: 45,
  defaultPrice: '850.00',
  isActive: true,
}

const fiscalDraft: FiscalConfigDraft = {
  satProductServiceCode: '86121600',
  satUnitCode: 'E48',
  satTaxObjectCode: '02',
  defaultInvoiceDescription: '',
  validFrom: '2026-01-01',
  validTo: '',
  taxRules: [
    {
      taxKind: 'TRANSFER',
      satTaxCode: '002',
      factorType: 'Tasa',
      rateOrQuota: '0.160000',
      isActive: true,
      validFrom: '2026-01-01',
      validTo: '',
    },
  ],
}

describe('servicesApi.list', () => {
  it('requests only active services by default', async () => {
    const { http, spies } = stubHttp({ get: vi.fn().mockResolvedValue({ items: [dto] }) })
    const result = await createServicesApi(http).list()

    expect(spies.get).toHaveBeenCalledWith('/api/v1/services?active=true')
    expect(result).toHaveLength(1)
    expect(result[0].durationMinutes).toBe(45)
  })

  it('asks for the whole catalog with active=false when inactive ones are wanted', async () => {
    const { http, spies } = stubHttp({ get: vi.fn().mockResolvedValue({ items: [] }) })
    await createServicesApi(http).list({ includeInactive: true })

    expect(spies.get).toHaveBeenCalledWith('/api/v1/services?active=false')
  })

  it('returns an empty list when the payload has no items array', async () => {
    const { http } = stubHttp({ get: vi.fn().mockResolvedValue({}) })
    await expect(createServicesApi(http).list()).resolves.toEqual([])
  })
})

describe('servicesApi.create', () => {
  it('posts the write payload and maps the created service', async () => {
    const { http, spies } = stubHttp({ post: vi.fn().mockResolvedValue(dto) })
    const created = await createServicesApi(http).create(draft)

    expect(spies.post).toHaveBeenCalledWith('/api/v1/services', {
      code: 'LIMP-01',
      name: 'Limpieza dental',
      description: 'Profilaxis',
      duration_minutes: 45,
      default_price: '850.00',
      currency: 'MXN',
      is_active: true,
    })
    expect(created.id).toBe(dto.id)
  })
})

describe('servicesApi.update', () => {
  it('sends the version as If-Match and never duplicates it in the body', async () => {
    const { http, spies } = stubHttp({ put: vi.fn().mockResolvedValue({ ...dto, version: 4 }) })
    const updated = await createServicesApi(http).update({ id: dto.id, draft, version: 3 })

    const [path, body, options] = spies.put.mock.calls[0] as [string, unknown, RequestOptions]
    expect(path).toBe(`/api/v1/services/${dto.id}`)
    expect(body).not.toHaveProperty('expected_version')
    expect(options).toEqual({ ifMatch: 3 })
    expect(updated.version).toBe(4)
  })

  it('propagates a 412 so the caller can prompt a reload', async () => {
    const conflict = new ApiError({ status: 412, code: 'PRECONDITION_FAILED' })
    const { http } = stubHttp({ put: vi.fn().mockRejectedValue(conflict) })

    await expect(
      createServicesApi(http).update({ id: dto.id, draft, version: 3 }),
    ).rejects.toBe(conflict)
  })
})

describe('servicesApi.putFiscalConfig', () => {
  it('sends the fiscal payload with the version as If-Match', async () => {
    const response = {
      service_id: dto.id,
      sat_product_service_code: '86121600',
      sat_unit_code: 'E48',
      sat_tax_object_code: '02',
      fiscal_validated_at: '2026-03-01T10:00:00Z',
      valid_from: '2026-01-01',
      version: 2,
    }
    const { http, spies } = stubHttp({ put: vi.fn().mockResolvedValue(response) })

    const saved = await createServicesApi(http).putFiscalConfig({
      serviceId: dto.id,
      draft: fiscalDraft,
      version: 1,
    })

    const [path, body, options] = spies.put.mock.calls[0] as [string, Record<string, unknown>, RequestOptions]
    expect(path).toBe(`/api/v1/services/${dto.id}/fiscal-config`)
    expect(body.sat_product_service_code).toBe('86121600')
    expect(body).not.toHaveProperty('expected_version')
    expect(options).toEqual({ ifMatch: 1 })
    expect(saved).toEqual({
      serviceId: dto.id,
      satProductServiceCode: '86121600',
      satUnitCode: 'E48',
      satTaxObjectCode: '02',
      defaultInvoiceDescription: '',
      fiscalValidatedAt: '2026-03-01T10:00:00Z',
      validFrom: '2026-01-01',
      validTo: '',
      version: 2,
    })
  })

  it('omits If-Match entirely on the first fiscal configuration', async () => {
    const { http, spies } = stubHttp({
      put: vi.fn().mockResolvedValue({
        service_id: dto.id,
        sat_product_service_code: '86121600',
        sat_unit_code: 'E48',
        sat_tax_object_code: '02',
        fiscal_validated_at: '2026-03-01T10:00:00Z',
        valid_from: '2026-01-01',
        version: 1,
      }),
    })

    await createServicesApi(http).putFiscalConfig({ serviceId: dto.id, draft: fiscalDraft })

    const [, , options] = spies.put.mock.calls[0] as [string, unknown, RequestOptions | undefined]
    expect(options).toEqual({})
  })
})
