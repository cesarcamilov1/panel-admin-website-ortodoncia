import { agendaGridHeight, blockPlacement, buildHourLabels, slotPlacement } from '../../domain/agenda'
import { WEEK, type ScheduledAppointment } from '../../domain/data'
import styles from './WeekGrid.module.css'

interface WeekGridProps {
  onSelect: (appointment: ScheduledAppointment) => void
}

export function WeekGrid({ onSelect }: WeekGridProps) {
  const hours = buildHourLabels()

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.gutter} />
        {WEEK.map((day) => (
          <div key={day.day} className={`${styles.dayHead} ${day.today ? styles.today : ''}`}>
            <span className={styles.dow}>{day.dow}</span>
            <span className={styles.dayNumber}>{day.day}</span>
          </div>
        ))}
      </div>

      <div className={styles.body}>
        <div className={styles.gutter}>
          {hours.map((hour) => (
            <span key={hour} className={styles.hour}>
              {hour}
            </span>
          ))}
        </div>

        {WEEK.map((day) => (
          <div key={day.day} className={styles.column} style={{ height: agendaGridHeight() }}>
            {day.blocks.map((block) => {
              const { top, height } = blockPlacement(block)
              return (
                <div key={block.label} className={styles.block} style={{ top, height }}>
                  <span className={styles.blockLabel}>{block.label}</span>
                </div>
              )
            })}

            {day.appointments.map((appointment) => {
              const { top, height } = slotPlacement(appointment.time, appointment.durationMinutes)
              return (
                <button
                  key={appointment.id}
                  type="button"
                  onClick={() => onSelect(appointment)}
                  className={`${styles.appointment} ${styles[appointment.status]}`}
                  style={{ top, height }}
                >
                  <span className={styles.appointmentTime}>
                    {appointment.time} · {appointment.patient}
                  </span>
                  <span className={styles.appointmentService}>{appointment.service}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
