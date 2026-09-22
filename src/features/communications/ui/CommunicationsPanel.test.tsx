import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AppointmentsApi } from '../../agenda/application/appointmentsApi'
import type { PatientsApi } from '../../patients/application/patientsApi'
import { ApiError } from '../../../shared/api/problem'
import type { CommunicationsApi } from '../application/communicationsApi'
import { CommunicationsPanel } from './CommunicationsPanel'

const providerId = '11111111-1111-4111-8111-111111111111'
const appointment = {
  id: '22222222-2222-4222-8222-222222222222', locationId: 'location', patientId: '33333333-3333-4333-8333-333333333333', providerUserId: providerId,
  source: 'MANUAL' as const, reason: '', internalNotes: '', startsAt: '2026-10-01T10:00:00Z', endsAt: '2026-10-01T10:30:00Z', status: 'CONFIRMED' as const, cancellationReason: '', version: 4, services: [], identityStatus: '' as const,
}
const patient = { id: appointment.patientId, recordNumber: 7, firstName: 'Ana', middleName: '', lastName: 'Pérez', secondLastName: '', preferredName: '', birthDate: '', sexAtBirth: '' as const, phoneE164: '+525500000000', email: 'ana@example.test', occupation: '', status: 'ACTIVE' as const, notes: '', archivedAt: '', bookingBlocked: false, version: 2, createdAt: '', updatedAt: '' }
const template = { id: '44444444-4444-4444-8444-444444444444', code: 'CONFIRM', channel: 'WHATSAPP' as const, locale: 'es-MX', provider_template: null, body_template: 'Hola {{patient_name}}', is_active: true, version: 5, created_at: '', updated_at: '' }
const communication = { id: '55555555-5555-4555-8555-555555555555', patient_id: patient.id, appointment_id: appointment.id, channel: 'WHATSAPP' as const, status: 'QUEUED', safe_preview: '[redacted]', created_at: '2026-10-01T08:00:00Z' }

function api(overrides: Partial<CommunicationsApi> = {}): CommunicationsApi {
  return {
    list: vi.fn().mockResolvedValue({ items: [communication] }), get: vi.fn().mockResolvedValue(communication), events: vi.fn().mockResolvedValue({ items: [{ id: 'event-1', communication_id: communication.id, event_type: 'QUEUED', safe_metadata: {}, created_at: '2026-10-01T08:00:00Z' }] }), templates: vi.fn().mockResolvedValue({ items: [template] }), metrics: vi.fn().mockResolvedValue({ SENT: 3, RETRY: 1 }), queue: vi.fn().mockResolvedValue({ id: communication.id }), createTemplate: vi.fn().mockResolvedValue({ id: template.id }), updateTemplate: vi.fn().mockResolvedValue({ id: template.id }), ...overrides,
  }
}
function appointmentsApi(overrides: Partial<AppointmentsApi> = {}): AppointmentsApi {
  return { list: vi.fn().mockResolvedValue([appointment]), get: vi.fn().mockResolvedValue(appointment), history: vi.fn(), create: vi.fn(), transition: vi.fn(), reschedule: vi.fn(), listIdentityCandidates: vi.fn(), resolveIdentity: vi.fn(), listWaitlist: vi.fn(), createWaitlist: vi.fn(), updateWaitlistStatus: vi.fn(), ...overrides }
}
function patientsApi(overrides: Partial<PatientsApi> = {}): PatientsApi {
  return { list: vi.fn(), get: vi.fn().mockResolvedValue(patient), create: vi.fn(), update: vi.fn(), setBookingBlocked: vi.fn(), archive: vi.fn(), ...overrides }
}

async function selectAppointment(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('UUID del profesional'), providerId)
  await user.click(screen.getByRole('button', { name: 'Buscar citas' }))
  await user.selectOptions(await screen.findByLabelText('Cita'), appointment.id)
  await screen.findByText('Paciente: Ana Pérez')
}

