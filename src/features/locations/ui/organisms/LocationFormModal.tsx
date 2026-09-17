import { type FormEvent, useEffect, useState } from 'react'
import { Button } from '../../../../shared/ui/atoms/Button'
import { TextField } from '../../../../shared/ui/atoms/Field'
import { CloseIcon } from '../../../../shared/ui/atoms/icons'
import { Badge } from '../../../../shared/ui/atoms/Badge'
import { FormAlert } from '../../../../shared/ui/molecules/FormAlert'
import { isApiError } from '../../../../shared/api/problem'
import {
  type LocationDraft,
  type LocationDraftErrors,
  type PracticeLocation,
  TRAVEL_BUFFER_MAX_MINUTES,
  fromPracticeLocation,
  locationErrorMessage,
  validateLocationDraft,
} from '../../domain/location'
import styles from './LocationFormModal.module.css'

const EMPTY_DRAFT: LocationDraft = { name: '', address: '', travelBufferMinutes: 0 }

const FIELD_BY_SERVER_NAME: Record<string, keyof LocationDraft> = {
  name: 'name',
  address: 'address',
  travel_buffer_minutes: 'travelBufferMinutes',
  location: 'name',
}

interface LocationFormModalProps {
  location?: PracticeLocation
  onClose: () => void
  onSubmit: (draft: LocationDraft) => Promise<void>
}

export function LocationFormModal({ location, onClose, onSubmit }: LocationFormModalProps) {
  const editing = location !== undefined
  const [draft, setDraft] = useState<LocationDraft>(() =>
    location ? fromPracticeLocation(location) : EMPTY_DRAFT,
  )
  const [errors, setErrors] = useState<LocationDraftErrors>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const patch = <Key extends keyof LocationDraft>(key: Key, value: LocationDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const found = validateLocationDraft(draft)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      setBanner(null)
      return
    }

    setSaving(true)
    setBanner(null)
    try {
      await onSubmit({
        name: draft.name.trim(),
        address: draft.address.trim(),
        travelBufferMinutes: draft.travelBufferMinutes,
      })
    } catch (error) {
      const serverErrors: LocationDraftErrors = {}
      if (isApiError(error) && error.fields) {
        for (const field of error.fields) {
          const key = FIELD_BY_SERVER_NAME[field.field]
          if (key) serverErrors[key] = field.message
        }
      }
      setErrors(serverErrors)
      if (Object.keys(serverErrors).length === 0) setBanner(locationErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const title = editing ? 'Editar sede' : 'Nueva sede'

  return (
    <div className={styles.scrim} role="dialog" aria-modal="true" aria-label={title}>
      <form className={styles.modal} onSubmit={handleSubmit} noValidate>
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          {location?.isDefault ? <Badge tone="info">Sede principal</Badge> : null}
          <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
            <CloseIcon />
          </button>
        </header>

        <div className={styles.body}>
          {banner ? <FormAlert tone="error">{banner}</FormAlert> : null}

          {editing ? null : (
            <FormAlert tone="info">
              Una sede nueva nace sin servicios habilitados: no se podrá agendar en ella hasta que
              elijas qué servicios ofrece.
            </FormAlert>
          )}

          <TextField
            label="Nombre de la sede"
            value={draft.name}
            error={errors.name}
            autoComplete="off"
            placeholder="Sede Polanco"
            onChange={(event) => patch('name', event.target.value)}
          />

          <TextField
            label="Dirección"
            value={draft.address}
            error={errors.address}
            autoComplete="off"
            placeholder="Opcional"
            onChange={(event) => patch('address', event.target.value)}
          />

          <TextField
            label="Margen de traslado (minutos)"
            type="number"
            inputMode="numeric"
            min={0}
            max={TRAVEL_BUFFER_MAX_MINUTES}
            value={String(draft.travelBufferMinutes)}
            error={errors.travelBufferMinutes}
            hint="Tiempo que te dejamos libre para llegar a esta sede. 0 si no hace falta."
            onChange={(event) => patch('travelBufferMinutes', Number(event.target.value))}
          />
        </div>

        <footer className={styles.footer}>
          <span className={styles.spacer} />
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear sede'}
          </Button>
        </footer>
      </form>
    </div>
  )
}
