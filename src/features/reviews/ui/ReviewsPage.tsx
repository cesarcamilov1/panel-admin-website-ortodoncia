import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../../shared/ui/atoms/Button'
import { Card } from '../../../shared/ui/molecules/Card'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import { useHttpTransport } from '../../../shared/api/httpContext'
import { isApiError } from '../../../shared/api/problem'
import { useAuth } from '../../auth/application/authContext'
import { useAppointmentsApi } from '../../agenda/application/useAppointmentsApi'
import type { Appointment } from '../../agenda/domain/appointment'
import { usePatientsApi } from '../../patients/application/usePatientsApi'
import type { PatientSummary } from '../../patients/domain/patient'
import { createReviewsApi } from '../application/reviewsApi'
import { isValidRating, reviewErrorMessage, type Review, type ReviewAttempt } from '../domain/review'

const PAGE_SIZE = 25
const allowed = (role: string): role is 'OWNER_DENTIST' | 'ASSISTANT' => role === 'OWNER_DENTIST' || role === 'ASSISTANT'
const newKey = () => crypto.randomUUID()

function localInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function defaultWindow(): { from: string; to: string } {
  const to = new Date()
  to.setDate(to.getDate() + 1)
  to.setHours(0, 0, 0, 0)
  const from = new Date(to)
  from.setDate(from.getDate() - 31)
  return { from: localInput(from), to: localInput(to) }
}

function validWindow(from: string, to: string): { from: string; to: string } | null {
  const start = new Date(from)
  const end = new Date(to)
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || start >= end || end.valueOf() - start.valueOf() > 31 * 24 * 60 * 60 * 1000) return null
  return { from: start.toISOString(), to: end.toISOString() }
}

function patientName(patient: PatientSummary): string {
  return patient.preferredName || `${patient.firstName} ${patient.lastName}`.trim()
}

function mergeUnique<T extends { id: string }>(previous: T[], next: T[]): T[] {
  const known = new Set(previous.map((item) => item.id))
  return [...previous, ...next.filter((item) => !known.has(item.id))]
}

