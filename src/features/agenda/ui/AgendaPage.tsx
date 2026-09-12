import { useState } from 'react'
import { Button } from '../../../shared/ui/atoms/Button'
import { SelectField } from '../../../shared/ui/atoms/Field'
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon } from '../../../shared/ui/atoms/icons'
import { usePanelActions } from '../../panel/application/panelContext'
import { STATUS_LABELS, type ScheduledAppointment } from '../domain/data'
import type { AppointmentStatus } from '../domain/agenda'
import { AppointmentDrawer } from './organisms/AppointmentDrawer'
import { MiniCalendar } from './organisms/MiniCalendar'
import { WeekGrid } from './organisms/WeekGrid'
import styles from './AgendaPage.module.css'

const VIEWS = ['Día', 'Semana', 'Mes'] as const
const STATUSES: AppointmentStatus[] = [
  'confirmada',
  'pendiente',
  'curso',
  'completada',
  'noshow',
  'cancelada',
]

export function AgendaPage() {
  const { notify } = usePanelActions()
  const [view, setView] = useState<(typeof VIEWS)[number]>('Semana')
  const [selected, setSelected] = useState<ScheduledAppointment | null>(null)

  return (
    <div className={styles.layout}>
      <div className={styles.rail}>
        <MiniCalendar year={2026} monthIndex={8} monthLabel="Septiembre 2026" selectedDay={16} />

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Filtros</h2>
          <SelectField
            options={[
              'Todos los profesionales',
              'Dra. Mariana Cázares',
              'Dr. Iván Robledo',
              'Higiene · Paola Nieto',
            ]}
          />
          <SelectField
            options={[
              'Todos los servicios',
              'Limpieza dental',
              'Resina',
              'Endodoncia',
              'Ortodoncia · ajuste',
            ]}
          />
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Estados</h2>
          {STATUSES.map((status) => (
            <p key={status} className={styles.legend}>
              <span className={`${styles.swatch} ${styles[status]}`} />
              {STATUS_LABELS[status]}
            </p>
          ))}
        </section>

        <Button variant="secondary">
          <ClockIcon size={15} />
          Bloquear un horario
        </Button>
      </div>

      <section className={styles.board}>
        <header className={styles.toolbar}>
          <div className={styles.stepper}>
            <button type="button" className={styles.stepButton} aria-label="Semana anterior">
              <ChevronLeftIcon size={14} />
            </button>
            <button type="button" className={styles.stepButton} aria-label="Semana siguiente">
              <ChevronRightIcon size={14} />
            </button>
          </div>
          <h2 className={styles.range}>15 – 20 de septiembre</h2>
          <button type="button" className={styles.today}>
            Hoy
          </button>
          <span className={styles.spacer} />
          <div className={styles.views}>
            {VIEWS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                aria-pressed={option === view}
                className={`${styles.view} ${option === view ? styles.viewActive : ''}`}
              >
                {option}
              </button>
            ))}
          </div>
        </header>

        <WeekGrid onSelect={setSelected} />
      </section>

      {selected ? (
        <AppointmentDrawer
          appointment={selected}
          onClose={() => setSelected(null)}
          onConfirm={() => {
            setSelected(null)
            notify('Cita confirmada. Le avisamos por WhatsApp.')
          }}
        />
      ) : null}
    </div>
  )
}
