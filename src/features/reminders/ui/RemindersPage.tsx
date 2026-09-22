import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../../shared/ui/atoms/Button'
import { Card } from '../../../shared/ui/molecules/Card'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import { useHttpTransport } from '../../../shared/api/httpContext'
import { isApiError } from '../../../shared/api/problem'
import { useAuth } from '../../auth/application/authContext'
import { useAppointmentsApi } from '../../agenda/application/useAppointmentsApi'
import type { Appointment } from '../../agenda/domain/appointment'
import { createCommunicationsApi, type TemplateDto } from '../../communications/application/communicationsApi'
import { CommunicationsPanel } from '../../communications/ui/CommunicationsPanel'
import { usePatientsApi } from '../../patients/application/usePatientsApi'
import type { PatientSummary } from '../../patients/domain/patient'
import { createRemindersApi } from '../application/remindersApi'
import {
  isVersionConflict,
  reminderErrorMessage,
  type Reminder,
  type ReminderChannel,
  type ReminderScheduleAttempt,
  type ReminderType,
} from '../domain/reminder'
import { ReminderList } from './ReminderList'

const PAGE_SIZE = 25
const allowed = (role: string): role is 'OWNER_DENTIST' | 'ASSISTANT' => role === 'OWNER_DENTIST' || role === 'ASSISTANT'
const newKey = () => crypto.randomUUID()

type ReminderTab = 'reminders' | 'communications' | 'templates'

type FrozenCancelAttempt = {
  id: string
  appointmentId: string
  expectedVersion: number
  idempotencyKey: string
}

function localInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function defaultWindow(): { from: string; to: string } {
  const from = new Date()
  from.setHours(0, 0, 0, 0)
  const to = new Date(from)
  to.setDate(to.getDate() + 14)
  return { from: localInput(from), to: localInput(to) }
}

function toWindow(from: string, to: string): { from: string; to: string } | null {
  const start = new Date(from)
  const end = new Date(to)
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || start >= end || end.valueOf() - start.valueOf() > 31 * 24 * 60 * 60 * 1000) return null
  return { from: start.toISOString(), to: end.toISOString() }
}

function patientName(patient: PatientSummary): string {
  return patient.preferredName || `${patient.firstName} ${patient.lastName}`.trim()
}

function mergeUnique<T extends { id: string }>(previous: T[], next: T[]): T[] {
  const seen = new Set(previous.map((item) => item.id))
  return [...previous, ...next.filter((item) => !seen.has(item.id))]
}

function actionErrorMessage(error: unknown): string {
  return isVersionConflict(error) ? reminderErrorMessage(error) : error instanceof Error ? error.message : reminderErrorMessage(error)
}

