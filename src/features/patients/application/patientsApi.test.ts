import { type Mock, describe, expect, it, vi } from 'vitest'
import type { HttpTransport, RequestOptions } from '../../../shared/api/http'
import { createPatientsApi } from './patientsApi'

const patient = {
  booking_blocked: false,
  id: '11111111-1111-1111-1111-111111111111',
  record_number: 42,
  first_name: 'Lucía',
  middle_name: null,
  last_name: 'Mendoza',
  second_last_name: null,
  preferred_name: null,
  birth_date: '1992-03-12',
  sex_at_birth: 'FEMALE',
  phone_e164: '+525518742093',
  email: 'lucia@example.mx',
  occupation: null,
  status: 'ACTIVE',
  notes: null,
  archived_at: null,
  version: 3,
  created_at: '2026-01-10T15:00:00Z',
  updated_at: '2026-02-11T09:30:00Z',
}

type TransportSpies = Record<keyof HttpTransport, Mock>

function stubHttp(overrides: Partial<TransportSpies> = {}): { http: HttpTransport; spies: TransportSpies } {
  const spies: TransportSpies = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
    upload: vi.fn(),
    download: vi.fn(),
    ...overrides,
  }
  return { http: spies as unknown as HttpTransport, spies }
}

describe('patientsApi', () => {
  it('uses encoded search, opaque cursor and requested sort without inventing totals', async () => {
    const { http, spies } = stubHttp({
      get: vi.fn().mockResolvedValue({ items: [], next_cursor: 'opaque-cursor' }),
    })

    const result = await createPatientsApi(http).list({
      q: 'Lu cía',
      limit: 25,
      cursor: 'opaque/cursor',
      sort: 'record_number',
    })

    expect(spies.get).toHaveBeenCalledWith(
      '/api/v1/patients?q=Lu+c%C3%ADa&limit=25&cursor=opaque%2Fcursor&sort=record_number',
      undefined,
    )
    expect(result).toEqual({ items: [], nextCursor: 'opaque-cursor' })
  })

  it('sends patient updates through PATCH with If-Match only', async () => {
    const { http, spies } = stubHttp({ patch: vi.fn().mockResolvedValue({ ...patient, version: 4 }) })
    const updated = await createPatientsApi(http).update({
      id: patient.id,
      version: 3,
      patch: { preferredName: 'Luz' },
    })

    const [path, body, options] = spies.patch.mock.calls[0] as [string, Record<string, unknown>, RequestOptions]
    expect(path).toBe(`/api/v1/patients/${patient.id}`)
    expect(body).toEqual({ preferred_name: 'Luz' })
    expect(body).not.toHaveProperty('expected_version')
    expect(options).toEqual({ ifMatch: 3 })
    expect(updated.version).toBe(4)
  })

  it('uses versioned booking-block and a JSON archive body required by the backend', async () => {
    const { http, spies } = stubHttp({
      put: vi.fn().mockResolvedValue({ ...patient, booking_blocked: true, version: 4 }),
      post: vi.fn().mockResolvedValue(undefined),
    })
    const api = createPatientsApi(http)

    await api.setBookingBlocked({ id: patient.id, version: 3, bookingBlocked: true })
    await api.archive({ id: patient.id, version: 4 })

    expect(spies.put).toHaveBeenCalledWith(
      `/api/v1/patients/${patient.id}/booking-block`,
      { booking_blocked: true },
      { ifMatch: 3 },
    )
    expect(spies.post).toHaveBeenCalledWith(
      `/api/v1/patients/${patient.id}/archive`,
      {},
      { ifMatch: 4 },
    )
  })

  it('preserves null-clearing fields in a partial PATCH', async () => {
    const { http, spies } = stubHttp({ patch: vi.fn().mockResolvedValue({ ...patient, preferred_name: null, version: 4 }) })

    await createPatientsApi(http).update({ id: patient.id, version: 3, patch: { preferredName: '' } })

    expect(spies.patch).toHaveBeenCalledWith(
      `/api/v1/patients/${patient.id}`,
      { preferred_name: null },
      { ifMatch: 3 },
    )
  })
})
