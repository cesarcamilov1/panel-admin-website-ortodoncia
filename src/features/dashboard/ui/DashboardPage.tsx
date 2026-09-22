import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../../shared/ui/atoms/Badge'
import { Card, CardHeader } from '../../../shared/ui/molecules/Card'
import { useHttpTransport } from '../../../shared/api/httpContext'
import { useAppointmentsApi } from '../../agenda/application/useAppointmentsApi'
import type { Appointment } from '../../agenda/domain/appointment'
import { STATUS_LABELS } from '../../agenda/domain/appointment'
import { useAuth } from '../../auth/application/authContext'
import { createCommunicationsApi } from '../../communications/application/communicationsApi'
import styles from './DashboardPage.module.css'

const canRead = (role: string) => role === 'OWNER_DENTIST' || role === 'ASSISTANT'
const statusTone = (status: string): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' => status === 'COMPLETED' ? 'ok' : status === 'CANCELLED' || status === 'NO_SHOW' ? 'danger' : status === 'CONFIRMED' ? 'info' : 'warn'

function todayWindow() {
  const from = new Date()
  from.setHours(0, 0, 0, 0)
  const to = new Date(from)
  to.setDate(to.getDate() + 1)
  return { from: from.toISOString(), to: to.toISOString() }
}

function snapshotPatientName(appointment: Appointment): string {
  const snapshot = appointment as Appointment & { patientName?: string; patient_name?: string }
  return snapshot.patientName || snapshot.patient_name || `Paciente ${appointment.patientId}`
}

export function DashboardPage() {
  const { state } = useAuth()
  const http = useHttpTransport()
  const appointmentsApi = useAppointmentsApi()
  const communications = useMemo(() => createCommunicationsApi(http), [http])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [metrics, setMetrics] = useState<Record<string, number> | null>(null)
  const [loadingAgenda, setLoadingAgenda] = useState(true)
  const [agendaError, setAgendaError] = useState<string | null>(null)
  const [metricsError, setMetricsError] = useState<string | null>(null)
  const ready = state.status === 'authenticated' && canRead(state.user.role)

  useEffect(() => {
    if (!ready) return
    let current = true
    const { from, to } = todayWindow()
    void appointmentsApi.list({ from, to })
      .then((items) => { if (current) setAppointments(items) })
      .catch(() => { if (current) setAgendaError('No pudimos cargar la agenda de hoy.') })
      .finally(() => { if (current) setLoadingAgenda(false) })
    void communications.metrics()
      .then((counters) => { if (current) setMetrics(counters) })
      .catch(() => { if (current) setMetricsError('Las métricas de comunicaciones no están disponibles actualmente.') })
    return () => { current = false }
  }, [appointmentsApi, communications, ready])

  return <div className={styles.page}><div className={styles.columns}>
    <Card padded={false}>
      <CardHeader title="Agenda de hoy" meta="Ventana local de hoy" actions={<Link to="/agenda" className={styles.link}>Ver agenda</Link>} />
      {!ready ? <p role="status">Tu rol no puede consultar este resumen.</p> : null}
      {ready && loadingAgenda ? <p role="status">Cargando agenda de hoy…</p> : null}
      {ready && agendaError ? <p role="alert">{agendaError}</p> : null}
      {ready && !loadingAgenda && !agendaError && appointments.length === 0 ? <p role="status">No hay citas en la ventana de hoy.</p> : null}
      {ready && !agendaError ? appointments.map((appointment) => <Link key={appointment.id} to="/agenda" className={styles.row}>
        <span className={styles.time}>{new Date(appointment.startsAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
        <span className={`${styles.keyline} ${styles[appointment.status]}`} />
        <span className={styles.rowText}><strong>{snapshotPatientName(appointment)}</strong><small>{appointment.reason || 'Sin motivo registrado'}</small></span>
        <Badge tone={statusTone(appointment.status)}>{STATUS_LABELS[appointment.status]}</Badge>
      </Link>) : null}
    </Card>
    <div className={styles.side}>
      <Card>
        <h2 className={styles.cashTitle}>Métricas de comunicaciones</h2>
        {!ready ? <p role="status">No disponibles para tu rol.</p> : null}
        {ready && metricsError ? <p role="alert">{metricsError}</p> : null}
        {ready && !metrics && !metricsError ? <p role="status">Cargando métricas…</p> : null}
        {metrics && Object.keys(metrics).length === 0 ? <p>El servidor no reportó métricas.</p> : null}
        {metrics ? Object.entries(metrics).map(([name, value]) => <p key={name} className={styles.cashRow}><span>{name}</span><strong>{value}</strong></p>) : null}
        <Link to="/recordatorios" className={styles.link}>Abrir recordatorios</Link>
      </Card>
      <Card><h2 className={styles.cashTitle}>Datos no disponibles</h2><p>No hay endpoint seguro para caja, estadísticas de pacientes ni agregados clínicos. Consultá los módulos conectados.</p></Card>
    </div>
  </div></div>
}
