import { type FormEvent, useEffect, useState } from 'react'
import { Button } from '../../../../shared/ui/atoms/Button'
import { SelectField, TextField } from '../../../../shared/ui/atoms/Field'
import { CloseIcon } from '../../../../shared/ui/atoms/icons'
import { FormAlert } from '../../../../shared/ui/molecules/FormAlert'
import type { PracticeLocation } from '../../../locations/domain/location'
import { CLINIC_TIMEZONE } from '../../domain/clinicTime'
import {
  type IntervalWeeks,
  type Weekday,
  type WorkScheduleDraft,
  type WorkScheduleDraftErrors,
  WEEKDAYS,
  intervalLabel,
  scheduleErrorMessage,
  validateWorkScheduleDraft,
} from '../../domain/workSchedule'
import styles from './WorkScheduleModal.module.css'

/** No selection means the server resolves the provider's default location. */
const NO_LOCATION = 'Sede principal'

function todayCivilDate(): string {
  // `en-CA` renders as `YYYY-MM-DD`, the same trick `clinicTime.ts` uses for wall-clock reads.
  return new Intl.DateTimeFormat('en-CA', { timeZone: CLINIC_TIMEZONE }).format(new Date())
}

function emptyDraft(weekday: Weekday): WorkScheduleDraft {
  return {
    weekday,
    startLocalTime: '',
    endLocalTime: '',
    effectiveFrom: todayCivilDate(),
    effectiveTo: '',
    intervalWeeks: 1,
    locationId: '',
    isActive: true,
  }
}

interface WorkScheduleModalProps {
  /** Prefilled from the day whose "add range" control opened this dialog. */
  weekday?: Weekday
  locations: PracticeLocation[]
  onClose: () => void
  onSubmit: (draft: WorkScheduleDraft) => Promise<void>
}

export function WorkScheduleModal({
  weekday = 1,
  locations,
  onClose,
  onSubmit,
}: WorkScheduleModalProps) {
  const [draft, setDraft] = useState<WorkScheduleDraft>(() => emptyDraft(weekday))
  const [errors, setErrors] = useState<WorkScheduleDraftErrors>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const patch = <Key extends keyof WorkScheduleDraft>(key: Key, value: WorkScheduleDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const weekdayOptionLabel =
    WEEKDAYS.find((option) => option.value === draft.weekday)?.label ?? WEEKDAYS[0].label
  const locationOptions = [
    { value: '', label: NO_LOCATION },
    ...locations.map((location) => ({ value: location.id, label: location.name })),
  ]

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const found = validateWorkScheduleDraft(draft)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      setBanner(null)
      return
    }

    setSaving(true)
    setBanner(null)
    try {
      await onSubmit(draft)
    } catch (error) {
      setBanner(scheduleErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.scrim} role="dialog" aria-modal="true" aria-label="Nueva franja de horario">
      <form className={styles.modal} onSubmit={handleSubmit} noValidate>
        <header className={styles.header}>
          <h2 className={styles.title}>Nueva franja de horario</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
            <CloseIcon />
          </button>
        </header>

        <div className={styles.body}>
          {banner ? <FormAlert tone="error">{banner}</FormAlert> : null}

          <SelectField
            label="Día de la semana"
            options={WEEKDAYS.map((option) => option.label)}
            value={weekdayOptionLabel}
            error={errors.weekday}
            onChange={(event) => {
              const found = WEEKDAYS.find((option) => option.label === event.target.value)
              if (found) patch('weekday', found.value)
            }}
          />

          <div className={styles.pair}>
            <TextField
              label="Hora de inicio"
              type="time"
              value={draft.startLocalTime}
              error={errors.startLocalTime}
              onChange={(event) => patch('startLocalTime', event.target.value)}
            />
            <TextField
              label="Hora de fin"
              type="time"
              value={draft.endLocalTime}
              error={errors.endLocalTime}
              onChange={(event) => patch('endLocalTime', event.target.value)}
            />
          </div>

          <div className={styles.pair}>
            <TextField
              label="Vigente desde"
              type="date"
              value={draft.effectiveFrom}
              error={errors.effectiveFrom}
              onChange={(event) => patch('effectiveFrom', event.target.value)}
            />
            <TextField
              label="Vigente hasta"
              type="date"
              value={draft.effectiveTo}
              error={errors.effectiveTo}
              hint="Opcional: vacío significa sin fecha de término."
              onChange={(event) => patch('effectiveTo', event.target.value)}
            />
          </div>

          <SelectField
            label="Repetición"
            options={[intervalLabel(1), intervalLabel(2)]}
            value={intervalLabel(draft.intervalWeeks)}
            onChange={(event) => {
              const next: IntervalWeeks = event.target.value === intervalLabel(2) ? 2 : 1
              patch('intervalWeeks', next)
            }}
          />

          <SelectField
            label="Sede"
            options={locationOptions}
            value={draft.locationId}
            hint="Sede principal usa la sede predeterminada del profesional."
            onChange={(event) => patch('locationId', event.target.value)}
          />
        </div>

        <footer className={styles.footer}>
          <span className={styles.spacer} />
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Crear franja'}
          </Button>
        </footer>
      </form>
    </div>
  )
}
