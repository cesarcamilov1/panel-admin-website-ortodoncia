import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { HttpTransport } from '../../../../shared/api/http'
import { HttpContext } from '../../../../shared/api/httpContext'
import { ApiError } from '../../../../shared/api/problem'
import type { Appointment } from '../../domain/appointment'
import { AppointmentDrawer } from './AppointmentDrawer'

const ID = '11111111-1111-4111-8111-111111111111'
const baseAppointment: Appointment = {
  id: ID, locationId: '', patientId: '22222222-2222-4222-8222-222222222222', providerUserId: '33333333-3333-4333-8333-333333333333',
  source: 'MANUAL', reason: '', internalNotes: '', startsAt: '2026-09-14T15:00:00Z', endsAt: '2026-09-14T15:30:00Z',
  status: 'PENDING', cancellationReason: '', version: 3, services: [], identityStatus: '',
}
const currentDto = { id: ID, patient_id: baseAppointment.patientId, provider_user_id: baseAppointment.providerUserId, source: 'MANUAL', starts_at: baseAppointment.startsAt, ends_at: baseAppointment.endsAt, status: 'PENDING', version: 9, services: [] }

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => { resolve = next })
  return { promise, resolve }
}

function renderDrawer(http: HttpTransport, onChanged = vi.fn(), appointment = baseAppointment) {
  return { onChanged, ...render(<MemoryRouter><HttpContext value={http}><AppointmentDrawer appointment={appointment} onClose={vi.fn()} onChanged={onChanged} /></HttpContext></MemoryRouter>) }
}

describe('<AppointmentDrawer />', () => {
  it('uses the authoritative detail version for a successful transition', async () => {
    const get = vi.fn((path: string) => path.endsWith('/history') ? Promise.resolve({ items: [] }) : Promise.resolve(currentDto))
    const post = vi.fn().mockResolvedValue({ ...currentDto, status: 'CONFIRMED', version: 10 })
    const http = { get, post, put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn() } as unknown as HttpTransport
    const user = userEvent.setup()
    const onChanged = vi.fn()
    renderDrawer(http, onChanged)

    const confirm = await screen.findByRole('button', { name: 'Confirmar' })
    await waitFor(() => expect(confirm).toBeEnabled())
    await user.click(confirm)

    await waitFor(() => expect(post).toHaveBeenCalledWith(`/api/v1/appointments/${ID}/transition`, { status: 'CONFIRMED', reason: '' }, { ifMatch: 9 }))
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('hides rescheduling for terminal appointments', async () => {
    const get = vi.fn((path: string) => path.endsWith('/history') ? Promise.resolve({ items: [] }) : Promise.resolve({ ...currentDto, status: 'COMPLETED' }))
    const http = { get, post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn() } as unknown as HttpTransport

    renderDrawer(http, vi.fn(), { ...baseAppointment, status: 'COMPLETED' })

    await screen.findByLabelText('Detalle de la cita')
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Reagendar' })).not.toBeInTheDocument())
  })

  it('keeps all mutations disabled until the authoritative terminal detail replaces a stale supplied appointment', async () => {
    const detail = deferred<typeof currentDto>()
    const get = vi.fn((path: string) => path.endsWith('/history') ? Promise.resolve({ items: [] }) : detail.promise)
    const http = { get, post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn() } as unknown as HttpTransport

    renderDrawer(http)

    expect(await screen.findByRole('button', { name: 'Confirmar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reagendar' })).toBeDisabled()
    detail.resolve({ ...currentDto, status: 'COMPLETED' })

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Reagendar' })).not.toBeInTheDocument()
  })

  it('keeps mutations disabled while a conflict refresh is unresolved and removes stale actions after its terminal snapshot', async () => {
    const conflictRefresh = deferred<typeof currentDto>()
    let detailRequests = 0
    const get = vi.fn((path: string) => {
      if (path.endsWith('/history')) return Promise.resolve({ items: [] })
      detailRequests += 1
      return detailRequests === 1 ? Promise.resolve(currentDto) : conflictRefresh.promise
    })
    const post = vi.fn().mockRejectedValue(new ApiError({ status: 412, code: 'PRECONDITION_FAILED' }))
    const http = { get, post, put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn() } as unknown as HttpTransport
    const user = userEvent.setup()
    renderDrawer(http)

    const confirm = await screen.findByRole('button', { name: 'Confirmar' })
    await waitFor(() => expect(confirm).toBeEnabled())
    await user.click(confirm)

    expect(await screen.findByText(/la cita cambió en otra sesión/i)).toBeInTheDocument()
    await waitFor(() => expect(get.mock.calls.filter(([path]) => path === `/api/v1/appointments/${ID}`).length).toBe(2))
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reagendar' })).toBeDisabled()
    conflictRefresh.resolve({ ...currentDto, status: 'COMPLETED', version: 10 })

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Reagendar' })).not.toBeInTheDocument()
  })

  it('does not re-enable mutations after an authoritative detail request fails', async () => {
    const get = vi.fn((path: string) => path.endsWith('/history') ? Promise.resolve({ items: [] }) : Promise.reject(new Error('detail unavailable')))
    const http = { get, post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn() } as unknown as HttpTransport

    renderDrawer(http)

    expect(await screen.findByText(/algo salió mal/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reagendar' })).toBeDisabled()
  })

  it('keeps the drawer open, retains the error, and reloads after a version conflict', async () => {
    const get = vi.fn((path: string) => path.endsWith('/history') ? Promise.resolve({ items: [] }) : Promise.resolve(currentDto))
    const post = vi.fn().mockRejectedValue(new ApiError({ status: 412, code: 'PRECONDITION_FAILED' }))
    const http = { get, post, put: vi.fn(), patch: vi.fn(), del: vi.fn(), upload: vi.fn(), download: vi.fn() } as unknown as HttpTransport
    const user = userEvent.setup()
    const onChanged = vi.fn()
    renderDrawer(http, onChanged)

    const confirm = await screen.findByRole('button', { name: 'Confirmar' })
    await waitFor(() => expect(confirm).toBeEnabled())
    await user.click(confirm)

    expect(await screen.findByText(/la cita cambió en otra sesión/i)).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Detalle de la cita' })).toBeInTheDocument()
    expect(onChanged).not.toHaveBeenCalled()
    await waitFor(() => expect(get.mock.calls.filter(([path]) => path === `/api/v1/appointments/${ID}`).length).toBe(2))
  })
})
