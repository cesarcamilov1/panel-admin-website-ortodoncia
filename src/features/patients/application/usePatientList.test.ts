import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PatientsApi } from './patientsApi'
import { usePatientList } from './usePatientList'

function page(name: string) {
  return { items: [{ id: name, recordNumber: 1, firstName: name, lastName: 'Paciente', preferredName: '', phoneE164: '+525512345678', email: '', status: 'ACTIVE' as const, archived: false, bookingBlocked: false, version: 1 }], nextCursor: null }
}

describe('usePatientList', () => {
  it('debounces short searches and ignores an obsolete response after a new request', async () => {
    let resolveFirst: (value: ReturnType<typeof page>) => void = () => undefined
    const first = new Promise<ReturnType<typeof page>>((resolve) => { resolveFirst = resolve })
    const list = vi.fn()
      .mockResolvedValueOnce(page('Inicial'))
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce(page('Lucía'))
    const api: PatientsApi = { list, get: vi.fn(), create: vi.fn(), update: vi.fn(), setBookingBlocked: vi.fn(), archive: vi.fn() }
    const { result } = renderHook(() => usePatientList(api))

    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    act(() => result.current.setQuery('L'))
    await new Promise((resolve) => setTimeout(resolve, 350))
    expect(list).toHaveBeenCalledTimes(1)

    act(() => result.current.setQuery('Lu'))
    await new Promise((resolve) => setTimeout(resolve, 350))
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
    act(() => result.current.setQuery('Luc'))
    await new Promise((resolve) => setTimeout(resolve, 350))
    await waitFor(() => expect(list).toHaveBeenCalledTimes(3))
    resolveFirst(page('Obsoleto'))

    await waitFor(() => {
      if (result.current.state.status !== 'ready') throw new Error('not ready')
      expect(result.current.state.patients[0].firstName).toBe('Lucía')
    })
  })
})
