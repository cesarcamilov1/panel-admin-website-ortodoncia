import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/problem'
import type { LocationDraft, PracticeLocation } from '../domain/location'
import type { LocationsApi } from './locationsApi'
import { useLocations } from './useLocations'

const PROVIDER = 'prov-1'

function location(overrides: Partial<PracticeLocation> = {}): PracticeLocation {
  return {
    id: 'loc-1',
    providerUserId: PROVIDER,
    name: 'Sede Polanco',
    address: 'Av. Masaryk 111',
    isActive: true,
    isDefault: true,
    allServices: true,
    travelBufferMinutes: 30,
    ...overrides,
  }
}

const draft: LocationDraft = { name: 'Sede Roma', address: 'Orizaba 20', travelBufferMinutes: 15 }

function fakeApi(overrides: Partial<LocationsApi> = {}): LocationsApi {
  return {
    list: vi.fn().mockResolvedValue([location()]),
    create: vi.fn(),
    update: vi.fn(),
    listServices: vi.fn().mockResolvedValue([]),
    replaceServices: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('useLocations boot', () => {
  it('loads the provider locations on mount', async () => {
    const api = fakeApi()
    const { result } = renderHook(() => useLocations(api, PROVIDER))

    expect(result.current.state.status).toBe('loading')
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    expect(api.list).toHaveBeenCalledWith({ providerUserId: PROVIDER })
  })

  it('surfaces a readable message when the load fails', async () => {
    const api = fakeApi({
      list: vi.fn().mockRejectedValue(new ApiError({ status: 403, code: 'FORBIDDEN' })),
    })
    const { result } = renderHook(() => useLocations(api, PROVIDER))

    await waitFor(() => expect(result.current.state.status).toBe('error'))
    if (result.current.state.status !== 'error') throw new Error('expected error')
    expect(result.current.state.message).toMatch(/titular/i)
  })

  it('reloads when the provider changes', async () => {
    const api = fakeApi()
    const { result, rerender } = renderHook(({ provider }) => useLocations(api, provider), {
      initialProps: { provider: PROVIDER },
    })
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    rerender({ provider: 'prov-2' })
    await waitFor(() => expect(api.list).toHaveBeenCalledWith({ providerUserId: 'prov-2' }))
  })
})

describe('useLocations create', () => {
  it('adds the created location in server order', async () => {
    const created = location({ id: 'loc-2', name: 'Aguascalientes', isDefault: false })
    const list = vi.fn().mockResolvedValue([location()])
    const api = fakeApi({ list, create: vi.fn().mockResolvedValue(created) })

    const { result } = renderHook(() => useLocations(api, PROVIDER))
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await act(async () => {
      await result.current.create(draft)
    })

    expect(api.create).toHaveBeenCalledWith({ providerUserId: PROVIDER, draft })
    if (result.current.state.status !== 'ready') throw new Error('expected ready')
    expect(result.current.state.locations.map((row) => row.name)).toEqual([
      'Sede Polanco',
      'Aguascalientes',
    ])
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('rethrows so the form can show the failure', async () => {
    const failure = new ApiError({ status: 400, code: 'VALIDATION_ERROR' })
    const api = fakeApi({ create: vi.fn().mockRejectedValue(failure) })

    const { result } = renderHook(() => useLocations(api, PROVIDER))
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await expect(result.current.create(draft)).rejects.toBe(failure)
  })
})

describe('useLocations update', () => {
  it('replaces the location in place', async () => {
    const updated = location({ name: 'Sede Polanco Norte' })
    const api = fakeApi({ update: vi.fn().mockResolvedValue(updated) })

    const { result } = renderHook(() => useLocations(api, PROVIDER))
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await act(async () => {
      await result.current.update({ id: 'loc-1', draft })
    })

    expect(api.update).toHaveBeenCalledWith({ id: 'loc-1', providerUserId: PROVIDER, draft })
    if (result.current.state.status !== 'ready') throw new Error('expected ready')
    expect(result.current.state.locations[0].name).toBe('Sede Polanco Norte')
  })
})

describe('useLocations service allowlist', () => {
  it('reads a location allowlist through the api', async () => {
    const api = fakeApi()
    const { result } = renderHook(() => useLocations(api, PROVIDER))
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await act(async () => {
      await result.current.listServices('loc-1')
    })

    expect(api.listServices).toHaveBeenCalledWith({
      locationId: 'loc-1',
      providerUserId: PROVIDER,
    })
  })

  it('refetches after replacing, because the server also flips allServices off', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce([location({ allServices: true })])
      .mockResolvedValueOnce([location({ allServices: false })])
    const api = fakeApi({ list })

    const { result } = renderHook(() => useLocations(api, PROVIDER))
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await act(async () => {
      await result.current.replaceServices({ locationId: 'loc-1', serviceIds: ['svc-1'] })
    })

    expect(api.replaceServices).toHaveBeenCalledWith({
      locationId: 'loc-1',
      providerUserId: PROVIDER,
      serviceIds: ['svc-1'],
    })
    await waitFor(() => {
      if (result.current.state.status !== 'ready') throw new Error('not ready')
      expect(result.current.state.locations[0].allServices).toBe(false)
    })
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('does not refetch when replacing fails', async () => {
    const list = vi.fn().mockResolvedValue([location()])
    const api = fakeApi({
      list,
      replaceServices: vi.fn().mockRejectedValue(new ApiError({ status: 403, code: 'FORBIDDEN' })),
    })

    const { result } = renderHook(() => useLocations(api, PROVIDER))
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await expect(
      result.current.replaceServices({ locationId: 'loc-1', serviceIds: [] }),
    ).rejects.toBeDefined()
    expect(list).toHaveBeenCalledTimes(1)
  })
})
