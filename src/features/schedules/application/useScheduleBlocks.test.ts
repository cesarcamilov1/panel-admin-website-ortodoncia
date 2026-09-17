import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/problem'
import type { ScheduleBlock, ScheduleBlockDraft } from '../domain/scheduleBlock'
import type { SchedulesApi } from './schedulesApi'
import { useScheduleBlocks } from './useScheduleBlocks'

const PROVIDER = 'prov-1'

function block(overrides: Partial<ScheduleBlock> = {}): ScheduleBlock {
  return {
    id: 'blk-1',
    locationId: '',
    providerUserId: PROVIDER,
    startsAt: '2026-09-21T20:00:00Z',
    endsAt: '2026-09-21T21:00:00Z',
    blockType: 'MEAL',
    reason: 'Comida',
    createdBy: PROVIDER,
    ...overrides,
  }
}

const draft: ScheduleBlockDraft = {
  blockType: 'VACATION',
  startsAt: '2026-12-21T00:00',
  endsAt: '2027-01-05T00:00',
  reason: '',
  locationId: '',
}

function fakeApi(overrides: Partial<SchedulesApi> = {}): SchedulesApi {
  return {
    listSchedules: vi.fn().mockResolvedValue([]),
    createSchedule: vi.fn(),
    deleteSchedule: vi.fn().mockResolvedValue(undefined),
    listBlocks: vi.fn().mockResolvedValue([block()]),
    createBlock: vi.fn(),
    deleteBlock: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-09-21T18:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useScheduleBlocks', () => {
  it('asks for the window the server requires, anchored on today', async () => {
    const api = fakeApi()
    const { result } = renderHook(() => useScheduleBlocks(api, PROVIDER, ''))

    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    expect(api.listBlocks).toHaveBeenCalledWith({
      providerUserId: PROVIDER,
      window: { from: '2026-09-21T06:00:00.000Z', to: '2026-12-20T06:00:00.000Z' },
    })
  })

  it('passes the chosen location', async () => {
    const api = fakeApi()
    renderHook(() => useScheduleBlocks(api, PROVIDER, 'loc-3'))

    await waitFor(() =>
      expect(api.listBlocks).toHaveBeenCalledWith(expect.objectContaining({ locationId: 'loc-3' })),
    )
  })

  it('keeps the created block in chronological order', async () => {
    const created = block({ id: 'blk-2', startsAt: '2026-12-21T06:00:00Z' })
    const api = fakeApi({ createBlock: vi.fn().mockResolvedValue(created) })
    const { result } = renderHook(() => useScheduleBlocks(api, PROVIDER, ''))
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await act(async () => {
      await result.current.create(draft)
    })

    expect(api.createBlock).toHaveBeenCalledWith({ providerUserId: PROVIDER, draft })
    expect(
      result.current.state.status === 'ready' && result.current.state.blocks.map((item) => item.id),
    ).toEqual(['blk-1', 'blk-2'])
  })

  it('drops a removed block', async () => {
    const api = fakeApi()
    const { result } = renderHook(() => useScheduleBlocks(api, PROVIDER, ''))
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await act(async () => {
      await result.current.remove(block())
    })

    expect(api.deleteBlock).toHaveBeenCalledWith({ id: 'blk-1', providerUserId: PROVIDER })
    expect(result.current.state.status === 'ready' && result.current.state.blocks).toEqual([])
  })

  it('reports a readable message when the list fails', async () => {
    const api = fakeApi({
      listBlocks: vi.fn().mockRejectedValue(new ApiError({ status: 0, code: 'NETWORK' })),
    })
    const { result } = renderHook(() => useScheduleBlocks(api, PROVIDER, ''))

    await waitFor(() => expect(result.current.state.status).toBe('error'))
    expect(result.current.state.status === 'error' && result.current.state.message).toMatch(
      /conexión/i,
    )
  })
})
