import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/problem'
import type { CatalogService, ServiceDraft } from '../domain/service'
import type { ServicesApi } from './servicesApi'
import { useServiceCatalog } from './useServiceCatalog'

function service(overrides: Partial<CatalogService> = {}): CatalogService {
  return {
    id: 'svc-1',
    code: 'LIMP-01',
    name: 'Limpieza dental',
    description: '',
    durationMinutes: 45,
    defaultPrice: '850.00',
    currency: 'MXN',
    isActive: true,
    createdAt: '2026-01-10T15:00:00Z',
    updatedAt: '2026-02-11T09:30:00Z',
    version: 3,
    ...overrides,
  }
}

const draft: ServiceDraft = {
  code: 'ORTO-01',
  name: 'Ortodoncia ajuste',
  description: '',
  durationMinutes: 30,
  defaultPrice: '600.00',
  isActive: true,
}

function fakeApi(overrides: Partial<ServicesApi> = {}): ServicesApi {
  return {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    putFiscalConfig: vi.fn(),
    listLocationServices: vi.fn(),
    replaceLocationServices: vi.fn(),
    listPublicLocationServices: vi.fn(),
    ...overrides,
  }
}

describe('useServiceCatalog boot', () => {
  it('starts loading and asks for the whole catalog, paused ones included', async () => {
    const api = fakeApi({ list: vi.fn().mockResolvedValue([service()]) })
    const { result } = renderHook(() => useServiceCatalog(api))

    expect(result.current.state.status).toBe('loading')
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    expect(api.list).toHaveBeenCalledWith({ includeInactive: true })
  })

  it('exposes a readable message when the catalog cannot be loaded', async () => {
    const api = fakeApi({
      list: vi.fn().mockRejectedValue(new ApiError({ status: 403, code: 'FORBIDDEN' })),
    })
    const { result } = renderHook(() => useServiceCatalog(api))

    await waitFor(() => expect(result.current.state.status).toBe('error'))
    if (result.current.state.status !== 'error') throw new Error('expected error state')
    expect(result.current.state.message).toMatch(/permiso/i)
  })

  it('keeps the catalog sorted by code', async () => {
    const api = fakeApi({
      list: vi.fn().mockResolvedValue([
        service({ id: 'b', code: 'ZZZ-01' }),
        service({ id: 'a', code: 'AAA-01' }),
      ]),
    })
    const { result } = renderHook(() => useServiceCatalog(api))

    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    if (result.current.state.status !== 'ready') throw new Error('expected ready state')
    expect(result.current.state.services.map((item) => item.code)).toEqual(['AAA-01', 'ZZZ-01'])
  })
})

