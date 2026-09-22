import { agendaGridHeight, buildHourLabels, slotPlacement } from '../../domain/agenda'
import { type Appointment, appointmentDurationMinutes, appointmentTime } from '../../domain/appointment'
import styles from './WeekGrid.module.css'

interface WeekGridProps { start: Date; appointments: Appointment[]; onSelect: (appointment: Appointment) => void }
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function isSameDay(instant: string, day: Date): boolean {
  const value = new Date(instant)
  return value.getFullYear() === day.getFullYear() && value.getMonth() === day.getMonth() && value.getDate() === day.getDate()
}

export function WeekGrid({ start, appointments, onSelect }: WeekGridProps) {
  const hours = buildHourLabels()
  const days = Array.from({ length: 7 }, (_, index) => { const day = new Date(start); day.setDate(day.getDate() + index); return day })
  const today = new Date()
  return <div className={styles.wrapper}><div className={styles.header}><span className={styles.gutter} />{days.map((day) => <div key={day.toISOString()} className={`${styles.dayHead} ${isSameDay(today.toISOString(), day) ? styles.today : ''}`}><span className={styles.dow}>{DAYS[day.getDay()]}</span><span className={styles.dayNumber}>{day.getDate()}</span></div>)}</div>
    <div className={styles.body}><div className={styles.gutter}>{hours.map((hour) => <span key={hour} className={styles.hour}>{hour}</span>)}</div>{days.map((day) => <div key={day.toISOString()} className={styles.column} style={{ height: agendaGridHeight() }}>{appointments.filter((appointment) => isSameDay(appointment.startsAt, day)).map((appointment) => { const time = appointmentTime(appointment.startsAt); const { top, height } = slotPlacement(time, appointmentDurationMinutes(appointment)); return <button key={appointment.id} type="button" onClick={() => onSelect(appointment)} className={`${styles.appointment} ${styles[appointment.status.toLowerCase()] ?? ''}`} style={{ top, height }}><span className={styles.appointmentTime}>{time} · {appointment.patientId.slice(0, 8)}</span><span className={styles.appointmentService}>{appointment.services.map((service) => service.serviceName).join(', ')}</span></button> })}</div>)}</div>
  </div>
}
