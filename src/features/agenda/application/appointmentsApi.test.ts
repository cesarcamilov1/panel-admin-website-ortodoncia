import { type Mock, describe, expect, it, vi } from 'vitest'
import type { HttpTransport, RequestOptions } from '../../../shared/api/http'
import { createAppointmentsApi } from './appointmentsApi'

const APPOINTMENT = '11111111-1111-1111-1111-111111111111'
const PATIENT = '22222222-2222-2222-2222-222222222222'
const PROVIDER = '33333333-3333-3333-3333-333333333333'
const SERVICE = '44444444-4444-4444-4444-444444444444'

const dto = {
  id: APPOINTMENT, patient_id: PATIENT, provider_user_id: PROVIDER, source: 'MANUAL',
  starts_at: '2026-09-16T15:00:00Z', ends_at: '2026-09-16T15:30:00Z', status: 'PENDING',
  created_at: '2026-09-01T15:00:00Z', updated_at: '2026-09-01T15:00:00Z', version: 3,
  services: [{ id: 'line-1', appointment_id: APPOINTMENT, service_code: 'AJUSTE', service_name: 'Ajuste', unit_price: '500.00', currency: 'MXN', line_number: 1, duration_minutes: 30, quantity: '1', created_at: '2026-09-01T15:00:00Z' }],
}

type HttpSpies = Record<keyof HttpTransport, Mock>
function stubHttp(overrides: Partial<HttpSpies> = {}): { http: HttpTransport; spies: HttpSpies } {
  const spies: HttpSpies = { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn(), ...overrides }
  return { http: spies as unknown as HttpTransport, spies }
}

describe('appointmentsApi', () => {
  it('uses RFC3339 bounded windows and preserves stale-request cancellation', async () => {
    const signal = new AbortController().signal
    const { http, spies } = stubHttp({ get: vi.fn().mockResolvedValue({ items: [dto] }) })
    const items = await createAppointmentsApi(http).list({
      from: '2026-09-14T00:00:00.000Z', to: '2026-09-21T00:00:00.000Z', locationId: 'loc 1', providerUserId: PROVIDER, signal,
    })

    expect(spies.get).toHaveBeenCalledWith(
      `/api/v1/appointments?from=${encodeURIComponent('2026-09-14T00:00:00.000Z')}&to=${encodeURIComponent('2026-09-21T00:00:00.000Z')}&location_id=loc+1&provider_user_id=${PROVIDER}`,
      { signal },
    )
    expect(items[0].status).toBe('PENDING')
  })

  it('rejects windows larger than 31 days before requesting the backend', async () => {
    const { http, spies } = stubHttp()
    await expect(createAppointmentsApi(http).list({ from: '2026-09-01T00:00:00Z', to: '2026-10-03T00:00:00Z' })).rejects.toThrow(/31 días/i)
    expect(spies.get).not.toHaveBeenCalled()
  })

  it('posts an idempotent manual booking and sends no fabricated availability state', async () => {
    const { http, spies } = stubHttp({ post: vi.fn().mockResolvedValue(dto) })
    await createAppointmentsApi(http).create({
      patientId: PATIENT, providerUserId: PROVIDER, serviceIds: [SERVICE], startsAt: dto.starts_at,
      source: 'MANUAL', reason: 'Control', internalNotes: 'Traer estudios', idempotencyKey: 'attempt-0000000001',
    })
    expect(spies.post).toHaveBeenCalledWith('/api/v1/appointments', {
      patient_id: PATIENT, provider_user_id: PROVIDER, service_ids: [SERVICE], starts_at: dto.starts_at,
      source: 'MANUAL', reason: 'Control', internal_notes: 'Traer estudios',
    }, { idempotencyKey: 'attempt-0000000001' })
  })

  it('uses If-Match for transitions and reschedules, never expected_version in both channels', async () => {
    const { http, spies } = stubHttp({ post: vi.fn().mockResolvedValue({ ...dto, version: 4 }) })
    const api = createAppointmentsApi(http)
    await api.transition({ id: APPOINTMENT, version: 3, status: 'CONFIRMED', reason: '' })
    await api.reschedule({ id: APPOINTMENT, version: 4, startsAt: '2026-09-17T15:00:00Z' })

    const [, transitionBody, transitionOptions] = spies.post.mock.calls[0] as [string, Record<string, unknown>, RequestOptions]
    expect(transitionBody).toEqual({ status: 'CONFIRMED', reason: '' })
    expect(transitionOptions).toEqual({ ifMatch: 3 })
    const [, rescheduleBody, rescheduleOptions] = spies.post.mock.calls[1] as [string, Record<string, unknown>, RequestOptions]
    expect(rescheduleBody).toEqual({ starts_at: '2026-09-17T15:00:00Z' })
    expect(rescheduleOptions).toEqual({ ifMatch: 4 })
  })

  it('supports staff-only identity candidates and PATCH waitlist status', async () => {
    const { http, spies } = stubHttp({ get: vi.fn().mockResolvedValue({ items: [] }), patch: vi.fn().mockResolvedValue({}) })
    const api = createAppointmentsApi(http)
    await api.listIdentityCandidates(APPOINTMENT)
    await api.updateWaitlistStatus({ id: 'wait-1', status: 'CONTACTED' })
    expect(spies.get).toHaveBeenCalledWith(`/api/v1/appointments/${APPOINTMENT}/identity-candidates`)
    expect(spies.patch).toHaveBeenCalledWith('/api/v1/waitlist/wait-1', { status: 'CONTACTED' })
  })
})