describe('useServiceCatalog create', () => {
  it('adds the created service without refetching the whole list', async () => {
    const created = service({ id: 'svc-2', code: 'ORTO-01', name: 'Ortodoncia ajuste' })
    const list = vi.fn().mockResolvedValue([service()])
    const api = fakeApi({ list, create: vi.fn().mockResolvedValue(created) })

    const { result } = renderHook(() => useServiceCatalog(api))
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await act(async () => {
      await result.current.create(draft)
    })

    if (result.current.state.status !== 'ready') throw new Error('expected ready state')
    expect(result.current.state.services.map((item) => item.code)).toEqual(['LIMP-01', 'ORTO-01'])
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('rethrows so the form can show the failure', async () => {
    const failure = new ApiError({ status: 400, code: 'VALIDATION_ERROR' })
    const api = fakeApi({ list: vi.fn().mockResolvedValue([]), create: vi.fn().mockRejectedValue(failure) })

    const { result } = renderHook(() => useServiceCatalog(api))
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await expect(result.current.create(draft)).rejects.toBe(failure)
  })
})

describe('useServiceCatalog update', () => {
  it('replaces the updated service in place with its new version', async () => {
    const updated = service({ name: 'Limpieza profunda', version: 4 })
    const api = fakeApi({
      list: vi.fn().mockResolvedValue([service()]),
      update: vi.fn().mockResolvedValue(updated),
    })

    const { result } = renderHook(() => useServiceCatalog(api))
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await act(async () => {
      await result.current.update({ id: 'svc-1', draft, version: 3 })
    })

    if (result.current.state.status !== 'ready') throw new Error('expected ready state')
    expect(result.current.state.services).toHaveLength(1)
    expect(result.current.state.services[0].name).toBe('Limpieza profunda')
    expect(result.current.state.services[0].version).toBe(4)
  })

  it('refetches on a stale-version conflict so the user sees current versions', async () => {
    const conflict = new ApiError({ status: 412, code: 'PRECONDITION_FAILED' })
    const list = vi
      .fn()
      .mockResolvedValueOnce([service({ version: 3 })])
      .mockResolvedValueOnce([service({ version: 9 })])
    const api = fakeApi({ list, update: vi.fn().mockRejectedValue(conflict) })

    const { result } = renderHook(() => useServiceCatalog(api))
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    // Not wrapped in act(): a rejecting act() leaves the queued reload unflushed.
    await expect(result.current.update({ id: 'svc-1', draft, version: 3 })).rejects.toBe(conflict)

    await waitFor(() => {
      if (result.current.state.status !== 'ready') throw new Error('not ready')
      expect(result.current.state.services[0].version).toBe(9)
    })
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('does not refetch on an ordinary validation failure', async () => {
    const list = vi.fn().mockResolvedValue([service()])
    const api = fakeApi({
      list,
      update: vi.fn().mockRejectedValue(new ApiError({ status: 400, code: 'VALIDATION_ERROR' })),
    })

    const { result } = renderHook(() => useServiceCatalog(api))
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await expect(result.current.update({ id: 'svc-1', draft, version: 3 })).rejects.toBeDefined()
    expect(list).toHaveBeenCalledTimes(1)
  })
})

describe('useServiceCatalog setActive', () => {
  it('flips only the active flag and reuses every other current value', async () => {
    const current = service({ description: 'Profilaxis', version: 5 })
    const update = vi.fn().mockResolvedValue({ ...current, isActive: false, version: 6 })
    const api = fakeApi({ list: vi.fn().mockResolvedValue([current]), update })

    const { result } = renderHook(() => useServiceCatalog(api))
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await act(async () => {
      await result.current.setActive(current, false)
    })

    expect(update).toHaveBeenCalledWith({
      id: 'svc-1',
      version: 5,
      draft: {
        code: 'LIMP-01',
        name: 'Limpieza dental',
        description: 'Profilaxis',
        durationMinutes: 45,
        defaultPrice: '850.00',
        isActive: false,
      },
    })
    if (result.current.state.status !== 'ready') throw new Error('expected ready state')
    expect(result.current.state.services[0].isActive).toBe(false)
  })
})

describe('useServiceCatalog saveFiscalConfig', () => {
  it('delegates to the fiscal endpoint and leaves the catalog untouched', async () => {
    const putFiscalConfig = vi.fn().mockResolvedValue({ serviceId: 'svc-1', version: 1 })
    const list = vi.fn().mockResolvedValue([service()])
    const api = fakeApi({ list, putFiscalConfig })

    const { result } = renderHook(() => useServiceCatalog(api))
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    const fiscalDraft = {
      satProductServiceCode: '86121600',
      satUnitCode: 'E48',
      satTaxObjectCode: '02',
      defaultInvoiceDescription: '',
      validFrom: '2026-01-01',
      validTo: '',
      taxRules: [],
    }

    await act(async () => {
      await result.current.saveFiscalConfig({ serviceId: 'svc-1', draft: fiscalDraft })
    })

    expect(putFiscalConfig).toHaveBeenCalledWith({ serviceId: 'svc-1', draft: fiscalDraft })
    expect(list).toHaveBeenCalledTimes(1)
  })
})
