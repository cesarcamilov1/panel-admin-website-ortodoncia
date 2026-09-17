import { type FormEvent, useEffect, useState } from 'react'
import { Button } from '../../../../shared/ui/atoms/Button'
import { SelectField, TextArea, TextField } from '../../../../shared/ui/atoms/Field'
import { CloseIcon } from '../../../../shared/ui/atoms/icons'
import { FormAlert } from '../../../../shared/ui/molecules/FormAlert'
import type { PracticeLocation } from '../../../locations/domain/location'
import {
  BLOCK_TYPES,
  BLOCK_TYPE_LABELS,
  REASON_MAX_LENGTH,
  type BlockType,
  type ScheduleBlockDraft,
  type ScheduleBlockDraftErrors,
  blockErrorMessage,
  validateScheduleBlockDraft,
} from '../../domain/scheduleBlock'
import styles from './ScheduleBlockModal.module.css'

/** No selection means the server resolves the provider's default location. */
const NO_LOCATION = 'Sede principal'

const EMPTY_DRAFT: ScheduleBlockDraft = {
  blockType: 'PERSONAL',
  startsAt: '',
  endsAt: '',
  reason: '',
  locationId: '',
}

interface ScheduleBlockModalProps {
  locations: PracticeLocation[]
  onClose: () => void
  onSubmit: (draft: ScheduleBlockDraft) => Promise<void>
}

export function ScheduleBlockModal({ locations, onClose, onSubmit }: ScheduleBlockModalProps) {
  const [draft, setDraft] = useState<ScheduleBlockDraft>(EMPTY_DRAFT)
  const [errors, setErrors] = useState<ScheduleBlockDraftErrors>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const patch = <Key extends keyof ScheduleBlockDraft>(key: Key, value: ScheduleBlockDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const locationOptionLabel = draft.locationId
    ? (locations.find((location) => location.id === draft.locationId)?.name ?? NO_LOCATION)
    : NO_LOCATION

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const found = validateScheduleBlockDraft(draft)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      setBanner(null)
      return
    }

    setSaving(true)
    setBanner(null)
    try {
      await onSubmit({ ...draft, reason: draft.reason.trim() })
    } catch (error) {
      setBanner(blockErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.scrim} role="dialog" aria-modal="true" aria-label="Nuevo bloqueo">
      <form className={styles.modal} onSubmit={handleSubmit} noValidate>
        <header className={styles.header}>
          <h2 className={styles.title}>Nuevo bloqueo</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
            <CloseIcon />
          </button>
        </header>

        <div className={styles.body}>
          {banner ? <FormAlert tone="error">{banner}</FormAlert> : null}

          <SelectField
            label="Tipo de bloqueo"
            options={BLOCK_TYPES.map((type) => BLOCK_TYPE_LABELS[type])}
            value={BLOCK_TYPE_LABELS[draft.blockType]}
            onChange={(event) => {
              const found = BLOCK_TYPES.find((type) => BLOCK_TYPE_LABELS[type] === event.target.value)
              patch('blockType', found ?? ('OTHER' as BlockType))
            }}
          />

          <div className={styles.pair}>
            <TextField
              label="Inicio"
              type="datetime-local"
              value={draft.startsAt}
              error={errors.startsAt}
              onChange={(event) => patch('startsAt', event.target.value)}
            />
            <TextField
              label="Fin"
              type="datetime-local"
              value={draft.endsAt}
              error={errors.endsAt}
              onChange={(event) => patch('endsAt', event.target.value)}
            />
          </div>

          <TextArea
            label="Motivo"
            value={draft.reason}
            error={errors.reason}
            maxLength={REASON_MAX_LENGTH}
            hint="Opcional."
            rows={3}
            onChange={(event) => patch('reason', event.target.value)}
          />

          <SelectField
            label="Sede"
            options={[NO_LOCATION, ...locations.map((location) => location.name)]}
            value={locationOptionLabel}
            hint="Sede principal usa la sede predeterminada del profesional."
            onChange={(event) => {
              const found = locations.find((location) => location.name === event.target.value)
              patch('locationId', found ? found.id : '')
            }}
          />
        </div>

        <footer className={styles.footer}>
          <span className={styles.spacer} />
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Crear bloqueo'}
          </Button>
        </footer>
      </form>
    </div>
  )
}
