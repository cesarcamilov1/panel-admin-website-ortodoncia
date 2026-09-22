import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/problem'
import { RemindersPage } from './RemindersPage'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  appointmentsApi: { list: vi.fn(), get: vi.fn(), history: vi.fn(), create: vi.fn(), transition: vi.fn(), reschedule: vi.fn(), listIdentityCandidates: vi.fn(), resolveIdentity: vi.fn(), listWaitlist: vi.fn(), createWaitlist: vi.fn(), updateWaitlistStatus: vi.fn() },
  patientsApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), setBookingBlocked: vi.fn(), archive: vi.fn() },
}))
const { useAuth, http, appointmentsApi, patientsApi } = mocks

vi.mock('../../auth/application/authContext', () => ({ useAuth: mocks.useAuth }))
vi.mock('../../../shared/api/httpContext', () => ({ useHttpTransport: () => mocks.http }))
vi.mock('../../agenda/application/useAppointmentsApi', () => ({ useAppointmentsApi: () => mocks.appointmentsApi }))
vi.mock('../../patients/application/usePatientsApi', () => ({ usePatientsApi: () => mocks.patientsApi }))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => { resolve = next })
  return { promise, resolve }
}

function reminderDto(id: string, appointmentId = 'appointment-id') {
  return {
    id,
    appointment_id: appointmentId,
    patient_id: 'patient-id',
    channel: 'WHATSAPP',
    reminder_type: 'CUSTOM',
    scheduled_for: '2026-09-14T15:00:00Z',
    status: 'SCHEDULED',
    attempt_count: 0,
    next_attempt_at: null,
    communication_id: null,
    template_id: 'template-id',
    template_version: 2,
    appointment_version: 7,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  }
}