export function ReviewsPage() {
  const { state } = useAuth()
  const http = useHttpTransport()
  const appointmentsApi = useAppointmentsApi()
  const patientsApi = usePatientsApi()
  const api = useMemo(() => createReviewsApi(http), [http])
  const [reviews, setReviews] = useState<Review[]>([])
  const reviewsRef = useRef<Review[]>([])
  const [patients, setPatients] = useState<PatientSummary[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [patientQuery, setPatientQuery] = useState('')
  const [patientId, setPatientId] = useState('')
  const ownerDefaultProvider = state.status === 'authenticated' && state.user.role === 'OWNER_DENTIST' ? state.user.id ?? '' : ''
  const [providerId, setProviderId] = useState(ownerDefaultProvider)
  const [window, setWindow] = useState(defaultWindow)
  const [appointmentId, setAppointmentId] = useState('')
  const [rating, setRating] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [listLoading, setListLoading] = useState(true)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [canLoadMore, setCanLoadMore] = useState(false)
  const [pending, setPending] = useState(false)
  const [rebaseRequired, setRebaseRequired] = useState(false)
  const listInFlight = useRef(false)
  const listSequence = useRef(0)
  const canLoadMoreRef = useRef(false)
  const lookupSequence = useRef(0)
  const patientController = useRef<AbortController | null>(null)
  const appointmentController = useRef<AbortController | null>(null)
  const createInFlight = useRef(false)
  const frozen = useRef<ReviewAttempt | null>(null)
  const [frozenSummary, setFrozenSummary] = useState<ReviewAttempt | null>(null)
  const canUse = state.status === 'authenticated' && allowed(state.user.role)
  const defaultProviderId = ownerDefaultProvider

  const loadReviews = useCallback(async (append: boolean, signal?: AbortSignal) => {
    if (append && (!canLoadMoreRef.current || listInFlight.current)) return false
    const sequence = ++listSequence.current
    listInFlight.current = true
    if (append) setLoadingMore(true)
    try {
      const page = await api.list({ limit: PAGE_SIZE, afterId: append ? reviewsRef.current.at(-1)?.id : undefined, signal })
      if (signal?.aborted || sequence !== listSequence.current) return false
      const next = append ? mergeUnique(reviewsRef.current, page.items) : mergeUnique([], page.items)
      reviewsRef.current = next
      setReviews(next)
      const hasMore = page.items.length === PAGE_SIZE
      canLoadMoreRef.current = hasMore
      setCanLoadMore(hasMore)
      return true
    } catch (requestError) {
      if (!signal?.aborted && sequence === listSequence.current) setError(reviewErrorMessage(requestError))
      return false
    } finally {
      if (!signal?.aborted && sequence === listSequence.current) {
        listInFlight.current = false
        setListLoading(false)
        setLoadingMore(false)
      }
    }
  }, [api])

  useEffect(() => {
    if (!canUse) return
    const controller = new AbortController()
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) void loadReviews(false, controller.signal)
    })
    return () => controller.abort()
  }, [canUse, loadReviews])

  useEffect(() => {
    if (!canUse) return
    const controller = new AbortController()
    patientController.current?.abort()
    patientController.current = controller
    void patientsApi.list({ q: patientQuery.trim() || undefined, limit: 25, signal: controller.signal })
      .then((page) => { if (!controller.signal.aborted) setPatients(page.items) })
      .catch((requestError) => { if (!controller.signal.aborted) setError(reviewErrorMessage(requestError)) })
    return () => controller.abort()
  }, [canUse, patientQuery, patientsApi])


  const resetAttempt = () => {
    if (frozen.current) return
    setSuccess(null)
    setError(null)
  }

  const prepareNewAttempt = () => {
    frozen.current = null
    setFrozenSummary(null)
    setRebaseRequired(false)
    setSuccess(null)
    setError(null)
  }

  const invalidateAppointmentLookup = () => {
    appointmentController.current?.abort()
    appointmentController.current = null
    lookupSequence.current += 1
    setLookupLoading(false)
    setAppointments([])
    setAppointmentId('')
  }

  const searchAppointments = async () => {
    const range = validWindow(window.from, window.to)
    const resolvedProvider = providerId.trim() || defaultProviderId
    if (!patientId || !range || !resolvedProvider) {
      setError('Elegí un paciente, un profesional y una ventana válida de hasta 31 días.')
      return
    }
    appointmentController.current?.abort()
    const controller = new AbortController()
    appointmentController.current = controller
    const sequence = ++lookupSequence.current
    setLookupLoading(true)
    setAppointments([])
    setAppointmentId('')
    resetAttempt()
    try {
      const items = await appointmentsApi.list({ ...range, patientId, providerUserId: resolvedProvider, signal: controller.signal })
      if (!controller.signal.aborted && sequence === lookupSequence.current) setAppointments(items)
    } catch (requestError) {
      if (!controller.signal.aborted && sequence === lookupSequence.current) setError(reviewErrorMessage(requestError))
    } finally {
      if (!controller.signal.aborted && sequence === lookupSequence.current) setLookupLoading(false)
    }
  }

  const create = async () => {
    if (createInFlight.current || rebaseRequired) return
    const selected = appointments.find((appointment) => appointment.id === appointmentId)
    if (!selected || !isValidRating(rating)) {
      setError('Elegí una cita real y una calificación explícita entre 1 y 5.')
      return
    }
    createInFlight.current = true
    setPending(true)
    setError(null)
    setSuccess(null)
    try {
      let attempt = frozen.current
      if (!attempt) {
        const current = await appointmentsApi.get(selected.id)
        const visibleProvider = state.status === 'authenticated' && state.user.role === 'ASSISTANT' ? providerId.trim() : providerId.trim() || selected.providerUserId
        const patientChanged = current.patientId !== patientId || current.patientId !== selected.patientId
        const providerChanged = current.providerUserId !== selected.providerUserId || current.providerUserId !== visibleProvider
        if (current.id !== selected.id || patientChanged || providerChanged) {
          setAppointmentId('')
          setAppointments([])
          void searchAppointments()
          throw new Error('La cita cambió de paciente o profesional. Actualizamos la búsqueda; elegí nuevamente una cita antes de guardar.')
        }
        attempt = { patientId: current.patientId, appointmentId: current.id, rating: Number(rating), comment, idempotencyKey: newKey() }
        frozen.current = attempt
        setFrozenSummary(attempt)
      }
      await api.create(attempt)
      frozen.current = null
      setFrozenSummary(null)
      setRating('')
      setComment('')
      setAppointmentId('')
      setSuccess('La reseña privada se guardó. Esta pantalla no solicita ni publica reseñas públicas.')
      if (!await loadReviews(false)) setError('La reseña privada se guardó, pero no pudimos actualizar la lista.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : reviewErrorMessage(requestError))
      if (isApiError(requestError) && requestError.status < 500) {
        frozen.current = null
        setFrozenSummary(null)
        setRebaseRequired(true)
      }
    } finally {
      createInFlight.current = false
      setPending(false)
    }
  }

  if (!canUse) return <Card><h1>Reseñas</h1><p role="status">Tu rol no tiene acceso a reseñas privadas.</p></Card>

  const reviewLocked = Boolean(frozenSummary)
  return <div>
    <Card>
      <h1>Reseñas privadas</h1>
      <p>Solo se registra retroalimentación ingresada por una persona. No se solicitan ni publican reseñas desde esta pantalla.</p>
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      {success ? <FormAlert tone="success">{success}</FormAlert> : null}
      <label>Buscar paciente<input disabled={reviewLocked || pending} value={patientQuery} onChange={(event) => { setPatientQuery(event.target.value); setPatientId(''); invalidateAppointmentLookup(); resetAttempt() }} /></label>
      <label>Paciente<select disabled={reviewLocked || pending} value={patientId} onChange={(event) => { setPatientId(event.target.value); invalidateAppointmentLookup(); resetAttempt() }}><option value="">Elegí un paciente</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patientName(patient)} · expediente {patient.recordNumber}</option>)}</select></label>
      <label>Profesional para buscar citas<input disabled={reviewLocked || pending} value={providerId} onChange={(event) => { setProviderId(event.target.value); invalidateAppointmentLookup(); resetAttempt() }} placeholder={state.status === 'authenticated' && state.user.role === 'ASSISTANT' ? 'UUID obligatorio para asistentes' : 'Tu UUID por defecto'} /></label>
      <label>Desde<input disabled={reviewLocked || pending} aria-label="Desde" type="datetime-local" value={window.from} onChange={(event) => { setWindow((current) => ({ ...current, from: event.target.value })); resetAttempt() }} /></label>
      <label>Hasta<input disabled={reviewLocked || pending} aria-label="Hasta" type="datetime-local" value={window.to} onChange={(event) => { setWindow((current) => ({ ...current, to: event.target.value })); resetAttempt() }} /></label>
      <Button onClick={() => void searchAppointments()} disabled={lookupLoading || reviewLocked || pending}>{lookupLoading ? 'Buscando…' : 'Buscar citas'}</Button>
      <label>Cita<select disabled={reviewLocked || pending} value={appointmentId} onChange={(event) => { setAppointmentId(event.target.value); resetAttempt() }}><option value="">Elegí una cita, incluso una visita completada</option>{appointments.map((appointment) => <option key={appointment.id} value={appointment.id}>{appointment.startsAt} · {appointment.status}</option>)}</select></label>
      <label>Calificación<select disabled={reviewLocked || pending} value={rating} onChange={(event) => { setRating(event.target.value); resetAttempt() }}><option value="">Elegí una calificación</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select></label>
      <label>Comentario opcional<textarea disabled={reviewLocked || pending} value={comment} maxLength={2000} onChange={(event) => { setComment(event.target.value); resetAttempt() }} /></label>
      {frozenSummary ? <p>Reintentarás la solicitud original: cita {frozenSummary.appointmentId}, calificación {frozenSummary.rating}, comentario {frozenSummary.comment || 'sin comentario'}.</p> : null}
      {rebaseRequired ? <Button onClick={prepareNewAttempt}>Preparar una acción nueva</Button> : null}
      <Button onClick={() => void create()} disabled={pending || rebaseRequired}>Guardar reseña privada</Button>
    </Card>
    <Card>
      <h2>Registros</h2>
      {listLoading ? <p role="status">Cargando reseñas…</p> : null}
      {!listLoading && reviews.length === 0 ? <p>No hay reseñas en esta página.</p> : null}
      <ul>{reviews.map((review) => <li key={review.id}>{review.rating}/5 · {review.comment || 'Sin comentario'} · {review.createdAt}</li>)}</ul>
      {canLoadMore ? <Button onClick={() => void loadReviews(true)} disabled={loadingMore}>{loadingMore ? 'Cargando…' : 'Cargar más reseñas'}</Button> : null}
    </Card>
  </div>
}
