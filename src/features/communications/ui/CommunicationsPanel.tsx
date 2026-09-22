import { useEffect, useRef, useState } from 'react'
import { Button } from '../../../shared/ui/atoms/Button'
import { isApiError } from '../../../shared/api/problem'
import { Card } from '../../../shared/ui/molecules/Card'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import type { AppointmentsApi } from '../../agenda/application/appointmentsApi'
import type { Appointment } from '../../agenda/domain/appointment'
import type { PatientsApi } from '../../patients/application/patientsApi'
import type { Patient } from '../../patients/domain/patient'
import type { CommunicationsApi, CommunicationDto, CommunicationEventDto, QueueInput, TemplateDto } from '../application/communicationsApi'
import { CHANNELS, communicationErrorMessage, communicationStatusLabel, isUuid, type Channel } from '../domain/communications'
import { CommunicationDetail } from './CommunicationDetail'
import { TemplatesPanel } from './TemplatesPanel'

const PAGE_SIZE = 25
const today = () => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}
const twoWeeksFromToday = () => {
  const date = new Date()
  date.setDate(date.getDate() + 14)
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

interface CommunicationsPanelProps {
  api: CommunicationsApi
  appointmentsApi: AppointmentsApi
  patientsApi: PatientsApi
  role: 'OWNER_DENTIST' | 'ASSISTANT'
  view?: 'communications' | 'templates'
}

function queueKey(): string {
  return crypto.randomUUID()
}

function mergeUnique<T extends { id: string }>(previous: T[], next: T[]): T[] {
  const known = new Set(previous.map((item) => item.id))
  return [...previous, ...next.filter((item) => !known.has(item.id))]
}

function patientName(patient: Patient): string {
  return patient.preferredName || `${patient.firstName} ${patient.lastName}`.trim()
}

export function CommunicationsPanel({ api, appointmentsApi, patientsApi, role, view = 'communications' }: CommunicationsPanelProps) {
  const [communications, setCommunications] = useState<CommunicationDto[]>([])
  const [templates, setTemplates] = useState<TemplateDto[]>([])
  const [canLoadMoreTemplates, setCanLoadMoreTemplates] = useState(false)
  const [loadingMoreTemplates, setLoadingMoreTemplates] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<Record<string, number> | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [metricsError, setMetricsError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [canLoadMore, setCanLoadMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [providerId, setProviderId] = useState('')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [appointmentId, setAppointmentId] = useState('')
  const [patient, setPatient] = useState<Patient | null>(null)
  const [appointmentError, setAppointmentError] = useState<string | null>(null)
  const [channel, setChannel] = useState<Channel>('WHATSAPP')
  const [templateId, setTemplateId] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [queueError, setQueueError] = useState<string | null>(null)
  const [queueSuccess, setQueueSuccess] = useState<string | null>(null)
  const [queueRebaseRequired, setQueueRebaseRequired] = useState(false)
  const [queuePending, setQueuePending] = useState(false)
  const [detail, setDetail] = useState<CommunicationDto | null>(null)
  const [events, setEvents] = useState<CommunicationEventDto[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [canLoadMoreEvents, setCanLoadMoreEvents] = useState(false)
  const [loadingMoreEvents, setLoadingMoreEvents] = useState(false)
  const listSequence = useRef(0)
  const templateItems = useRef<TemplateDto[]>([])
  const templateCursor = useRef<string | undefined>(undefined)
  const templateMore = useRef(false)
  const templateInFlight = useRef(false)
  const templateGeneration = useRef(0)
  const templateRequest = useRef(0)
  const detailSequence = useRef(0)
  const listDeferred = useRef(false)
  const eventsDeferred = useRef(false)
  const queueInFlight = useRef(false)
  const frozenQueue = useRef<QueueInput | null>(null)
  const [frozenQueueSummary, setFrozenQueueSummary] = useState<QueueInput | null>(null)

  const refreshTemplates = async (): Promise<TemplateDto[]> => {
    const generation = ++templateGeneration.current
    const request = ++templateRequest.current
    templateInFlight.current = true
    setLoadingMoreTemplates(false)
    try {
      const page = await api.templates({ limit: 100 })
      if (generation !== templateGeneration.current || request !== templateRequest.current) return templateItems.current
      const next = mergeUnique([], page.items)
      templateItems.current = next
      templateCursor.current = page.items.at(-1)?.id
      templateMore.current = page.items.length === 100 && Boolean(templateCursor.current)
      setTemplates(next)
      setCanLoadMoreTemplates(templateMore.current)
      setTemplateError(null)
      return next
    } catch (error) {
      if (generation === templateGeneration.current && request === templateRequest.current) setTemplateError(communicationErrorMessage(error))
      throw error
    } finally {
      if (request === templateRequest.current) templateInFlight.current = false
    }
  }

  const loadMoreTemplates = async () => {
    const afterId = templateCursor.current
    if (!afterId || !templateMore.current || templateInFlight.current) return
    const generation = templateGeneration.current
    const request = ++templateRequest.current
    templateInFlight.current = true
    setLoadingMoreTemplates(true)
    setTemplateError(null)
    try {
      const page = await api.templates({ limit: 100, afterId })
      if (generation !== templateGeneration.current || request !== templateRequest.current) return
      templateCursor.current = page.items.at(-1)?.id
      templateMore.current = page.items.length === 100 && Boolean(templateCursor.current)
      templateItems.current = mergeUnique(templateItems.current, page.items)
      setTemplates(templateItems.current)
      setCanLoadMoreTemplates(templateMore.current)
    } catch (error) {
      if (generation === templateGeneration.current && request === templateRequest.current) setTemplateError(communicationErrorMessage(error))
    } finally {
      if (request === templateRequest.current) {
        templateInFlight.current = false
        setLoadingMoreTemplates(false)
      }
    }
  }

  const loadCommunications = async (append: boolean) => {
    if (append && listDeferred.current) return
    const sequence = ++listSequence.current
    if (append) {
      listDeferred.current = true
      setLoadingMore(true)
    } else {
      setLoading(true)
    }
    try {
      const afterId = append ? communications.at(-1)?.id : undefined
      const page = await api.list({ limit: PAGE_SIZE, afterId })
      if (sequence !== listSequence.current) return
      setCommunications((current) => append ? mergeUnique(current, page.items) : mergeUnique([], page.items))
      setCanLoadMore(page.items.length === PAGE_SIZE)
      setListError(null)
    } catch (error) {
      if (sequence === listSequence.current) setListError(communicationErrorMessage(error))
    } finally {
      if (sequence === listSequence.current) {
        listDeferred.current = false
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }

  useEffect(() => {
    let current = true
    const generation = ++templateGeneration.current
    const request = ++templateRequest.current
    templateInFlight.current = false
    void Promise.allSettled([
      api.list({ limit: PAGE_SIZE }),
      api.templates({ limit: 100 }),
      api.metrics(),
    ]).then(([communicationResult, templateResult, metricsResult]) => {
      if (!current) return
      if (communicationResult.status === 'fulfilled') {
        setCommunications(mergeUnique([], communicationResult.value.items))
        setCanLoadMore(communicationResult.value.items.length === PAGE_SIZE)
      } else {
        setListError(communicationErrorMessage(communicationResult.reason))
      }
      if (templateResult.status === 'fulfilled' && generation === templateGeneration.current && request === templateRequest.current) {
        const raw = templateResult.value.items
        templateItems.current = mergeUnique([], raw)
        templateCursor.current = raw.at(-1)?.id
        templateMore.current = raw.length === 100 && Boolean(templateCursor.current)
        setTemplates(templateItems.current)
        setCanLoadMoreTemplates(templateMore.current)
      } else if (templateResult.status === 'rejected' && generation === templateGeneration.current && request === templateRequest.current) setTemplateError(communicationErrorMessage(templateResult.reason))
      if (metricsResult.status === 'fulfilled') setMetrics(metricsResult.value)
      else setMetricsError('Las métricas no están disponibles actualmente.')
      setLoadingMoreTemplates(false)
      setLoading(false)
    })
    return () => { current = false }
  }, [api])

  const searchAppointments = async () => {
    if (role === 'ASSISTANT' && !isUuid(providerId)) {
      setAppointmentError('Ingresá el UUID válido del profesional para buscar sus citas.')
      return
    }
    setAppointmentError(null)
    setAppointments([])
    setAppointmentId('')
    setPatient(null)
    try {
      const items = await appointmentsApi.list({ from: today(), to: twoWeeksFromToday(), providerUserId: providerId.trim() || undefined })
      setAppointments(items)
    } catch (error) {
      setAppointmentError(communicationErrorMessage(error))
    }
  }

  const selectAppointment = async (id: string) => {
    setAppointmentId(id)
    setPatient(null)
    setAppointmentError(null)
    const selected = appointments.find((item) => item.id === id)
    if (!selected) return
    try {
      setPatient(await patientsApi.get(selected.patientId))
    } catch (error) {
      setAppointmentError(`No pudimos verificar al paciente seleccionado. ${communicationErrorMessage(error)}`)
    }
  }

  const refreshQueueAuthority = async (): Promise<QueueInput> => {
    const selected = appointments.find((item) => item.id === appointmentId)
    if (!selected || !templateId || !confirmed) throw new Error('Elegí una cita, una plantilla y confirmá la cola.')
    const [currentAppointment, currentTemplates] = await Promise.all([
      appointmentsApi.get(selected.id),
      refreshTemplates(),
    ])
    await patientsApi.get(currentAppointment.patientId)
    const visibleProvider = role === 'ASSISTANT' ? providerId.trim() : providerId.trim() || selected.providerUserId
    if (currentAppointment.id !== selected.id || currentAppointment.patientId !== selected.patientId || currentAppointment.patientId !== patient?.id || currentAppointment.providerUserId !== selected.providerUserId || currentAppointment.providerUserId !== visibleProvider) {
      setAppointmentId('')
      setPatient(null)
      setTemplateId('')
      setConfirmed(false)
      void searchAppointments()
      throw new Error('La cita cambió de paciente o profesional. Actualizamos la búsqueda; elegí nuevamente una cita antes de ponerla en cola.')
    }
    const currentTemplate = currentTemplates.find((template) => template.id === templateId && template.channel === channel && template.is_active)
    if (!currentTemplate) throw new Error('La plantilla seleccionada ya no está activa o no pertenece al canal elegido.')
    return { appointmentId: currentAppointment.id, templateId: currentTemplate.id, channel, expectedVersion: currentAppointment.version, idempotencyKey: queueKey() }
  }

  const queue = async () => {
    if (queueInFlight.current) return
    if (queueRebaseRequired) {
      setQueueError('Prepará una acción nueva antes de volver a poner esta comunicación en cola.')
      return
    }
    queueInFlight.current = true
    setQueuePending(true)
    setQueueError(null)
    setQueueSuccess(null)
    try {
      const attempt = frozenQueue.current ?? await refreshQueueAuthority()
      frozenQueue.current = attempt
      setFrozenQueueSummary(attempt)
      await api.queue(attempt)
      frozenQueue.current = null
      setFrozenQueueSummary(null)
      setConfirmed(false)
      setQueueSuccess('La comunicación quedó en cola. No indica que haya sido enviada.')
      await loadCommunications(false)
    } catch (error) {
      setQueueError(isApiError(error) ? communicationErrorMessage(error) : error instanceof Error ? error.message : communicationErrorMessage(error))
      if (isApiError(error) && error.status < 500) {
        frozenQueue.current = null
        setFrozenQueueSummary(null)
        setQueueRebaseRequired(true)
        setConfirmed(false)
        try { await refreshQueueAuthority() } catch { /* A refresh failure must not replace the confirmed rejection. */ }
      }
    } finally {
      queueInFlight.current = false
      setQueuePending(false)
    }
  }

  const prepareNewQueue = () => {
    frozenQueue.current = null
    setFrozenQueueSummary(null)
    setQueueRebaseRequired(false)
    setConfirmed(false)
    setQueueError(null)
  }

  const loadDetail = async (id: string) => {
    const sequence = ++detailSequence.current
    setDetailLoading(true)
    setDetailError(null)
    try {
      const [current, eventPage] = await Promise.all([api.get(id), api.events(id, { limit: PAGE_SIZE })])
      if (sequence !== detailSequence.current) return
      setDetail(current)
      setEvents(mergeUnique([], eventPage.items))
      setCanLoadMoreEvents(eventPage.items.length === PAGE_SIZE)
    } catch (error) {
      if (sequence === detailSequence.current) setDetailError(communicationErrorMessage(error))
    } finally {
      if (sequence === detailSequence.current) setDetailLoading(false)
    }
  }

  const loadMoreEvents = async () => {
    if (!detail || eventsDeferred.current) return
    eventsDeferred.current = true
    setLoadingMoreEvents(true)
    try {
      const page = await api.events(detail.id, { limit: PAGE_SIZE, afterId: events.at(-1)?.id })
      setEvents((current) => mergeUnique(current, page.items))
      setCanLoadMoreEvents(page.items.length === PAGE_SIZE)
    } catch (error) {
      setDetailError(communicationErrorMessage(error))
    } finally {
      eventsDeferred.current = false
      setLoadingMoreEvents(false)
    }
  }

  const queueLocked = Boolean(frozenQueueSummary)

  const queueView = <>
    <Card>
      <h2>Nueva comunicación</h2>
      <p>Esta acción explícita solo crea una entrada en cola. El backend no admite campos de propósito o profesional en esta operación; la cita seleccionada conserva su profesional.</p>
      {queueError ? <FormAlert tone="error">{queueError}</FormAlert> : null}
      {queueSuccess ? <FormAlert tone="success">{queueSuccess}</FormAlert> : null}
      <label>UUID del profesional<input disabled={queueLocked || queuePending} value={providerId} onChange={(event) => setProviderId(event.target.value)} placeholder={role === 'ASSISTANT' ? 'Obligatorio para asistentes' : 'Opcional para titular'} /></label>
      <Button disabled={queueLocked || queuePending} onClick={() => void searchAppointments()}>Buscar citas</Button>
      {appointmentError ? <FormAlert tone="error">{appointmentError}</FormAlert> : null}
      <label>Cita<select disabled={queueLocked || queuePending} value={appointmentId} onChange={(event) => void selectAppointment(event.target.value)}><option value="">Elegí una cita</option>{appointments.map((item) => <option key={item.id} value={item.id}>{item.startsAt} · {item.id}</option>)}</select></label>
      {patient ? <p>Paciente: {patientName(patient)}</p> : null}
      <label>Canal<select disabled={queueLocked || queuePending} value={channel} onChange={(event) => { setChannel(event.target.value as Channel); setTemplateId('') }}>{CHANNELS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label>Plantilla<select disabled={queueLocked || queuePending} value={templateId} onChange={(event) => setTemplateId(event.target.value)}><option value="">Elegí una plantilla</option>{templates.filter((template) => template.channel === channel && template.is_active).map((template) => <option key={template.id} value={template.id}>{template.code} · versión {template.version}</option>)}</select></label>
      <label><input type="checkbox" disabled={queueLocked || queuePending} checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> {frozenQueueSummary ? `Confirmo reintentar la solicitud original: Cita ${frozenQueueSummary.appointmentId}, plantilla ${frozenQueueSummary.templateId}, canal ${frozenQueueSummary.channel}.` : 'Confirmo poner esta comunicación en cola.'}</label>
      {queueRebaseRequired ? <Button onClick={prepareNewQueue}>Preparar una acción nueva</Button> : null}
      <Button onClick={() => void queue()} disabled={queuePending || queueRebaseRequired || !confirmed}>Poner en cola</Button>
    </Card>
    <Card>
      <h2>Cola de comunicaciones</h2>
      {loading ? <p role="status">Cargando comunicaciones…</p> : null}
      {listError ? <FormAlert tone="error">{listError}</FormAlert> : null}
      {!loading && communications.length === 0 ? <p>No hay comunicaciones en esta página.</p> : null}
      <ul>{communications.map((communication) => <li key={communication.id}><Button variant="link" onClick={() => void loadDetail(communication.id)}>{communicationStatusLabel(communication.status)} · {communication.channel} · {communication.created_at}</Button></li>)}</ul>
      {canLoadMore ? <Button onClick={() => void loadCommunications(true)} disabled={loadingMore}>{loadingMore ? 'Cargando…' : 'Cargar más comunicaciones'}</Button> : null}
    </Card>
    <CommunicationDetail detail={detail} events={events} loading={detailLoading} error={detailError} canLoadMoreEvents={canLoadMoreEvents} loadingMoreEvents={loadingMoreEvents} onLoadMoreEvents={() => void loadMoreEvents()} />
  </>

  return <section aria-label="Comunicaciones">
    {view === 'communications' ? queueView : null}
    <TemplatesPanel api={api} templates={templates} owner={role === 'OWNER_DENTIST'} refreshTemplates={refreshTemplates} canLoadMore={canLoadMoreTemplates} loadingMore={loadingMoreTemplates} error={templateError} onLoadMore={() => void loadMoreTemplates()} />
    <Card>
      <h2>Métricas reportadas</h2>
      <p>Conteos acumulados reportados por el servidor, sin rango temporal informado.</p>
      {metricsError ? <FormAlert tone="error">{metricsError}</FormAlert> : null}
      {metrics && Object.keys(metrics).length === 0 ? <p>El servidor no reportó métricas.</p> : null}
      {metrics ? <ul>{Object.entries(metrics).map(([name, count]) => <li key={name}>{name}: {count}</li>)}</ul> : null}
    </Card>
  </section>
}