export function RemindersPage() {
  const { state } = useAuth()
  const http = useHttpTransport()
  const appointmentsApi = useAppointmentsApi()
  const patientsApi = usePatientsApi()
  const api = useMemo(() => createRemindersApi(http), [http])
  const communications = useMemo(() => createCommunicationsApi(http), [http])
  const [tab, setTab] = useState<ReminderTab>('reminders')
  const [reminders, setReminders] = useState<Reminder[]>([])
  const remindersRef = useRef<Reminder[]>([])
  const [templates, setTemplates] = useState<TemplateDto[]>([])
  const [canLoadMoreTemplates, setCanLoadMoreTemplates] = useState(false)
  const [loadingMoreTemplates, setLoadingMoreTemplates] = useState(false)
  const [patients, setPatients] = useState<PatientSummary[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [patientQuery, setPatientQuery] = useState('')
  const [patientId, setPatientId] = useState('')
  const ownerDefaultProvider = state.status === 'authenticated' && state.user.role === 'OWNER_DENTIST' ? state.user.id ?? '' : ''
  const [providerId, setProviderId] = useState(ownerDefaultProvider)
  const [window, setWindow] = useState(defaultWindow)
  const [appointmentId, setAppointmentId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [reminderType, setReminderType] = useState<ReminderType>('CUSTOM')
  const [channel, setChannel] = useState<ReminderChannel>('WHATSAPP')
  const [scheduledFor, setScheduledFor] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [canLoadMore, setCanLoadMore] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [selectedReminderId, setSelectedReminderId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Reminder | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [cancelCandidate, setCancelCandidate] = useState<Reminder | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [authorityBlocked, setAuthorityBlocked] = useState(false)
  const listInFlight = useRef(false)
  const listSequence = useRef(0)
  const canLoadMoreRef = useRef(false)
  const lookupSequence = useRef(0)
  const templateItems = useRef<TemplateDto[]>([])
  const templateCursor = useRef<string | undefined>(undefined)
  const templateMore = useRef(false)
  const templateInFlight = useRef(false)
  const detailSequence = useRef(0)
  const lookupController = useRef<AbortController | null>(null)
  const patientController = useRef<AbortController | null>(null)
  const scheduleInFlight = useRef(false)
  const cancelInFlight = useRef(false)
  const frozenSchedule = useRef<ReminderScheduleAttempt | null>(null)
  const [frozenScheduleSummary, setFrozenScheduleSummary] = useState<ReminderScheduleAttempt | null>(null)
  const frozenCancel = useRef<FrozenCancelAttempt | null>(null)
  const [frozenCancelSummary, setFrozenCancelSummary] = useState<FrozenCancelAttempt | null>(null)
  const communicationRole = state.status === 'authenticated' && allowed(state.user.role) ? state.user.role : null
  const canUse = communicationRole !== null
  const defaultProviderId = ownerDefaultProvider

  const loadReminders = useCallback(async (append: boolean, signal?: AbortSignal) => {
    if (append && (!canLoadMoreRef.current || listInFlight.current)) return
    const sequence = ++listSequence.current
    listInFlight.current = true
    if (append) setLoadingMore(true)
    try {
      const afterId = append ? remindersRef.current.at(-1)?.id : undefined
      const page = await api.list({ limit: PAGE_SIZE, afterId, signal })
      if (signal?.aborted || sequence !== listSequence.current) return
      const next = append ? mergeUnique(remindersRef.current, page.items) : mergeUnique([], page.items)
      remindersRef.current = next
      setReminders(next)
      const hasMore = page.items.length === PAGE_SIZE
      canLoadMoreRef.current = hasMore
      setCanLoadMore(hasMore)
    } catch (requestError) {
      if (!signal?.aborted && sequence === listSequence.current) setError(reminderErrorMessage(requestError))
    } finally {
      if (!signal?.aborted && sequence === listSequence.current) {
        listInFlight.current = false
        setListLoading(false)
        setLoadingMore(false)
      }
    }
  }, [api])

  const loadTemplates = useCallback(async (append: boolean, signal?: AbortSignal) => {
    if (append && (!templateMore.current || templateInFlight.current)) return
    const afterId = append ? templateCursor.current : undefined
    templateInFlight.current = true
    if (append) setLoadingMoreTemplates(true)
    try {
      const page = await communications.templates({ limit: 100, afterId, signal })
      if (signal?.aborted) return
      templateCursor.current = page.items.at(-1)?.id
      templateMore.current = page.items.length === 100 && Boolean(templateCursor.current)
      templateItems.current = append ? mergeUnique(templateItems.current, page.items) : mergeUnique([], page.items)
      setTemplates(templateItems.current)
      setCanLoadMoreTemplates(templateMore.current)
    } catch (requestError) {
      if (!signal?.aborted) setError(reminderErrorMessage(requestError))
    } finally {
      if (!signal?.aborted) {
        templateInFlight.current = false
        setLoadingMoreTemplates(false)
      }
    }
  }, [communications])

  useEffect(() => {
    if (!canUse || tab !== 'reminders') return
    const controller = new AbortController()
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        void loadReminders(false, controller.signal)
        void loadTemplates(false, controller.signal)
      }
    })
    return () => controller.abort()
  }, [canUse, loadReminders, loadTemplates, tab])

  useEffect(() => {
    if (!canUse || tab !== 'reminders') return
    const controller = new AbortController()
    patientController.current?.abort()
    patientController.current = controller
    void patientsApi.list({ q: patientQuery.trim() || undefined, limit: 25, signal: controller.signal })
      .then((page) => { if (!controller.signal.aborted) setPatients(page.items) })
      .catch((requestError) => { if (!controller.signal.aborted) setError(reminderErrorMessage(requestError)) })
    return () => controller.abort()
  }, [canUse, patientQuery, patientsApi, tab])


  const resetCreationAttempt = () => {
    frozenSchedule.current = null
    setFrozenScheduleSummary(null)
    setAuthorityBlocked(false)
    setConfirmed(false)
    setSuccess(null)
    setError(null)
  }

  const invalidateAppointmentLookup = () => {
    lookupController.current?.abort()
    lookupController.current = null
    lookupSequence.current += 1
    setLookupLoading(false)
    setAppointments([])
    setAppointmentId('')
  }

  const searchAppointments = async () => {
    const dateWindow = toWindow(window.from, window.to)
    const resolvedProvider = providerId.trim() || (communicationRole === 'OWNER_DENTIST' ? defaultProviderId : '')
    if (!patientId || !dateWindow || !resolvedProvider) {
      setError('Elegí un paciente, una ventana válida de hasta 31 días y el profesional responsable.')
      return
    }
    lookupController.current?.abort()
    const controller = new AbortController()
    lookupController.current = controller
    const sequence = ++lookupSequence.current
    setLookupLoading(true)
    setAppointments([])
    setAppointmentId('')
    resetCreationAttempt()
    try {
      const items = await appointmentsApi.list({ ...dateWindow, patientId, providerUserId: resolvedProvider, signal: controller.signal })
      if (controller.signal.aborted || sequence !== lookupSequence.current) return
      setAppointments(items)
    } catch (requestError) {
      if (!controller.signal.aborted && sequence === lookupSequence.current) setError(reminderErrorMessage(requestError))
    } finally {
      if (!controller.signal.aborted && sequence === lookupSequence.current) setLookupLoading(false)
    }
  }

  const selectDetail = async (id: string) => {
    const sequence = ++detailSequence.current
    setSelectedReminderId(id)
    setDetail(null)
    setDetailLoading(true)
    setDetailError(null)
    try {
      const current = await api.get(id)
      if (sequence === detailSequence.current) setDetail(current)
    } catch (requestError) {
      if (sequence === detailSequence.current) setDetailError(reminderErrorMessage(requestError))
    } finally {
      if (sequence === detailSequence.current) setDetailLoading(false)
    }
  }

  const refreshScheduleAuthority = async (): Promise<ReminderScheduleAttempt> => {
    const selected = appointments.find((appointment) => appointment.id === appointmentId)
    const scheduled = new Date(scheduledFor)
    if (!selected || !templateId || !confirmed || Number.isNaN(scheduled.valueOf())) throw new Error('Elegí una cita real, una plantilla activa, fecha y hora, y confirmá la cola.')
    const [currentAppointment, templatePage] = await Promise.all([
      appointmentsApi.get(selected.id),
      communications.templates({ limit: 100 }),
    ])
    const visibleProvider = communicationRole === 'ASSISTANT' ? providerId.trim() : providerId.trim() || selected.providerUserId
    const patientChanged = currentAppointment.patientId !== patientId || currentAppointment.patientId !== selected.patientId
    const providerChanged = currentAppointment.providerUserId !== selected.providerUserId || currentAppointment.providerUserId !== visibleProvider
    if (currentAppointment.id !== selected.id || patientChanged || providerChanged) {
      setAppointmentId('')
      setAppointments([])
      setTemplateId('')
      setConfirmed(false)
      void searchAppointments()
      throw new Error('La cita cambió de paciente o profesional. Actualizamos la búsqueda; elegí nuevamente una cita antes de programar.')
    }
    const template = mergeUnique(templatePage.items, templateItems.current).find((item) => item.id === templateId && item.is_active && item.channel === channel)
    if (!template) throw new Error('La plantilla seleccionada ya no está activa o no pertenece al canal elegido.')
    return { appointmentId: currentAppointment.id, templateId: template.id, channel, reminderType, scheduledFor: scheduled.toISOString(), expectedVersion: currentAppointment.version, idempotencyKey: newKey() }
  }

  const schedule = async () => {
    if (scheduleInFlight.current || authorityBlocked) return
    scheduleInFlight.current = true
    setPendingId('schedule')
    setError(null)
    setSuccess(null)
    let hasAuthority = frozenSchedule.current !== null
    try {
      const attempt = frozenSchedule.current ?? await refreshScheduleAuthority()
      frozenSchedule.current = attempt
      setFrozenScheduleSummary(attempt)
      hasAuthority = true
      await api.schedule(attempt)
      frozenSchedule.current = null
      setFrozenScheduleSummary(null)
      setConfirmed(false)
      setSuccess('El recordatorio quedó programado en cola. Programado o en cola no significa enviado.')
      void loadReminders(false)
    } catch (requestError) {
      setError(actionErrorMessage(requestError))
      if (!hasAuthority) setAuthorityBlocked(true)
      if (isApiError(requestError) && requestError.status < 500) {
        frozenSchedule.current = null
        setFrozenScheduleSummary(null)
        setAuthorityBlocked(true)
        setConfirmed(false)
        try { await refreshScheduleAuthority() } catch { /* A failed refresh preserves the original conflict. */ }
      }
    } finally {
      scheduleInFlight.current = false
      setPendingId(null)
    }
  }

  const clearFrozenCancel = () => {
    frozenCancel.current = null
    setFrozenCancelSummary(null)
    setCancelCandidate(null)
  }

  const cancel = async (reminder?: Reminder) => {
    const original = frozenCancel.current
    if (cancelInFlight.current || (!original && !reminder)) return
    cancelInFlight.current = true
    setPendingId(original?.id ?? reminder!.id)
    setError(null)
    setSuccess(null)
    let hasAuthority = original !== null
    let attempt = original
    try {
      if (!attempt) {
        const currentReminder = await api.get(reminder!.id)
        const appointment = await appointmentsApi.get(currentReminder.appointmentId)
        attempt = { id: currentReminder.id, appointmentId: currentReminder.appointmentId, expectedVersion: appointment.version, idempotencyKey: newKey() }
        frozenCancel.current = attempt
        setFrozenCancelSummary(attempt)
      }
      hasAuthority = true
      await api.cancel(attempt)
      clearFrozenCancel()
      setSuccess('El recordatorio fue cancelado. No se envió ningún mensaje desde esta acción.')
      void loadReminders(false)
    } catch (requestError) {
      setError(actionErrorMessage(requestError))
      if (!hasAuthority) setAuthorityBlocked(true)
      if (attempt && isApiError(requestError) && requestError.status < 500) {
        try {
          const currentReminder = await api.get(attempt.id)
          if (currentReminder.status === 'CANCELLED') {
            clearFrozenCancel()
            setSuccess('El recordatorio ya figura cancelado por el servidor. No se creó una operación nueva.')
            void loadReminders(false)
            return
          }
        } catch { /* The immutable original attempt remains available for explicit replay. */ }
      }
      void loadReminders(false)
    } finally {
      cancelInFlight.current = false
      setPendingId(null)
    }
  }

  if (!canUse) return <Card><h1>Recordatorios</h1><p role="status">Tu rol no tiene acceso a comunicaciones.</p></Card>

  const activeTemplates = templates.filter((template) => template.channel === channel && template.is_active)
  const scheduleLocked = Boolean(frozenScheduleSummary)
  const cancelLocked = Boolean(frozenCancelSummary)
  return <div>
    <div role="tablist" aria-label="Comunicaciones">
      <Button role="tab" aria-selected={tab === 'reminders'} onClick={() => setTab('reminders')}>Recordatorios</Button>
      <Button role="tab" aria-selected={tab === 'communications'} onClick={() => setTab('communications')}>Comunicaciones</Button>
      <Button role="tab" aria-selected={tab === 'templates'} onClick={() => setTab('templates')}>Plantillas</Button>
    </div>
    {tab === 'reminders' ? <>
      <Card>
        <h1>Recordatorios</h1>
        <p>La confirmación crea una entrada programada o en cola; nunca confirma una entrega al paciente.</p>
        {error ? <FormAlert tone="error">{error}</FormAlert> : null}
        {success ? <FormAlert tone="success">{success}</FormAlert> : null}
        <label>Buscar paciente<input disabled={scheduleLocked || pendingId !== null} value={patientQuery} onChange={(event) => { setPatientQuery(event.target.value); setPatientId(''); invalidateAppointmentLookup(); resetCreationAttempt() }} /></label>
        <label>Paciente<select disabled={scheduleLocked || pendingId !== null} value={patientId} onChange={(event) => { setPatientId(event.target.value); invalidateAppointmentLookup(); resetCreationAttempt() }}><option value="">Elegí un paciente</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patientName(patient)} · expediente {patient.recordNumber}</option>)}</select></label>
        <label>Profesional para buscar citas<input disabled={scheduleLocked || pendingId !== null} value={providerId} onChange={(event) => { setProviderId(event.target.value); invalidateAppointmentLookup(); resetCreationAttempt() }} placeholder={communicationRole === 'ASSISTANT' ? 'UUID obligatorio para asistentes' : 'Tu UUID por defecto'} /></label>
        <label>Desde<input disabled={scheduleLocked || pendingId !== null} aria-label="Desde" type="datetime-local" value={window.from} onChange={(event) => { setWindow((current) => ({ ...current, from: event.target.value })); resetCreationAttempt() }} /></label>
        <label>Hasta<input disabled={scheduleLocked || pendingId !== null} aria-label="Hasta" type="datetime-local" value={window.to} onChange={(event) => { setWindow((current) => ({ ...current, to: event.target.value })); resetCreationAttempt() }} /></label>
        <Button onClick={() => void searchAppointments()} disabled={lookupLoading || scheduleLocked || pendingId !== null}>{lookupLoading ? 'Buscando…' : 'Buscar citas'}</Button>
        <label>Cita<select disabled={scheduleLocked || pendingId !== null} value={appointmentId} onChange={(event) => { setAppointmentId(event.target.value); resetCreationAttempt() }}><option value="">Elegí una cita real</option>{appointments.map((appointment) => <option key={appointment.id} value={appointment.id}>{appointment.startsAt} · {appointment.status}</option>)}</select></label>
        <label>Canal<select disabled={scheduleLocked || pendingId !== null} value={channel} onChange={(event) => { setChannel(event.target.value as ReminderChannel); setTemplateId(''); resetCreationAttempt() }}><option value="WHATSAPP">WhatsApp</option><option value="SMS">SMS</option><option value="EMAIL">Correo</option></select></label>
        <label>Tipo<select disabled={scheduleLocked || pendingId !== null} value={reminderType} onChange={(event) => { setReminderType(event.target.value as ReminderType); setTemplateId(''); resetCreationAttempt() }}><option value="CUSTOM">Personalizado</option><option value="CONFIRMATION">Confirmación</option><option value="TWENTY_FOUR_HOURS">24 horas antes</option><option value="SAME_DAY">Mismo día</option></select></label>
        <label>Plantilla activa<select disabled={scheduleLocked || pendingId !== null} value={templateId} onChange={(event) => { setTemplateId(event.target.value); resetCreationAttempt() }}><option value="">Elegí una plantilla</option>{activeTemplates.map((template) => <option key={template.id} value={template.id}>{template.code} · versión {template.version}</option>)}</select></label>
        {canLoadMoreTemplates ? <Button variant="secondary" disabled={loadingMoreTemplates || scheduleLocked || pendingId !== null} onClick={() => void loadTemplates(true)}>{loadingMoreTemplates ? 'Cargando plantillas…' : 'Cargar más plantillas'}</Button> : null}
        <label>Programado para<input disabled={scheduleLocked || pendingId !== null} type="datetime-local" value={scheduledFor} onChange={(event) => { setScheduledFor(event.target.value); resetCreationAttempt() }} /></label>
        <label><input type="checkbox" disabled={scheduleLocked || pendingId !== null} checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> {frozenScheduleSummary ? `Confirmo reintentar la solicitud original: cita ${frozenScheduleSummary.appointmentId}, plantilla ${frozenScheduleSummary.templateId}, canal ${frozenScheduleSummary.channel}, programado para ${frozenScheduleSummary.scheduledFor}.` : 'Confirmo poner este recordatorio en cola.'}</label>
        {authorityBlocked ? <Button onClick={resetCreationAttempt}>Preparar una acción nueva</Button> : null}
        <Button onClick={() => void schedule()} disabled={pendingId !== null || authorityBlocked || !confirmed}>Programar en cola</Button>
      </Card>
      {frozenCancelSummary ? <Card>
        <h2>Cancelación original pendiente</h2>
        <p>El resultado de la cancelación original no se confirmó. Recordatorio {frozenCancelSummary.id}, cita {frozenCancelSummary.appointmentId}, versión {frozenCancelSummary.expectedVersion}. Reintentá exactamente la operación original; no se crea una cancelación nueva.</p>
        <Button onClick={() => void cancel()} disabled={pendingId !== null}>Reintentar cancelación original</Button>
      </Card> : null}
      <ReminderList reminders={reminders} loading={listLoading} loadingMore={loadingMore} canLoadMore={canLoadMore} pendingId={pendingId} selectedId={selectedReminderId} detail={detail} detailLoading={detailLoading} detailError={detailError} onLoadMore={() => void loadReminders(true)} onSelect={(id) => void selectDetail(id)} onCancel={(candidate) => { if (!cancelLocked) setCancelCandidate(candidate) }} />
      {cancelCandidate && !cancelLocked ? <Card>
        <h2>Confirmar cancelación</h2>
        <p>Cancelarás el recordatorio seleccionado si la cita conserva su versión actual. Esta acción no revierte mensajes ya enviados.</p>
        <Button variant="secondary" onClick={() => setCancelCandidate(null)} disabled={pendingId !== null}>Volver</Button>
        <Button onClick={() => { const candidate = cancelCandidate; setCancelCandidate(null); void cancel(candidate) }} disabled={pendingId !== null || authorityBlocked}>Confirmar cancelación</Button>
      </Card> : null}
    </> : null}
    {tab === 'communications' ? <CommunicationsPanel api={communications} appointmentsApi={appointmentsApi} patientsApi={patientsApi} role={communicationRole} /> : null}
    {tab === 'templates' ? <CommunicationsPanel api={communications} appointmentsApi={appointmentsApi} patientsApi={patientsApi} role={communicationRole} view="templates" /> : null}
  </div>
}
