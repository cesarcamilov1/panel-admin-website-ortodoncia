import { Link } from 'react-router-dom'
import { Badge } from '../../../../shared/ui/atoms/Badge'
import { Button } from '../../../../shared/ui/atoms/Button'
import { Avatar } from '../../../../shared/ui/atoms/Avatar'
import { CloseIcon } from '../../../../shared/ui/atoms/icons'
import { STATUS_LABELS, STATUS_TONES, type ScheduledAppointment } from '../../domain/data'
import styles from './AppointmentDrawer.module.css'

interface AppointmentDrawerProps {
  appointment: ScheduledAppointment
  onClose: () => void
  onConfirm: () => void
}

const REMINDERS = [
  { label: 'Confirmación por WhatsApp', when: 'Entregada', tone: 'ok' as const },
  { label: 'Recordatorio 24 h antes', when: 'Programado', tone: 'warn' as const },
  { label: 'Encuesta posterior', when: 'Al completar', tone: 'idle' as const },
]

export function AppointmentDrawer({ appointment, onClose, onConfirm }: AppointmentDrawerProps) {
  const rows = [
    { label: 'Servicio', value: appointment.service },
    { label: 'Horario', value: `${appointment.time} · ${appointment.durationMinutes} min` },
    { label: 'Profesional', value: 'Dra. Mariana Cázares' },
    { label: 'Sede', value: 'Polanco · Consultorio 2' },
    { label: 'Origen', value: 'Reserva en línea' },
  ]

  return (
    <>
      <button type="button" className={styles.scrim} onClick={onClose} aria-label="Cerrar detalle" />
      <aside className={styles.drawer} aria-label="Detalle de la cita">
        <header className={styles.header}>
          <h2 className={styles.title}>Detalle de la cita</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
            <CloseIcon />
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.patient}>
            <Avatar name={appointment.patient} size={46} />
            <span className={styles.patientText}>
              <strong>{appointment.patient}</strong>
              <Link to="/pacientes/EXP-0421">Abrir expediente</Link>
            </span>
            <Badge tone={STATUS_TONES[appointment.status]}>{STATUS_LABELS[appointment.status]}</Badge>
          </div>

          <dl className={styles.rows}>
            {rows.map((row) => (
              <div key={row.label} className={styles.row}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>

          <label className={styles.noteLabel}>
            Nota para la cita
            <textarea
              className={styles.note}
              defaultValue="Trae radiografía panorámica del año pasado."
            />
          </label>

          <div className={styles.reminders}>
            <p className={styles.remindersTitle}>Recordatorios</p>
            {REMINDERS.map((reminder) => (
              <div key={reminder.label} className={styles.reminder}>
                <span className={`${styles.dot} ${styles[reminder.tone]}`} />
                <span className={styles.reminderLabel}>{reminder.label}</span>
                <span className={styles.reminderWhen}>{reminder.when}</span>
              </div>
            ))}
          </div>
        </div>

        <footer className={styles.footer}>
          <div className={styles.actions}>
            <Button onClick={onConfirm}>Confirmar</Button>
            <Button variant="secondary">Reagendar</Button>
          </div>
          <div className={styles.actions}>
            <Button variant="secondary" size="sm">
              No asistió
            </Button>
            <Button variant="danger" size="sm">
              Cancelar cita
            </Button>
          </div>
        </footer>
      </aside>
    </>
  )
}
