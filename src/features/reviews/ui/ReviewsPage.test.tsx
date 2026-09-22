import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReviewsPage } from './ReviewsPage'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  http: { get: vi.fn(), post: vi.fn() },
  appointmentsApi: { list: vi.fn(), get: vi.fn() },
  patientsApi: { list: vi.fn(), get: vi.fn() },
}))

vi.mock('../../auth/application/authContext', () => ({ useAuth: mocks.useAuth }))
vi.mock('../../../shared/api/httpContext', () => ({ useHttpTransport: () => mocks.http }))
vi.mock('../../agenda/application/useAppointmentsApi', () => ({ useAppointmentsApi: () => mocks.appointmentsApi }))
vi.mock('../../patients/application/usePatientsApi', () => ({ usePatientsApi: () => mocks.patientsApi }))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => { resolve = next })
  return { promise, resolve }
}

function reviewDto(id: string) {
  return { id, patient_id: 'patient-id', appointment_id: 'appointment-id', rating: 4, comment: null, google_review_requested: false, created_at: '2026-09-01T00:00:00Z' }
}

describe('ReviewsPage', () => {
  beforeEach(() => { vi.resetAllMocks() })
  it('ignores delayed appointment results after the provider changes', async () => {
    const appointments = deferred<Array<{ id: string; startsAt: string; status: 'COMPLETED' }>>()
    mocks.useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'owner-id', role: 'OWNER_DENTIST' } } })
    mocks.http.get.mockResolvedValue({ items: [] })
    mocks.patientsApi.list.mockResolvedValue({ items: [{ id: 'patient-id', firstName: 'Ana', lastName: 'Uno', preferredName: '', recordNumber: 1 }] })
    mocks.appointmentsApi.list.mockReturnValue(appointments.promise)
    const user = userEvent.setup()

    render(<ReviewsPage />)

    await user.selectOptions(await screen.findByLabelText('Paciente'), 'patient-id')
    await user.click(screen.getByRole('button', { name: 'Buscar citas' }))
    await waitFor(() => expect(mocks.appointmentsApi.list).toHaveBeenCalledTimes(1))
    await user.clear(screen.getByLabelText('Profesional para buscar citas'))
    await user.type(screen.getByLabelText('Profesional para buscar citas'), 'provider-two')
    await act(async () => {
      appointments.resolve([{ id: 'stale-appointment', startsAt: '2026-09-14T15:00:00Z', status: 'COMPLETED' }])
    })

    expect(screen.queryByRole('option', { name: /2026-09-14.*COMPLETED/ })).not.toBeInTheDocument()
  })

  it('keeps one latest cursor lifecycle and removes duplicate review rows', async () => {
    const firstPage = Array.from({ length: 25 }, (_, index) => reviewDto(`review-${index}`))
    const nextPage = deferred<{ items: ReturnType<typeof reviewDto>[] }>()
    mocks.useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'owner-id', role: 'OWNER_DENTIST' } } })
    mocks.http.get.mockImplementation((path: string) => {
      if (path === '/api/v1/reviews?limit=25') return Promise.resolve({ items: firstPage })
      if (path === '/api/v1/reviews?limit=25&after_id=review-24') return nextPage.promise
      return Promise.resolve({ items: [] })
    })
    mocks.patientsApi.list.mockResolvedValue({ items: [] })
    const user = userEvent.setup()

    const { container } = render(<ReviewsPage />)

    const loadMore = await screen.findByRole('button', { name: 'Cargar más reseñas' })
    await act(async () => {})
    expect(mocks.http.get.mock.calls.filter(([path]) => path === '/api/v1/reviews?limit=25')).toHaveLength(1)
    await user.click(loadMore)
    await user.click(loadMore)
    expect(mocks.http.get.mock.calls.filter(([path]) => path === '/api/v1/reviews?limit=25&after_id=review-24')).toHaveLength(1)
    await act(async () => {
      nextPage.resolve({ items: [reviewDto('review-24'), ...Array.from({ length: 24 }, (_, index) => reviewDto(`review-${index + 25}`))] })
    })

    expect(container.querySelectorAll('li')).toHaveLength(49)
  })

  it('allows a selected past completed visit and does not resubmit an acknowledged review when reload fails', async () => {
    mocks.useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'owner-id', role: 'OWNER_DENTIST' } } })
    let reviewLoads = 0
    mocks.http.get.mockImplementation((path: string) => {
      if (path === '/api/v1/reviews?limit=25') {
        reviewLoads += 1
        return reviewLoads === 1 ? Promise.resolve({ items: [] }) : Promise.reject(new Error('reload unavailable'))
      }
      return Promise.resolve({ items: [] })
    })
    mocks.patientsApi.list.mockResolvedValue({ items: [{ id: 'patient-id', firstName: 'Ana', lastName: 'Uno', preferredName: '', recordNumber: 1 }] })
    mocks.appointmentsApi.list.mockResolvedValue([{ id: 'appointment-id', patientId: 'patient-id', providerUserId: 'owner-id', startsAt: '2020-01-01T10:00:00Z', status: 'COMPLETED' }])
    mocks.appointmentsApi.get.mockResolvedValue({ id: 'appointment-id', patientId: 'patient-id', providerUserId: 'owner-id' })
    mocks.http.post.mockResolvedValue({ id: 'review-id' })
    const user = userEvent.setup()

    render(<ReviewsPage />)

    await user.selectOptions(await screen.findByLabelText('Paciente'), 'patient-id')
    await user.click(screen.getByRole('button', { name: 'Buscar citas' }))
    await user.selectOptions(await screen.findByLabelText('Cita'), 'appointment-id')
    await user.selectOptions(screen.getByLabelText('Calificación'), '4')
    await user.click(screen.getByRole('button', { name: 'Guardar reseña privada' }))

    expect(await screen.findByText('La reseña privada se guardó. Esta pantalla no solicita ni publica reseñas públicas.')).toBeInTheDocument()
    expect(await screen.findByText(/se guardó, pero no pudimos actualizar la lista/i)).toBeInTheDocument()
    expect(mocks.http.post).toHaveBeenCalledTimes(1)
    expect(mocks.http.post).toHaveBeenCalledWith('/api/v1/reviews', expect.objectContaining({ appointment_id: 'appointment-id', rating: 4 }), expect.any(Object))
  })

  it('locks a timed-out review to its original visible payload and replays the same key', async () => {
    mocks.useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'owner-id', role: 'OWNER_DENTIST' } } })
    mocks.http.get.mockResolvedValue({ items: [] })
    mocks.patientsApi.list.mockResolvedValue({ items: [{ id: 'patient-id', firstName: 'Ana', lastName: 'Uno', preferredName: '', recordNumber: 1 }] })
    mocks.appointmentsApi.list.mockResolvedValue([{ id: 'appointment-id', patientId: 'patient-id', providerUserId: 'owner-id', startsAt: '2020-01-01T10:00:00Z', status: 'COMPLETED' }])
    mocks.appointmentsApi.get.mockResolvedValue({ id: 'appointment-id', patientId: 'patient-id', providerUserId: 'owner-id' })
    mocks.http.post.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({ id: 'review-id' })
    const user = userEvent.setup()

    render(<ReviewsPage />)
    await user.selectOptions(await screen.findByLabelText('Paciente'), 'patient-id')
    await user.click(screen.getByRole('button', { name: 'Buscar citas' }))
    await user.selectOptions(await screen.findByLabelText('Cita'), 'appointment-id')
    await user.selectOptions(screen.getByLabelText('Calificación'), '4')
    await user.type(screen.getByLabelText('Comentario opcional'), 'original')
    await user.click(screen.getByRole('button', { name: 'Guardar reseña privada' }))
    await screen.findByText('timeout')

    expect(screen.getByLabelText('Calificación')).toBeDisabled()
    expect(screen.getByLabelText('Comentario opcional')).toBeDisabled()
    expect(screen.getByText(/cita appointment-id.*calificación 4.*original/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar reseña privada' }))
    await waitFor(() => expect(mocks.http.post).toHaveBeenCalledTimes(2))
    expect(mocks.http.post.mock.calls[1]).toEqual(mocks.http.post.mock.calls[0])
  })

  it.each([
    ['patientId', undefined],
    ['patientId', ''],
    ['providerUserId', undefined],
    ['providerUserId', ''],
  ])('rejects a fresh appointment with missing or empty %s before creating a review', async (field, value) => {
    mocks.useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'owner-id', role: 'OWNER_DENTIST' } } })
    mocks.http.get.mockResolvedValue({ items: [] })
    mocks.patientsApi.list.mockResolvedValue({ items: [{ id: 'patient-id', firstName: 'Ana', lastName: 'Uno', preferredName: '', recordNumber: 1 }] })
    mocks.appointmentsApi.list.mockResolvedValue([{ id: 'appointment-id', patientId: 'patient-id', providerUserId: 'owner-id', startsAt: '2020-01-01T10:00:00Z', status: 'COMPLETED' }])
    mocks.appointmentsApi.get.mockResolvedValue({ id: 'appointment-id', patientId: 'patient-id', providerUserId: 'owner-id', [field]: value } as any)
    const user = userEvent.setup()

    render(<ReviewsPage />)
    await user.selectOptions(await screen.findByLabelText('Paciente'), 'patient-id')
    await user.click(screen.getByRole('button', { name: 'Buscar citas' }))
    await user.selectOptions(await screen.findByLabelText('Cita'), 'appointment-id')
    await user.selectOptions(screen.getByLabelText('Calificación'), '4')
    await user.click(screen.getByRole('button', { name: 'Guardar reseña privada' }))

    expect(await screen.findByText(/cita cambió de paciente o profesional/i)).toBeInTheDocument()
    expect(mocks.http.post).not.toHaveBeenCalled()
  })

  it('clears and refreshes a stale appointment whose patient or provider changed before creating a review', async () => {
    mocks.useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'owner-id', role: 'OWNER_DENTIST' } } })
    mocks.http.get.mockResolvedValue({ items: [] })
    mocks.patientsApi.list.mockResolvedValue({ items: [{ id: 'patient-id', firstName: 'Ana', lastName: 'Uno', preferredName: '', recordNumber: 1 }] })
    mocks.appointmentsApi.list.mockResolvedValue([{ id: 'appointment-id', patientId: 'patient-id', providerUserId: 'owner-id', startsAt: '2020-01-01T10:00:00Z', status: 'COMPLETED' }])
    mocks.appointmentsApi.get.mockResolvedValue({ id: 'appointment-id', patientId: 'other-patient', providerUserId: 'other-provider' })
    const user = userEvent.setup()

    render(<ReviewsPage />)
    await user.selectOptions(await screen.findByLabelText('Paciente'), 'patient-id')
    await user.click(screen.getByRole('button', { name: 'Buscar citas' }))
    await user.selectOptions(await screen.findByLabelText('Cita'), 'appointment-id')
    await user.selectOptions(screen.getByLabelText('Calificación'), '4')
    await user.click(screen.getByRole('button', { name: 'Guardar reseña privada' }))

    expect(await screen.findByText(/cita cambió de paciente o profesional/i)).toBeInTheDocument()
    expect(mocks.http.post).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Cita')).toHaveValue('')
  })

  it('requires a human rating choice instead of preselecting a positive rating', async () => {
    mocks.useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'owner-id', role: 'OWNER_DENTIST' } } })
    mocks.http.get.mockResolvedValue({ items: [] })
    mocks.appointmentsApi.list.mockResolvedValue([])
    mocks.patientsApi.list.mockResolvedValue({ items: [] })

    render(<ReviewsPage />)

    expect(await screen.findByLabelText('Calificación')).toHaveValue('')
  })

  it('does not make list requests for a denied role', () => {
    mocks.useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'billing-id', role: 'BILLING' } } })
    render(<ReviewsPage />)
    expect(screen.getByText('Tu rol no tiene acceso a reseñas privadas.')).toBeInTheDocument()
    expect(mocks.http.get).not.toHaveBeenCalled()
  })
})
