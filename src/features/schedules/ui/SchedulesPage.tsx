import { useState } from 'react'
import { Avatar } from '../../../shared/ui/atoms/Avatar'
import { Button } from '../../../shared/ui/atoms/Button'
import { SelectField } from '../../../shared/ui/atoms/Field'
import { Toggle } from '../../../shared/ui/atoms/Toggle'
import {
  CalendarIcon,
  CloseIcon,
  CutleryIcon,
  PlusIcon,
  SunIcon,
  WrenchIcon,
} from '../../../shared/ui/atoms/icons'
import { Card, CardHeader } from '../../../shared/ui/molecules/Card'
import { PROVIDERS, SCHEDULE_BLOCKS, WORK_WEEK } from '../domain/data'
import styles from './SchedulesPage.module.css'

const BLOCK_ICONS = {
  lunch: CutleryIcon,
  event: CalendarIcon,
  holiday: SunIcon,
  maintenance: WrenchIcon,
}

export function SchedulesPage() {
  const [provider, setProvider] = useState(PROVIDERS[0].id)
  const [week, setWeek] = useState(WORK_WEEK)

  const toggleDay = (key: string) =>
    setWeek((current) =>
      current.map((day) => (day.key === key ? { ...day, enabled: !day.enabled } : day)),
    )

  return (
    <div className={styles.layout}>
      <nav className={styles.rail} aria-label="Profesionales">
        <p className={styles.railTitle}>Profesionales</p>
        {PROVIDERS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setProvider(option.id)}
            aria-pressed={option.id === provider}
            className={`${styles.provider} ${option.id === provider ? styles.providerOn : ''}`}
          >
            <Avatar name={option.name} size={30} />
            <span className={styles.providerText}>
              <strong>{option.name}</strong>
              <small>{option.role}</small>
            </span>
          </button>
        ))}
      </nav>

      <div className={styles.main}>
        <Card padded={false}>
          <CardHeader
            title="Horario de trabajo"
            meta="Dra. Mariana Cázares · Sede Polanco"
            actions={
              <span className={styles.duration}>
                <span className={styles.durationLabel}>Duración de cita</span>
                <SelectField options={['30 min', '20 min', '45 min', '60 min']} />
              </span>
            }
          />
          {week.map((day) => (
            <div key={day.key} className={styles.day}>
              <Toggle
                checked={day.enabled}
                label={`Atender los ${day.day.toLowerCase()}`}
                onChange={() => toggleDay(day.key)}
              />
              <span className={`${styles.dayName} ${day.enabled ? '' : styles.dayOff}`}>
                {day.day}
              </span>
              <div className={styles.ranges}>
                {day.enabled ? (
                  <>
                    {day.ranges.map((range) => (
                      <span key={range} className={styles.range}>
                        {range}
                        <CloseIcon size={12} />
                      </span>
                    ))}
                    <button type="button" className={styles.addRange}>
                      <PlusIcon size={12} />
                      Franja
                    </button>
                  </>
                ) : (
                  <span className={styles.closed}>Sin atención</span>
                )}
              </div>
              <span className={styles.capacity}>{day.enabled ? day.capacity : 'Cerrado'}</span>
            </div>
          ))}
        </Card>

        <Card padded={false}>
          <CardHeader
            title="Bloqueos"
            meta="Vacaciones, comidas y ausencias. Ganan sobre el horario de trabajo."
            actions={
              <Button size="sm">
                <PlusIcon size={14} />
                Nuevo bloqueo
              </Button>
            }
          />
          {SCHEDULE_BLOCKS.map((block) => {
            const Icon = BLOCK_ICONS[block.kind]
            return (
              <div key={block.id} className={styles.block}>
                <span className={`${styles.blockIcon} ${styles[block.kind]}`}>
                  <Icon size={15} />
                </span>
                <span className={styles.blockText}>
                  <strong>{block.title}</strong>
                  <small>{block.meta}</small>
                </span>
                <span className={styles.blockRange}>{block.range}</span>
                <span className={styles.blockRepeat}>{block.repeat}</span>
                <button type="button" className={styles.remove} aria-label={`Quitar ${block.title}`}>
                  <CloseIcon size={15} />
                </button>
              </div>
            )
          })}
        </Card>
      </div>
    </div>
  )
}
