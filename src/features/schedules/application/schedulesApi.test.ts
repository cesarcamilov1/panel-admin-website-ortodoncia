import { type Mock, describe, expect, it, vi } from 'vitest'
import type { HttpClient } from '../../../shared/api/http'
import { ApiError } from '../../../shared/api/problem'
import type { ScheduleBlockDraft, ScheduleBlockDto } from '../domain/scheduleBlock'
import type { WorkScheduleDraft, WorkScheduleDto } from '../domain/workSchedule'
import { createSchedulesApi } from './schedulesApi'

const PROVIDER = '22222222-2222-2222-2222-222222222222'
const LOCATION = '11111111-1111-1111-1111-111111111111'

const scheduleDto: WorkScheduleDto = {
  id: 'ws-1',
  location_id: LOCATION,
  provider_user_id: PROVIDER,
  weekday: 1,
  start_local_time: '09:00',
  end_local_time: '14:00',
  timezone: 'America/Mexico_City',
  effective_from: '2026-01-01',
  is_active: true,
}

const blockDto: ScheduleBlockDto = {
  id: 'blk-1',
  provider_user_id: PROVIDER,
  starts_at: '2026-09-21T20:00:00Z',
  ends_at: '2026-09-21T21:00:00Z',
  block_type: 'MEAL',
  created_by: PROVIDER,
}

const scheduleDraft: WorkScheduleDraft = {
  weekday: 2,
  startLocalTime: '08:30',
  endLocalTime: '13:00',
  effectiveFrom: '2026-10-01',
  effectiveTo: '',
  intervalWeeks: 1,
  locationId: '',
  isActive: true,
}

const blockDraft: ScheduleBlockDraft = {
  blockType: 'MEAL',
  startsAt: '2026-09-21T14:00',
  endsAt: '2026-09-21T15:00',
  reason: 'Comida',
  locationId: '',
}

const window = { from: '2026-09-21T06:00:00.000Z', to: '2026-12-20T06:00:00.000Z' }

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

describe('schedulesApi.listSchedules', () => {
  it('sends the required provider and maps the rows in week order', async () => {
    const other: WorkScheduleDto = { ...scheduleDto, id: 'ws-2', weekday: 1, start_local_time: '07:00' }
    const { http, spies } = stubHttp({
      get: vi.fn().mockResolvedValue({ items: [scheduleDto, other] }),
    })

    const result = await createSchedulesApi(http).listSchedules({ providerUserId: PROVIDER })

    expect(spies.get).toHaveBeenCalledWith(`/api/v1/schedules?provider_user_id=${PROVIDER}`)
    expect(result.map((item) => item.id)).toEqual(['ws-2', 'ws-1'])
  })

  it('adds the location filter only when one was chosen', async () => {
    const { http, spies } = stubHttp({ get: vi.fn().mockResolvedValue({ items: [] }) })

    await createSchedulesApi(http).listSchedules({ providerUserId: PROVIDER, locationId: LOCATION })

    expect(spies.get).toHaveBeenCalledWith(
      `/api/v1/schedules?provider_user_id=${PROVIDER}&location_id=${LOCATION}`,
    )
  })

  it('refuses to call without a provider, because the server requires it', async () => {
    const { http, spies } = stubHttp()

    await expect(
      createSchedulesApi(http).listSchedules({ providerUserId: '' }),
    ).rejects.toBeInstanceOf(ApiError)
    expect(spies.get).not.toHaveBeenCalled()
  })

  it('survives a payload without items', async () => {
    const { http } = stubHttp({ get: vi.fn().mockResolvedValue(undefined) })

    await expect(
      createSchedulesApi(http).listSchedules({ providerUserId: PROVIDER }),
    ).resolves.toEqual([])
  })
})