describe('CommunicationsPanel', () => {
  it('requires an assistant-selected provider and queues only after explicit confirmation with refreshed authority', async () => {
    const client = api()
    const appointments = appointmentsApi()
    const patients = patientsApi()
    render(<CommunicationsPanel api={client} appointmentsApi={appointments} patientsApi={patients} role="ASSISTANT" />)
    const user = userEvent.setup()

    expect(appointments.list).not.toHaveBeenCalled()
    await selectAppointment(user)
    await user.selectOptions(screen.getByLabelText('Plantilla'), template.id)
    await user.click(screen.getByLabelText('Confirmo poner esta comunicación en cola.'))
    await user.click(screen.getByRole('button', { name: 'Poner en cola' }))

    expect(appointments.get).toHaveBeenCalledWith(appointment.id)
    expect(client.templates).toHaveBeenCalledTimes(2)
    expect(client.queue).toHaveBeenCalledWith(expect.objectContaining({ appointmentId: appointment.id, templateId: template.id, channel: 'WHATSAPP', expectedVersion: 4 }))
    expect(await screen.findByText('La comunicación quedó en cola. No indica que haya sido enviada.')).toBeInTheDocument()
  })

  it('retains a frozen attempt only for uncertain failures, while a confirmed conflict refreshes and blocks a stale retry', async () => {
    const uncertainQueue = vi.fn().mockRejectedValue(new Error('offline'))
    const uncertainClient = api({ queue: uncertainQueue })
    const uncertainView = render(<CommunicationsPanel api={uncertainClient} appointmentsApi={appointmentsApi()} patientsApi={patientsApi()} role="ASSISTANT" />)
    const user = userEvent.setup()

    await selectAppointment(user)
    await user.selectOptions(screen.getByLabelText('Plantilla'), template.id)
    await user.click(screen.getByLabelText('Confirmo poner esta comunicación en cola.'))
    await user.click(screen.getByRole('button', { name: 'Poner en cola' }))
    await user.click(screen.getByRole('button', { name: 'Poner en cola' }))
    expect(uncertainQueue.mock.calls[0][0]).toEqual(uncertainQueue.mock.calls[1][0])

    uncertainView.unmount()
    const conflict = new ApiError({ status: 412, code: 'PRECONDITION_FAILED' })
    const queue = vi.fn().mockRejectedValue(conflict)
    const client = api({ queue })
    render(<CommunicationsPanel api={client} appointmentsApi={appointmentsApi()} patientsApi={patientsApi()} role="ASSISTANT" />)
    await selectAppointment(user)
    await user.selectOptions(screen.getByLabelText('Plantilla'), template.id)
    await user.click(screen.getByLabelText('Confirmo poner esta comunicación en cola.'))
    await user.click(screen.getByRole('button', { name: 'Poner en cola' }))
    expect(await screen.findByText(/cambió mientras preparabas la cola/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Poner en cola' }))
    expect(queue).toHaveBeenCalledTimes(1)
  })

  it('loads communication detail and paginated events, exposes reported metrics without inventing a time range, and validates template variables', async () => {
    const client = api()
    render(<CommunicationsPanel api={client} appointmentsApi={appointmentsApi()} patientsApi={patientsApi()} role="OWNER_DENTIST" />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /^En cola ·/ }))
    expect(await screen.findByText('Detalle de comunicación')).toBeInTheDocument()
    expect(screen.getByText('Eventos')).toBeInTheDocument()
    expect(client.get).toHaveBeenCalledWith(communication.id)
    expect(client.events).toHaveBeenCalledWith(communication.id, expect.objectContaining({ limit: 25 }))
    expect(screen.getByText(/sin rango temporal informado/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Nueva plantilla' }))
    await user.type(screen.getByLabelText('Código de plantilla'), 'TEST')
    fireEvent.change(screen.getByLabelText('Cuerpo de plantilla'), { target: { value: 'Hola {{unknown}}' } })
    fireEvent.submit(screen.getByRole('heading', { name: 'Nueva plantilla' }).closest('form')!)
    expect(await screen.findByText(/solo se permiten/i)).toBeInTheDocument()
    expect(client.createTemplate).not.toHaveBeenCalled()
  })

  it('uses keyset cursors and deduplicates communication and event pages', async () => {
    const page = Array.from({ length: 25 }, (_, index) => ({ ...communication, id: `communication-${index}`, status: 'QUEUED' }))
    const eventPage = Array.from({ length: 25 }, (_, index) => ({ id: `event-${index}`, communication_id: page[0].id, event_type: 'QUEUED', safe_metadata: {}, created_at: communication.created_at }))
    const client = api({
      list: vi.fn().mockResolvedValueOnce({ items: page }).mockResolvedValueOnce({ items: [page[24], { ...communication, id: 'communication-next' }] }),
      get: vi.fn().mockResolvedValue(page[0]),
      events: vi.fn().mockResolvedValueOnce({ items: eventPage }).mockResolvedValueOnce({ items: [eventPage[24], { ...eventPage[0], id: 'event-next' }] }),
    })
    render(<CommunicationsPanel api={client} appointmentsApi={appointmentsApi()} patientsApi={patientsApi()} role="OWNER_DENTIST" />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Cargar más comunicaciones' }))
    expect(client.list).toHaveBeenLastCalledWith(expect.objectContaining({ afterId: page.at(-1)!.id, limit: 25 }))
    await user.click(screen.getAllByRole('button', { name: /^En cola · WHATSAPP/ })[0])
    await user.click(await screen.findByRole('button', { name: 'Cargar más eventos' }))
    expect(client.events).toHaveBeenLastCalledWith(page[0].id, expect.objectContaining({ afterId: eventPage.at(-1)!.id, limit: 25 }))
    expect(screen.getAllByText(/QUEUED/).length).toBeGreaterThan(1)
  })

  it('locks a timed-out queue to the actual frozen appointment, template, channel, and key', async () => {
    const queue = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({ id: communication.id })
    const client = api({ queue })
    render(<CommunicationsPanel api={client} appointmentsApi={appointmentsApi()} patientsApi={patientsApi()} role="ASSISTANT" />)
    const user = userEvent.setup()

    await selectAppointment(user)
    await user.selectOptions(screen.getByLabelText('Plantilla'), template.id)
    await user.click(screen.getByLabelText(/Confirmo poner esta comunicación en cola/i))
    await user.click(screen.getByRole('button', { name: 'Poner en cola' }))
    await screen.findByText('timeout')

    expect(screen.getByLabelText('Canal')).toBeDisabled()
    expect(screen.getByLabelText('Plantilla')).toBeDisabled()
    expect(screen.getByText(new RegExp(`Cita ${appointment.id}.*plantilla ${template.id}.*WHATSAPP`, 'i'))).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Poner en cola' }))
    await waitFor(() => expect(queue).toHaveBeenCalledTimes(2))
    expect(queue.mock.calls[1][0]).toEqual(queue.mock.calls[0][0])
  })

  it('locks a timed-out template body to its original request and idempotency key', async () => {
    const updateTemplate = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({ id: template.id })
    const client = api({ updateTemplate })
    render(<CommunicationsPanel api={client} appointmentsApi={appointmentsApi()} patientsApi={patientsApi()} role="OWNER_DENTIST" />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: template.code }))
    fireEvent.change(screen.getByLabelText('Cuerpo de plantilla'), { target: { value: 'Hola {{clinic_name}}' } })
    fireEvent.submit(screen.getByRole('heading', { name: 'Editar plantilla' }).closest('form')!)
    await screen.findByText(/No pudimos completar la comunicación/i)

    expect(screen.getByLabelText('Cuerpo de plantilla')).toBeDisabled()
    expect(screen.getByText(/cuerpo: Hola \{\{clinic_name\}\}/i)).toBeInTheDocument()
    fireEvent.submit(screen.getByRole('heading', { name: 'Editar plantilla' }).closest('form')!)
    await waitFor(() => expect(updateTemplate).toHaveBeenCalledTimes(2))
    expect(updateTemplate.mock.calls[1][0]).toEqual(updateTemplate.mock.calls[0][0])
  })

  it('loads the 101st raw template page on demand so it remains selectable and editable', async () => {
    const first = Array.from({ length: 100 }, (_, index) => ({ ...template, id: `template-${index + 1}`, code: `TEMPLATE-${index + 1}`, is_active: index === 99 }))
    const next = { ...template, id: 'template-101', code: 'TEMPLATE-101', is_active: true }
    const templates = vi.fn().mockImplementation(({ afterId }: { afterId?: string } = {}) => Promise.resolve({ items: afterId ? [next] : first }))
    const client = api({ templates })
    render(<CommunicationsPanel api={client} appointmentsApi={appointmentsApi()} patientsApi={patientsApi()} role="OWNER_DENTIST" />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Cargar más plantillas' }))
    expect(templates).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 100, afterId: 'template-100' }))
    expect(await screen.findByRole('option', { name: /TEMPLATE-101/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'TEMPLATE-101' }))
    expect(screen.getByRole('heading', { name: 'Editar plantilla' })).toBeInTheDocument()
  })

  it('clears a stale appointment whose refreshed patient or provider no longer matches before queueing', async () => {
    const changed = { ...appointment, patientId: 'different-patient', providerUserId: 'different-provider' }
    const client = api()
    const appointments = appointmentsApi({ get: vi.fn().mockResolvedValue(changed) })
    render(<CommunicationsPanel api={client} appointmentsApi={appointments} patientsApi={patientsApi()} role="ASSISTANT" />)
    const user = userEvent.setup()

    await selectAppointment(user)
    await user.selectOptions(screen.getByLabelText('Plantilla'), template.id)
    await user.click(screen.getByLabelText(/Confirmo poner esta comunicación en cola/i))
    await user.click(screen.getByRole('button', { name: 'Poner en cola' }))

    expect(await screen.findByText(/cita cambió de paciente o profesional/i)).toBeInTheDocument()
    expect(client.queue).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Cita')).toHaveValue('')
  })

  it('does not let an older first template page replace a newer refresh', async () => {
    let resolveOld!: (value: { items: typeof template[] }) => void
    const oldTemplates = new Promise<{ items: typeof template[] }>((resolve) => { resolveOld = resolve })
    const oldClient = api({ templates: vi.fn().mockReturnValue(oldTemplates) })
    const newTemplate = { ...template, id: 'new-template', code: 'NEW-TEMPLATE' }
    const newClient = api({ templates: vi.fn().mockResolvedValue({ items: [newTemplate] }) })
    const view = render(<CommunicationsPanel api={oldClient} appointmentsApi={appointmentsApi()} patientsApi={patientsApi()} role="OWNER_DENTIST" />)

    await waitFor(() => expect(oldClient.templates).toHaveBeenCalledTimes(1))
    view.rerender(<CommunicationsPanel api={newClient} appointmentsApi={appointmentsApi()} patientsApi={patientsApi()} role="OWNER_DENTIST" />)
    expect(await screen.findByRole('button', { name: 'NEW-TEMPLATE' })).toBeInTheDocument()
    await act(async () => resolveOld({ items: [template] }))

    expect(screen.queryByRole('button', { name: template.code })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'NEW-TEMPLATE' })).toBeInTheDocument()
  })

  it('does not append an old template page after a newer first-page refresh', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({ ...template, id: `template-${index + 1}`, code: `TEMPLATE-${index + 1}` }))
    let resolveAppend!: (value: { items: typeof template[] }) => void
    const oldAppend = new Promise<{ items: typeof template[] }>((resolve) => { resolveAppend = resolve })
    const oldClient = api({ templates: vi.fn().mockImplementation(({ afterId }: { afterId?: string } = {}) => afterId ? oldAppend : Promise.resolve({ items: firstPage })) })
    const refreshed = { ...template, id: 'refreshed-template', code: 'REFRESHED-TEMPLATE' }
    const newClient = api({ templates: vi.fn().mockResolvedValue({ items: [refreshed] }) })
    const view = render(<CommunicationsPanel api={oldClient} appointmentsApi={appointmentsApi()} patientsApi={patientsApi()} role="OWNER_DENTIST" />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Cargar más plantillas' }))
    view.rerender(<CommunicationsPanel api={newClient} appointmentsApi={appointmentsApi()} patientsApi={patientsApi()} role="OWNER_DENTIST" />)
    expect(await screen.findByRole('button', { name: 'REFRESHED-TEMPLATE' })).toBeInTheDocument()
    await act(async () => resolveAppend({ items: [{ ...template, id: 'old-append', code: 'OLD-APPEND' }] }))

    expect(screen.queryByRole('button', { name: 'OLD-APPEND' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'REFRESHED-TEMPLATE' })).toBeInTheDocument()
  })

  it('updates a selected template with its freshly listed version', async () => {
    const updateTemplate = vi.fn().mockResolvedValue({ id: template.id })
    const client = api({ updateTemplate })
    render(<CommunicationsPanel api={client} appointmentsApi={appointmentsApi()} patientsApi={patientsApi()} role="OWNER_DENTIST" />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: template.code }))
    fireEvent.change(screen.getByLabelText('Cuerpo de plantilla'), { target: { value: 'Hola {{clinic_name}}' } })
    fireEvent.submit(screen.getByRole('heading', { name: 'Editar plantilla' }).closest('form')!)

    expect(await screen.findByText('La plantilla se actualizó como una nueva versión.')).toBeInTheDocument()
    expect(updateTemplate).toHaveBeenCalledWith(expect.objectContaining({ id: template.id, expectedVersion: 5, bodyTemplate: 'Hola {{clinic_name}}' }))
  })
})
