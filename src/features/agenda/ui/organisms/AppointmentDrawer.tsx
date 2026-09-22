import { useCallback, useEffect, useReducer, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../../../shared/ui/atoms/Badge'
import { Button } from '../../../../shared/ui/atoms/Button'
import { TextArea, TextField } from '../../../../shared/ui/atoms/Field'
import { FormAlert } from '../../../../shared/ui/molecules/FormAlert'
import { CloseIcon } from '../../../../shared/ui/atoms/icons'
import { useAppointmentsApi } from '../../application/useAppointmentsApi'
import { type Appointment, type AppointmentStatus, STATUS_LABELS, allowedTransitions, appointmentDurationMinutes, appointmentErrorMessage, appointmentTime, requiresTransitionReason } from '../../domain/appointment'
import { isApiError } from '../../../../shared/api/problem'
import styles from './AppointmentDrawer.module.css'

interface AppointmentDrawerProps { appointment: Appointment; onClose: () => void; onChanged: () => void }
const TONES: Record<AppointmentStatus, 'ok' | 'warn' | 'danger' | 'info' | 'neutral' | 'accent'> = { PENDING: 'warn', CONFIRMED: 'accent', ARRIVED: 'info', IN_PROGRESS: 'info', COMPLETED: 'ok', CANCELLED: 'neutral', NO_SHOW: 'danger' }
const TERMINAL_STATUSES: AppointmentStatus[] = ['COMPLETED', 'CANCELLED', 'NO_SHOW']
const TRANSITION_ACTIONS: Record<AppointmentStatus, string> = {
  PENDING: 'Pendiente', CONFIRMED: 'Confirmar', ARRIVED: 'Marcar llegada', IN_PROGRESS: 'Iniciar atención', COMPLETED: 'Completar cita', CANCELLED: 'Cancelar cita', NO_SHOW: 'No asistió',
}

export function AppointmentDrawer({ appointment, onClose, onChanged }: AppointmentDrawerProps) {
  const api = useAppointmentsApi()
  const [detail, updateDetail] = useReducer((_: Appointment, next: Appointment) => next, appointment)
  const [history, setHistory] = useState<Array<{ id: string; fromStatus: AppointmentStatus | null; toStatus: AppointmentStatus; reason: string; createdAt: string }>>([])
  const [candidates, setCandidates] = useState<Array<{ patientId: string; recordNumber: number; firstName: string; lastName: string; phoneMasked: string; archived: boolean }>>([])
  const [reason, setReason] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [selectedCandidate, setSelectedCandidate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [detailReady, setDetailReady] = useState(false)

  const reloadDetail = useCallback(async (signal?: AbortSignal) => {
    const current = await api.get(appointment.id, signal)
    if (!signal?.aborted) {
      updateDetail(current)
      setDetailReady(true)
    }
    return current
  }, [api, appointment.id])

  const loadDrawerData = useCallback((signal: AbortSignal) => {
    const onFailure = (cause: unknown) => {
      if (!signal.aborted) setError(appointmentErrorMessage(cause))
    }
    void reloadDetail(signal).catch(onFailure)
    void api.history(appointment.id, signal).then((items) => {
      if (!signal.aborted) setHistory(items)
    }).catch(onFailure)
    if (appointment.identityStatus === 'PENDING_REVIEW') {
      void api.listIdentityCandidates(appointment.id, signal).then((items) => {
        if (!signal.aborted) setCandidates(items)
      }).catch(onFailure)
    }
  }, [api, appointment.id, appointment.identityStatus, reloadDetail])

  useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) loadDrawerData(controller.signal)
    })
    return () => controller.abort()
  }, [loadDrawerData])

  const mutate = async (work: () => Promise<Appointment>) => {
    setPending(true); setError(null)
    try {
      const updated = await work()
      updateDetail(updated)
      onChanged()
    } catch (cause) {
      setError(appointmentErrorMessage(cause))
      if (isApiError(cause) && (cause.code === 'PRECONDITION_FAILED' || cause.code === 'VERSION_CONFLICT' || cause.status === 412)) {
        setDetailReady(false)
        void reloadDetail().catch(() => undefined)
      }
    } finally { setPending(false) }
  }
  const transition = (status: AppointmentStatus) => {
    if (requiresTransitionReason(status) && !reason.trim()) { setError('Indicá el motivo para esta transición.'); return }
    if (requiresTransitionReason(status) && !window.confirm(`¿Confirmás cambiar la cita a “${STATUS_LABELS[status]}”?`)) return
    void mutate(() => api.transition({ id: detail.id, version: detail.version, status, reason: reason.trim() }))
  }
  const reschedule = () => {
    const parsed = new Date(startsAt)
    if (Number.isNaN(parsed.valueOf())) { setError('Indicá una fecha y hora válida para reagendar.'); return }
    void mutate(() => api.reschedule({ id: detail.id, version: detail.version, startsAt: parsed.toISOString() }))
  }
  const rows = [
    { label: 'Servicios', value: detail.services.map((service) => service.serviceName).join(', ') || 'Sin servicios' },
    { label: 'Horario', value: `${appointmentTime(detail.startsAt)} · ${appointmentDurationMinutes(detail)} min` },
    { label: 'Profesional', value: detail.providerUserId }, { label: 'Sede', value: detail.locationId || 'No especificada' }, { label: 'Origen', value: detail.source },
  ]
  const canReschedule = !TERMINAL_STATUSES.includes(detail.status)
  const mutationsDisabled = pending || !detailReady

  return <><button type="button" className={styles.scrim} onClick={onClose} aria-label="Cerrar detalle" />
    <aside className={styles.drawer} aria-label="Detalle de la cita"><header className={styles.header}><h2 className={styles.title}>Detalle de la cita</h2><button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar"><CloseIcon /></button></header>
      <div className={styles.body}>
        {error ? <FormAlert tone="error">{error}</FormAlert> : null}
        <div className={styles.patient}><span className={styles.patientText}><strong>Paciente</strong><Link to={`/pacientes/${detail.patientId}`}>Abrir expediente</Link></span><Badge tone={TONES[detail.status]}>{STATUS_LABELS[detail.status]}</Badge></div>
        <dl className={styles.rows}>{rows.map((row) => <div key={row.label} className={styles.row}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
        {detail.reason ? <p><strong>Motivo:</strong> {detail.reason}</p> : null}
        {detail.internalNotes ? <p><strong>Nota interna:</strong> {detail.internalNotes}</p> : null}
        <TextArea label="Motivo de transición" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} disabled={mutationsDisabled} hint="Obligatorio para cancelar o marcar inasistencia." />
        {canReschedule ? <TextField label="Nueva fecha y hora" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} disabled={mutationsDisabled} hint="El servidor valida conflicto y versión." /> : null}
        {detail.identityStatus === 'PENDING_REVIEW' ? <section><h3>Revisión de identidad</h3><p>La identidad de una reserva pública requiere revisión del equipo.</p><select value={selectedCandidate} onChange={(event) => setSelectedCandidate(event.target.value)} disabled={mutationsDisabled}><option value="">Elegí un candidato para vincular</option>{candidates.filter((candidate) => !candidate.archived).map((candidate) => <option key={candidate.patientId} value={candidate.patientId}>{candidate.firstName} {candidate.lastName} · Exp. {candidate.recordNumber} · {candidate.phoneMasked}</option>)}</select><div className={styles.actions}><Button size="sm" variant="secondary" disabled={mutationsDisabled} onClick={() => void mutate(() => api.resolveIdentity({ id: detail.id, version: detail.version, action: 'CONFIRM_NEW' }))}>Confirmar paciente nuevo</Button><Button size="sm" disabled={mutationsDisabled || !selectedCandidate} onClick={() => void mutate(() => api.resolveIdentity({ id: detail.id, version: detail.version, action: 'LINK_EXISTING', patientId: selectedCandidate }))}>Vincular existente</Button></div></section> : null}
        <section className={styles.reminders}><p className={styles.remindersTitle}>Historial de estados</p>{history.length === 0 ? <p>Sin cambios registrados.</p> : history.map((item) => <div key={item.id} className={styles.reminder}><span className={styles.reminderLabel}>{item.fromStatus ? `${STATUS_LABELS[item.fromStatus]} → ` : ''}{STATUS_LABELS[item.toStatus]}</span><span className={styles.reminderWhen}>{item.reason || new Date(item.createdAt).toLocaleString('es-MX')}</span></div>)}</section>
      </div>
      <footer className={styles.footer}><div className={styles.actions}>{allowedTransitions(detail.status).map((status) => <Button key={status} variant={status === 'CANCELLED' ? 'danger' : status === 'NO_SHOW' ? 'secondary' : 'primary'} size={status === 'CANCELLED' || status === 'NO_SHOW' ? 'sm' : undefined} disabled={mutationsDisabled} onClick={() => transition(status)}>{TRANSITION_ACTIONS[status]}</Button>)}{canReschedule ? <Button variant="secondary" disabled={mutationsDisabled} onClick={reschedule}>Reagendar</Button> : null}</div></footer>
    </aside></>
}