describe('schedulesApi.createSchedule', () => {
  it('posts the write payload and maps the created row', async () => {
    const { http, spies } = stubHttp({ post: vi.fn().mockResolvedValue(scheduleDto) })

    const created = await createSchedulesApi(http).createSchedule({
      providerUserId: PROVIDER,
      draft: scheduleDraft,
    })

    expect(spies.post).toHaveBeenCalledWith('/api/v1/schedules', {
      provider_user_id: PROVIDER,
      weekday: 2,
      start_local_time: '08:30',
      end_local_time: '13:00',
      effective_from: '2026-10-01',
      interval_weeks: 1,
      is_active: true,
    })
    expect(created.id).toBe('ws-1')
  })

  it('needs a provider too', async () => {
    const { http, spies } = stubHttp()

    await expect(
      createSchedulesApi(http).createSchedule({ providerUserId: '', draft: scheduleDraft }),
    ).rejects.toBeInstanceOf(ApiError)
    expect(spies.post).not.toHaveBeenCalled()
  })
})

describe('schedulesApi.deleteSchedule', () => {
  it('carries the provider in the query, where the handler reads it', async () => {
    const { http, spies } = stubHttp({ del: vi.fn().mockResolvedValue(undefined) })

    await createSchedulesApi(http).deleteSchedule({ id: 'ws 1', providerUserId: PROVIDER })

    expect(spies.del).toHaveBeenCalledWith(`/api/v1/schedules/ws%201?provider_user_id=${PROVIDER}`)
  })
})

describe('schedulesApi.listBlocks', () => {
  it('always sends the required window, encoded', async () => {
    const { http, spies } = stubHttp({ get: vi.fn().mockResolvedValue({ items: [blockDto] }) })

    const result = await createSchedulesApi(http).listBlocks({ providerUserId: PROVIDER, window })

    expect(spies.get).toHaveBeenCalledWith(
      `/api/v1/schedule-blocks?provider_user_id=${PROVIDER}` +
        `&from=${encodeURIComponent(window.from)}&to=${encodeURIComponent(window.to)}`,
    )
    expect(result[0].blockType).toBe('MEAL')
  })

  it('sorts the blocks chronologically', async () => {
    const later: ScheduleBlockDto = { ...blockDto, id: 'later', starts_at: '2026-10-01T15:00:00Z' }
    const { http } = stubHttp({ get: vi.fn().mockResolvedValue({ items: [later, blockDto] }) })

    const result = await createSchedulesApi(http).listBlocks({ providerUserId: PROVIDER, window })

    expect(result.map((item) => item.id)).toEqual(['blk-1', 'later'])
  })

  it('adds the location filter when one was chosen', async () => {
    const { http, spies } = stubHttp({ get: vi.fn().mockResolvedValue({ items: [] }) })

    await createSchedulesApi(http).listBlocks({
      providerUserId: PROVIDER,
      window,
      locationId: LOCATION,
    })

    expect(spies.get).toHaveBeenCalledWith(expect.stringContaining(`&location_id=${LOCATION}`))
  })
})

describe('schedulesApi.createBlock', () => {
  it('posts the instants the server parses with RFC3339', async () => {
    const { http, spies } = stubHttp({ post: vi.fn().mockResolvedValue(blockDto) })

    const created = await createSchedulesApi(http).createBlock({
      providerUserId: PROVIDER,
      draft: blockDraft,
    })

    expect(spies.post).toHaveBeenCalledWith('/api/v1/schedule-blocks', {
      provider_user_id: PROVIDER,
      starts_at: '2026-09-21T20:00:00.000Z',
      ends_at: '2026-09-21T21:00:00.000Z',
      block_type: 'MEAL',
      reason: 'Comida',
    })
    expect(created.id).toBe('blk-1')
  })
})

describe('schedulesApi.deleteBlock', () => {
  it('carries the provider in the query', async () => {
    const { http, spies } = stubHttp({ del: vi.fn().mockResolvedValue(undefined) })

    await createSchedulesApi(http).deleteBlock({ id: 'blk-1', providerUserId: PROVIDER })

    expect(spies.del).toHaveBeenCalledWith(
      `/api/v1/schedule-blocks/blk-1?provider_user_id=${PROVIDER}`,
    )
  })

  it('needs a provider, or the server would delete nothing and answer 404', async () => {
    const { http, spies } = stubHttp()

    await expect(
      createSchedulesApi(http).deleteBlock({ id: 'blk-1', providerUserId: '' }),
    ).rejects.toBeInstanceOf(ApiError)
    expect(spies.del).not.toHaveBeenCalled()
  })
})
