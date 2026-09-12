import { ChevronLeftIcon, ChevronRightIcon } from '../../../../shared/ui/atoms/icons'
import { buildMonthGrid } from '../../domain/agenda'
import { BUSY_DAYS } from '../../domain/data'
import styles from './MiniCalendar.module.css'

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

interface MiniCalendarProps {
  year: number
  monthIndex: number
  monthLabel: string
  selectedDay: number
}

export function MiniCalendar({ year, monthIndex, monthLabel, selectedDay }: MiniCalendarProps) {
  const cells = buildMonthGrid(year, monthIndex)

  return (
    <section className={styles.calendar}>
      <header className={styles.header}>
        <h2 className={styles.month}>{monthLabel}</h2>
        <div className={styles.nav}>
          <button type="button" className={styles.navButton} aria-label="Mes anterior">
            <ChevronLeftIcon size={13} />
          </button>
          <button type="button" className={styles.navButton} aria-label="Mes siguiente">
            <ChevronRightIcon size={13} />
          </button>
        </div>
      </header>

      <div className={styles.grid}>
        {WEEKDAYS.map((weekday, index) => (
          <span key={`${weekday}-${index}`} className={styles.weekday}>
            {weekday}
          </span>
        ))}
        {cells.map((cell, index) => {
          const selected = cell.inMonth && cell.day === selectedDay
          const busy = cell.inMonth && BUSY_DAYS.includes(cell.day) && !selected
          return (
            <button
              key={`${cell.day}-${index}`}
              type="button"
              className={`${styles.day} ${cell.inMonth ? '' : styles.outside} ${selected ? styles.selected : ''}`}
            >
              {cell.day}
              <span className={`${styles.dot} ${busy ? styles.busy : ''}`} />
            </button>
          )
        })}
      </div>
    </section>
  )
}
