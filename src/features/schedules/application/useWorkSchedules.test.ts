import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/problem'
import type { WorkSchedule, WorkScheduleDraft } from '../domain/workSchedule'
import type { SchedulesApi } from './schedulesApi'
import { useWorkSchedules } from './useWorkSchedules'

const PROVIDER = 'prov-1'

function schedule(overrides: Partial<WorkSchedule> = {}): WorkSchedule {
  return {
    id: 'ws-1',
    locationId: 'loc-1',
    providerUserId: PROVIDER,
    weekday: 1,
    startLocalTime: '09:00',
    endLocalTime: '14:00',
    timezone: 'America/Mexico_City',
    effectiveFrom: '2026-01-01',
    effectiveTo: '',
    intervalWeeks: 1,
    isActive: true,
    ...overrides,
  }
}

const draft: WorkScheduleDraft = {
  weekday: 1,
  startLocalTime: '16:00',
  endLocalTime: '20:00',
  effectiveFrom: '2026-01-01',
  effectiveTo: '',
  intervalWeeks: 1,
  locationId: '',
  isActive: true,
}

function fakeApi(overrides: Partial<SchedulesApi> = {}): SchedulesApi {
  return {
    listSchedules: vi.fn().mockResolvedValue([schedule()]),
    createSchedule: vi.fn(),
    deleteSchedule: vi.fn().mockResolvedValue(undefined),
    listBlocks: vi.fn().mockResolvedValue([]),
    createBlock: vi.fn(),
    deleteBlock: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('useWorkSchedules', () => {
  it('loads the provider ranges on mount', async () => {
    const api = fakeApi()
    const { result } = renderHook(() => useWorkSchedules(api, PROVIDER, ''))

    expect(result.current.state.status).toBe('loading')
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    expect(api.listSchedules).toHaveBeenCalledWith({ providerUserId: PROVIDER })
  })

  it('passes the chosen location to the server filter', async () => {
    const api = fakeApi()
    renderHook(() => useWorkSchedules(api, PROVIDER, 'loc-9'))

    await waitFor(() =>
      expect(api.listSchedules).toHaveBeenCalledWith({
        providerUserId: PROVIDER,
        locationId: 'loc-9',
      }),
    )
  })

  it('reloads when the location changes', async () => {
    const api = fakeApi()
    const { rerender } = renderHook(({ location }) => useWorkSchedules(api, PROVIDER, location), {
      initialProps: { location: '' },
    })

    await waitFor(() => expect(api.listSchedules).toHaveBeenCalledTimes(1))
    rerender({ location: 'loc-2' })
    await waitFor(() => expect(api.listSchedules).toHaveBeenCalledTimes(2))
  })

  it('keeps the created range in week order without refetching', async () => {
    const created = schedule({ id: 'ws-2', startLocalTime: '16:00', endLocalTime: '20:00' })
    const api = fakeApi({ createSchedule: vi.fn().mockResolvedValue(created) })
    const { result } = renderHook(() => useWorkSchedules(api, PROVIDER, ''))
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await act(async () => {
      await result.current.create(draft)
    })

    expect(api.createSchedule).toHaveBeenCalledWith({ providerUserId: PROVIDER, draft })
    expect(result.current.state.status === 'ready' && result.current.state.schedules).toHaveLength(2)
    expect(api.listSchedules).toHaveBeenCalledTimes(1)
  })

  it('drops the removed range from the week', async () => {
    const api = fakeApi()
    const { result } = renderHook(() => useWorkSchedules(api, PROVIDER, ''))
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await act(async () => {
      await result.current.remove(schedule())
    })

    expect(api.deleteSchedule).toHaveBeenCalledWith({ id: 'ws-1', providerUserId: PROVIDER })
    expect(result.current.state.status === 'ready' && result.current.state.schedules).toEqual([])
  })

  it('reports a readable message when the list fails', async () => {
    const api = fakeApi({
      listSchedules: vi.fn().mockRejectedValue(new ApiError({ status: 403, code: 'FORBIDDEN' })),
    })
    const { result } = renderHook(() => useWorkSchedules(api, PROVIDER, ''))

    await waitFor(() => expect(result.current.state.status).toBe('error'))
    expect(result.current.state.status === 'error' && result.current.state.message).toMatch(
      /titular/i,
    )
  })

  it('lets a failed create surface to the caller and leaves the week untouched', async () => {
    const api = fakeApi({
      createSchedule: vi.fn().mockRejectedValue(new ApiError({ status: 409, code: 'CONFLICT' })),
    })
    const { result } = renderHook(() => useWorkSchedules(api, PROVIDER, ''))
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await expect(result.current.create(draft)).rejects.toBeInstanceOf(ApiError)
    expect(result.current.state.status === 'ready' && result.current.state.schedules).toHaveLength(1)
  })
})