describe('RemindersPage communication access', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('ignores delayed appointment results after the patient selection changes', async () => {
    const appointments = deferred<Array<{ id: string; startsAt: string; status: 'PENDING' }>>()
    useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'owner-id', role: 'OWNER_DENTIST' } } })
    http.get.mockResolvedValue({ items: [] })
    patientsApi.list.mockResolvedValue({ items: [
      { id: 'patient-one', firstName: 'Ana', lastName: 'Uno', preferredName: '', recordNumber: 1 },
      { id: 'patient-two', firstName: 'Beto', lastName: 'Dos', preferredName: '', recordNumber: 2 },
    ] })
    appointmentsApi.list.mockReturnValue(appointments.promise)
    const user = userEvent.setup()

    render(<RemindersPage />)

    await user.selectOptions(await screen.findByLabelText('Paciente'), 'patient-one')
    await user.click(screen.getByRole('button', { name: 'Buscar citas' }))
    await waitFor(() => expect(appointmentsApi.list).toHaveBeenCalledTimes(1))
    await user.selectOptions(screen.getByLabelText('Paciente'), 'patient-two')
    await act(async () => {
      appointments.resolve([{ id: 'stale-appointment', startsAt: '2026-09-14T15:00:00Z', status: 'PENDING' }])
    })

    expect(screen.queryByRole('option', { name: /2026-09-14.*PENDING/ })).not.toBeInTheDocument()
  })

  it('uses one guarded cursor request and deduplicates a repeated reminder from the next page', async () => {
    const firstPage = Array.from({ length: 25 }, (_, index) => reminderDto(`reminder-${index}`))
    const nextPage = deferred<{ items: ReturnType<typeof reminderDto>[] }>()
    useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'owner-id', role: 'OWNER_DENTIST' } } })
    http.get.mockImplementation((path: string) => {
      if (path === '/api/v1/reminders?limit=25') return Promise.resolve({ items: firstPage })
      if (path === '/api/v1/reminders?limit=25&after_id=reminder-24') return nextPage.promise
      return Promise.resolve({ items: [] })
    })
    patientsApi.list.mockResolvedValue({ items: [] })
    const user = userEvent.setup()

    const { container } = render(<RemindersPage />)

    const loadMore = await screen.findByRole('button', { name: 'Cargar más recordatorios' })
    await user.click(loadMore)
    await user.click(loadMore)
    expect(http.get.mock.calls.filter(([path]) => path === '/api/v1/reminders?limit=25&after_id=reminder-24')).toHaveLength(1)

    await act(async () => {
      nextPage.resolve({ items: [reminderDto('reminder-24'), ...Array.from({ length: 24 }, (_, index) => reminderDto(`reminder-${index + 25}`))] })
    })

    expect(container.querySelectorAll('li')).toHaveLength(49)
  })

  it('retries an uncertain schedule with the frozen request body, version, and key', async () => {
    useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'owner-id', role: 'OWNER_DENTIST' } } })
    http.get.mockImplementation((path: string) => {
      if (path === '/api/v1/reminders?limit=25') return Promise.resolve({ items: [] })
      if (path === '/api/v1/communications/templates?limit=100') return Promise.resolve({ items: [{ id: 'template-id', code: 'REMINDER', channel: 'WHATSAPP', locale: 'es-MX', provider_template: null, body_template: 'Hola', is_active: true, version: 2, created_at: '', updated_at: '' }] })
      return Promise.resolve({ items: [] })
    })
    patientsApi.list.mockResolvedValue({ items: [{ id: 'patient-id', firstName: 'Ana', lastName: 'Uno', preferredName: '', recordNumber: 1 }] })
    appointmentsApi.list.mockResolvedValue([{ id: 'appointment-id', patientId: 'patient-id', providerUserId: 'owner-id', startsAt: '2026-09-14T15:00:00Z', status: 'PENDING' }])
    appointmentsApi.get.mockResolvedValue({ id: 'appointment-id', patientId: 'patient-id', providerUserId: 'owner-id', version: 7 })
    http.post.mockRejectedValueOnce(new Error('network interrupted')).mockResolvedValueOnce({ id: 'reminder-id' })
    const user = userEvent.setup()

    render(<RemindersPage />)

    await screen.findByRole('option', { name: /Ana Uno/ })
    await user.selectOptions(screen.getByLabelText('Paciente'), 'patient-id')
    await user.click(screen.getByRole('button', { name: 'Buscar citas' }))
    await user.selectOptions(await screen.findByLabelText('Cita'), 'appointment-id')
    await user.selectOptions(screen.getByLabelText('Plantilla activa'), 'template-id')
    fireEvent.change(screen.getByLabelText('Programado para'), { target: { value: '2026-09-14T10:00' } })
    await user.click(screen.getByLabelText('Confirmo poner este recordatorio en cola.'))
    await user.click(screen.getByRole('button', { name: 'Programar en cola' }))

    await waitFor(() => expect(http.post).toHaveBeenCalledTimes(1))
    expect(screen.getByLabelText('Programado para')).toBeDisabled()
    expect(screen.getByLabelText('Canal')).toBeDisabled()
    expect(screen.getByText(/cita appointment-id.*plantilla template-id.*WHATSAPP/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Programar en cola' }))
    await waitFor(() => expect(http.post).toHaveBeenCalledTimes(2))
    expect(http.post.mock.calls[1]).toEqual(http.post.mock.calls[0])
    expect(appointmentsApi.get).toHaveBeenCalledTimes(1)
  })

  it('loads the next raw template page so the 101st active template is selectable', async () => {
    const first = Array.from({ length: 100 }, (_, index) => ({ id: `template-${index + 1}`, code: `TEMPLATE-${index + 1}`, channel: 'WHATSAPP', locale: 'es-MX', provider_template: null, body_template: 'Hola', is_active: false, version: 2, created_at: '', updated_at: '' }))
    const next = { id: 'template-101', code: 'TEMPLATE-101', channel: 'WHATSAPP', locale: 'es-MX', provider_template: null, body_template: 'Hola', is_active: true, version: 2, created_at: '', updated_at: '' }
    useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'owner-id', role: 'OWNER_DENTIST' } } })
    http.get.mockImplementation((path: string) => {
      if (path === '/api/v1/reminders?limit=25') return Promise.resolve({ items: [] })
      if (path === '/api/v1/communications/templates?limit=100') return Promise.resolve({ items: first })
      if (path === '/api/v1/communications/templates?limit=100&after_id=template-100') return Promise.resolve({ items: [next] })
      return Promise.resolve({ items: [] })
    })
    patientsApi.list.mockResolvedValue({ items: [] })
    const user = userEvent.setup()

    render(<RemindersPage />)
    await user.click(await screen.findByRole('button', { name: 'Cargar más plantillas' }))
    expect(await screen.findByRole('option', { name: /TEMPLATE-101/ })).toBeInTheDocument()
    expect(http.get).toHaveBeenCalledWith('/api/v1/communications/templates?limit=100&after_id=template-100', undefined)
  })

  it('retains a conflict error and blocks stale scheduling when authoritative refresh fails', async () => {
    useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'owner-id', role: 'OWNER_DENTIST' } } })
    http.get.mockImplementation((path: string) => {
      if (path === '/api/v1/reminders?limit=25') return Promise.resolve({ items: [] })
      if (path === '/api/v1/communications/templates?limit=100') return Promise.resolve({ items: [{ id: 'template-id', code: 'REMINDER', channel: 'WHATSAPP', locale: 'es-MX', provider_template: null, body_template: 'Hola', is_active: true, version: 2, created_at: '', updated_at: '' }] })
      return Promise.resolve({ items: [] })
    })
    patientsApi.list.mockResolvedValue({ items: [{ id: 'patient-id', firstName: 'Ana', lastName: 'Uno', preferredName: '', recordNumber: 1 }] })
    appointmentsApi.list.mockResolvedValue([{ id: 'appointment-id', patientId: 'patient-id', providerUserId: 'owner-id', startsAt: '2026-09-14T15:00:00Z', status: 'PENDING' }])
    appointmentsApi.get.mockResolvedValueOnce({ id: 'appointment-id', patientId: 'patient-id', providerUserId: 'owner-id', version: 7 }).mockRejectedValueOnce(new Error('refresh unavailable'))
    http.post.mockRejectedValueOnce(new ApiError({ status: 412, code: 'PRECONDITION_FAILED' }))
    const user = userEvent.setup()

    render(<RemindersPage />)

    await screen.findByRole('option', { name: /Ana Uno/ })
    await user.selectOptions(screen.getByLabelText('Paciente'), 'patient-id')
    await user.click(screen.getByRole('button', { name: 'Buscar citas' }))
    await user.selectOptions(await screen.findByLabelText('Cita'), 'appointment-id')
    await user.selectOptions(screen.getByLabelText('Plantilla activa'), 'template-id')
    fireEvent.change(screen.getByLabelText('Programado para'), { target: { value: '2026-09-14T10:00' } })
    await user.click(screen.getByLabelText('Confirmo poner este recordatorio en cola.'))
    await user.click(screen.getByRole('button', { name: 'Programar en cola' }))

    expect(await screen.findByText(/la cita cambió en otra sesión/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Programar en cola' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Preparar una acción nueva' })).toBeInTheDocument()
    expect(http.post).toHaveBeenCalledTimes(1)
  })

  it('requires a refreshed authority and an explicit new schedule attempt after a confirmed conflict', async () => {
    useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'owner-id', role: 'OWNER_DENTIST' } } })
    http.get.mockImplementation((path: string) => {
      if (path === '/api/v1/reminders?limit=25') return Promise.resolve({ items: [] })
      if (path === '/api/v1/communications/templates?limit=100') return Promise.resolve({ items: [{ id: 'template-id', code: 'REMINDER', channel: 'WHATSAPP', locale: 'es-MX', provider_template: null, body_template: 'Hola', is_active: true, version: 2, created_at: '', updated_at: '' }] })
      return Promise.resolve({ items: [] })
    })
    patientsApi.list.mockResolvedValue({ items: [{ id: 'patient-id', firstName: 'Ana', lastName: 'Uno', preferredName: '', recordNumber: 1 }] })
    appointmentsApi.list.mockResolvedValue([{ id: 'appointment-id', patientId: 'patient-id', providerUserId: 'owner-id', startsAt: '2026-09-14T15:00:00Z', status: 'PENDING' }])
    appointmentsApi.get.mockResolvedValue({ id: 'appointment-id', patientId: 'patient-id', providerUserId: 'owner-id', version: 8 })
    http.post.mockRejectedValueOnce(new ApiError({ status: 412, code: 'PRECONDITION_FAILED' })).mockResolvedValueOnce({ id: 'reminder-id' })
    const user = userEvent.setup()

    render(<RemindersPage />)

    await screen.findByRole('option', { name: /Ana Uno/ })
    await user.selectOptions(screen.getByLabelText('Paciente'), 'patient-id')
    await user.click(screen.getByRole('button', { name: 'Buscar citas' }))
    await user.selectOptions(await screen.findByLabelText('Cita'), 'appointment-id')
    await user.selectOptions(screen.getByLabelText('Plantilla activa'), 'template-id')
    fireEvent.change(screen.getByLabelText('Programado para'), { target: { value: '2026-09-14T10:00' } })
    await user.click(screen.getByLabelText('Confirmo poner este recordatorio en cola.'))
    await user.click(screen.getByRole('button', { name: 'Programar en cola' }))

    expect(await screen.findByRole('button', { name: 'Preparar una acción nueva' })).toBeInTheDocument()
    expect(appointmentsApi.get).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('button', { name: 'Preparar una acción nueva' }))
    await user.click(screen.getByLabelText('Confirmo poner este recordatorio en cola.'))
    await user.click(screen.getByRole('button', { name: 'Programar en cola' }))

    await waitFor(() => expect(http.post).toHaveBeenCalledTimes(2))
    expect(http.post.mock.calls[1][2]).not.toEqual(http.post.mock.calls[0][2])
    expect(appointmentsApi.get).toHaveBeenCalledTimes(3)
  })

  it('fetches reminder detail and the detail appointment before one explicit cancellation', async () => {
    useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'owner-id', role: 'OWNER_DENTIST' } } })
    http.get.mockImplementation((path: string) => {
      if (path === '/api/v1/reminders?limit=25') return Promise.resolve({ items: [reminderDto('reminder-id', 'stale-appointment')] })
      if (path === '/api/v1/reminders/reminder-id') return Promise.resolve(reminderDto('reminder-id', 'current-appointment'))
      return Promise.resolve({ items: [] })
    })
    http.post.mockRejectedValueOnce(new Error('response lost')).mockResolvedValueOnce({ id: 'reminder-id' })
    patientsApi.list.mockResolvedValue({ items: [] })
    appointmentsApi.get.mockResolvedValue({ id: 'current-appointment', version: 12 })
    const user = userEvent.setup()

    render(<RemindersPage />)

    await user.click(await screen.findByRole('button', { name: 'Cancelar' }))
    await user.dblClick(screen.getByRole('button', { name: 'Confirmar cancelación' }))

    await waitFor(() => expect(http.post).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: 'Reintentar cancelación original' }))
    await waitFor(() => expect(http.post).toHaveBeenCalledTimes(2))
    expect(http.get).toHaveBeenCalledWith('/api/v1/reminders/reminder-id', undefined)
    expect(appointmentsApi.get).toHaveBeenCalledWith('current-appointment')
    expect(http.post).toHaveBeenCalledWith('/api/v1/reminders/reminder-id/cancel', { expected_version: 12 }, expect.objectContaining({ ifMatch: 12 }))
    expect(http.post.mock.calls[1]).toEqual(http.post.mock.calls[0])
  })

  it('keeps an unresolved original cancellation visible and replayable after its row disappears', async () => {
    const reminderA = reminderDto('reminder-a', 'appointment-a')
    const reminderB = reminderDto('reminder-b', 'appointment-b')
    let reminderPages = 0
    useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'owner-id', role: 'OWNER_DENTIST' } } })
    http.get.mockImplementation((path: string) => {
      if (path === '/api/v1/reminders?limit=25') return Promise.resolve({ items: reminderPages++ === 0 ? [reminderA] : [reminderB] })
      if (path === '/api/v1/reminders/reminder-a') return Promise.resolve(reminderA)
      return Promise.resolve({ items: [] })
    })
    http.post.mockRejectedValueOnce(new Error('response lost')).mockResolvedValueOnce({ id: 'reminder-a' })
    patientsApi.list.mockResolvedValue({ items: [] })
    appointmentsApi.get.mockResolvedValue({ id: 'appointment-a', version: 12 })
    const user = userEvent.setup()

    render(<RemindersPage />)
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar cancelación' }))

    expect(await screen.findByText(/cancelación original pendiente/i)).toBeInTheDocument()
    expect(await screen.findByText(/recordatorio reminder-a.*cita appointment-a.*versión 12/i)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Cancelar/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('heading', { name: 'Confirmar cancelación' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reintentar cancelación original' }))
    await waitFor(() => expect(http.post).toHaveBeenCalledTimes(2))
    expect(http.post.mock.calls[1]).toEqual(http.post.mock.calls[0])
    expect(screen.queryByText(/cancelación original pendiente/i)).not.toBeInTheDocument()
  })

  it.each([
    ['patientId', undefined],
    ['patientId', ''],
    ['providerUserId', undefined],
    ['providerUserId', ''],
  ])('rejects a fresh appointment with missing or empty %s before scheduling', async (field, value) => {
    useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'owner-id', role: 'OWNER_DENTIST' } } })
    http.get.mockImplementation((path: string) => {
      if (path === '/api/v1/reminders?limit=25') return Promise.resolve({ items: [] })
      if (path === '/api/v1/communications/templates?limit=100') return Promise.resolve({ items: [{ id: 'template-id', code: 'REMINDER', channel: 'WHATSAPP', locale: 'es-MX', provider_template: null, body_template: 'Hola', is_active: true, version: 2, created_at: '', updated_at: '' }] })
      return Promise.resolve({ items: [] })
    })
    patientsApi.list.mockResolvedValue({ items: [{ id: 'patient-id', firstName: 'Ana', lastName: 'Uno', preferredName: '', recordNumber: 1 }] })
    appointmentsApi.list.mockResolvedValue([{ id: 'appointment-id', patientId: 'patient-id', providerUserId: 'owner-id', startsAt: '2026-09-14T15:00:00Z', status: 'PENDING' }])
    appointmentsApi.get.mockResolvedValue({ id: 'appointment-id', patientId: 'patient-id', providerUserId: 'owner-id', version: 7, [field]: value } as any)
    const user = userEvent.setup()

    render(<RemindersPage />)
    await user.selectOptions(await screen.findByLabelText('Paciente'), 'patient-id')
    await user.click(screen.getByRole('button', { name: 'Buscar citas' }))
    await user.selectOptions(await screen.findByLabelText('Cita'), 'appointment-id')
    await user.selectOptions(screen.getByLabelText('Plantilla activa'), 'template-id')
    fireEvent.change(screen.getByLabelText('Programado para'), { target: { value: '2026-09-14T10:00' } })
    await user.click(screen.getByLabelText('Confirmo poner este recordatorio en cola.'))
    await user.click(screen.getByRole('button', { name: 'Programar en cola' }))

    expect(await screen.findByText(/cita cambió de paciente o profesional/i)).toBeInTheDocument()
    expect(http.post).not.toHaveBeenCalled()
  })

  it('refreshes and clears a selected appointment when its patient or provider binding changed before scheduling', async () => {
    useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'owner-id', role: 'OWNER_DENTIST' } } })
    http.get.mockImplementation((path: string) => {
      if (path === '/api/v1/reminders?limit=25') return Promise.resolve({ items: [] })
      if (path === '/api/v1/communications/templates?limit=100') return Promise.resolve({ items: [{ id: 'template-id', code: 'REMINDER', channel: 'WHATSAPP', locale: 'es-MX', provider_template: null, body_template: 'Hola', is_active: true, version: 2, created_at: '', updated_at: '' }] })
      return Promise.resolve({ items: [] })
    })
    patientsApi.list.mockResolvedValue({ items: [{ id: 'patient-id', firstName: 'Ana', lastName: 'Uno', preferredName: '', recordNumber: 1 }] })
    appointmentsApi.list.mockResolvedValue([{ id: 'appointment-id', patientId: 'patient-id', providerUserId: 'owner-id', startsAt: '2026-09-14T15:00:00Z', status: 'PENDING' }])
    appointmentsApi.get.mockResolvedValue({ id: 'appointment-id', patientId: 'other-patient', providerUserId: 'other-provider', version: 7 })
    const user = userEvent.setup()

    render(<RemindersPage />)
    await screen.findByRole('option', { name: /Ana Uno/ })
    await user.selectOptions(screen.getByLabelText('Paciente'), 'patient-id')
    await user.click(screen.getByRole('button', { name: 'Buscar citas' }))
    await user.selectOptions(await screen.findByLabelText('Cita'), 'appointment-id')
    await user.selectOptions(screen.getByLabelText('Plantilla activa'), 'template-id')
    fireEvent.change(screen.getByLabelText('Programado para'), { target: { value: '2026-09-14T10:00' } })
    await user.click(screen.getByLabelText('Confirmo poner este recordatorio en cola.'))
    await user.click(screen.getByRole('button', { name: 'Programar en cola' }))

    expect(await screen.findByText(/cita cambió de paciente o profesional/i)).toBeInTheDocument()
    expect(http.post).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Cita')).toHaveValue('')
  })

  it('does not make reminder or communication requests for the denied billing role', () => {
    useAuth.mockReturnValue({ state: { status: 'authenticated', user: { role: 'BILLING' } } })
    render(<RemindersPage />)
    expect(screen.getByText('Tu rol no tiene acceso a comunicaciones.')).toBeInTheDocument()
    expect(http.get).not.toHaveBeenCalled()
    expect(http.post).not.toHaveBeenCalled()
  })

  it('keeps reminders available under their own tab and exposes the communications subview', async () => {
    useAuth.mockReturnValue({ state: { status: 'authenticated', user: { role: 'OWNER_DENTIST' } } })
    http.get.mockResolvedValue({ items: [] })
    appointmentsApi.list.mockResolvedValue([])
    patientsApi.list.mockResolvedValue({ items: [] })
    render(<RemindersPage />)
    expect(await screen.findByRole('tab', { name: 'Recordatorios' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Comunicaciones' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Plantillas' })).toBeInTheDocument()
  })
})
