import { type FormEvent, useEffect, useState } from 'react'
import { Button } from '../../../../shared/ui/atoms/Button'
import { TextArea, TextField } from '../../../../shared/ui/atoms/Field'
import { Toggle } from '../../../../shared/ui/atoms/Toggle'
import { CloseIcon } from '../../../../shared/ui/atoms/icons'
import { FormAlert } from '../../../../shared/ui/molecules/FormAlert'
import { isApiError } from '../../../../shared/api/problem'
import {
  type CatalogService,
  type ServiceDraft,
  type ServiceDraftErrors,
  DURATION_MAX_MINUTES,
  DURATION_MIN_MINUTES,
  DURATION_STEP_MINUTES,
  fromCatalogService,
  serviceErrorMessage,
  validateServiceDraft,
} from '../../domain/service'
import styles from './ServiceFormModal.module.css'

const EMPTY_DRAFT: ServiceDraft = {
  code: '',
  name: '',
  description: '',
  durationMinutes: 30,
  defaultPrice: '',
  isActive: true,
}

/** Server field names map onto draft keys; anything else stays in the banner. */
const FIELD_BY_SERVER_NAME: Record<string, keyof ServiceDraft> = {
  code: 'code',
  name: 'name',
  description: 'description',
  duration_minutes: 'durationMinutes',
  default_price: 'defaultPrice',
  is_active: 'isActive',
}

interface ServiceFormModalProps {
  service?: CatalogService
  onClose: () => void
  onSubmit: (draft: ServiceDraft) => Promise<void>
}

export function ServiceFormModal({ service, onClose, onSubmit }: ServiceFormModalProps) {
  const editing = service !== undefined
  const [draft, setDraft] = useState<ServiceDraft>(() =>
    service ? fromCatalogService(service) : EMPTY_DRAFT,
  )
  const [errors, setErrors] = useState<ServiceDraftErrors>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const patch = <Key extends keyof ServiceDraft>(key: Key, value: ServiceDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const found = validateServiceDraft(draft)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      setBanner(null)
      return
    }

    setSaving(true)
    setBanner(null)
    try {
      await onSubmit({
        ...draft,
        code: draft.code.trim(),
        name: draft.name.trim(),
        description: draft.description.trim(),
        defaultPrice: draft.defaultPrice.trim(),
      })
    } catch (error) {
      const serverErrors: ServiceDraftErrors = {}
      if (isApiError(error) && error.fields) {
        for (const field of error.fields) {
          const key = FIELD_BY_SERVER_NAME[field.field]
          if (key) serverErrors[key] = field.message
        }
      }
      setErrors(serverErrors)
      if (Object.keys(serverErrors).length === 0) setBanner(serviceErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const title = editing ? 'Editar servicio' : 'Nuevo servicio'
  const action = editing ? 'Guardar cambios' : 'Crear servicio'

  return (
    <div className={styles.scrim} role="dialog" aria-modal="true" aria-label={title}>
      <form className={styles.modal} onSubmit={handleSubmit} noValidate>
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
            <CloseIcon />
          </button>
        </header>

        <div className={styles.body}>
          {banner ? <FormAlert tone="error">{banner}</FormAlert> : null}

          <div className={styles.pair}>
            <TextField
              label="Código"
              value={draft.code}
              error={errors.code}
              autoComplete="off"
              hint="Mayúsculas, números, guion o guion bajo."
              onChange={(event) => patch('code', event.target.value.toUpperCase())}
            />
            <TextField
              label="Nombre"
              value={draft.name}
              error={errors.name}
              autoComplete="off"
              onChange={(event) => patch('name', event.target.value)}
            />
          </div>

          <TextArea
            label="Descripción"
            value={draft.description}
            error={errors.description}
            rows={2}
            placeholder="Qué incluye el servicio. Opcional."
            onChange={(event) => patch('description', event.target.value)}
          />

          <div className={styles.pair}>
            <TextField
              label="Duración (minutos)"
              type="number"
              inputMode="numeric"
              min={DURATION_MIN_MINUTES}
              max={DURATION_MAX_MINUTES}
              step={DURATION_STEP_MINUTES}
              value={String(draft.durationMinutes)}
              error={errors.durationMinutes}
              hint={`De ${DURATION_MIN_MINUTES} a ${DURATION_MAX_MINUTES}, en pasos de ${DURATION_STEP_MINUTES}.`}
              onChange={(event) => patch('durationMinutes', Number(event.target.value))}
            />
            <TextField
              label="Precio (MXN)"
              inputMode="decimal"
              autoComplete="off"
              placeholder="850.00"
              value={draft.defaultPrice}
              error={errors.defaultPrice}
              hint="Sin separador de miles. Punto decimal."
              onChange={(event) => patch('defaultPrice', event.target.value)}
            />
          </div>

          <div className={styles.availability}>
            <Toggle
              checked={draft.isActive}
              label="Disponible para agendar"
              onChange={() => patch('isActive', !draft.isActive)}
            />
            <span>
              {draft.isActive
                ? 'Disponible para agendar citas nuevas.'
                : 'En pausa: no aparece al agendar. Las citas ya hechas no cambian.'}
            </span>
          </div>
        </div>

        <footer className={styles.footer}>
          <span className={styles.spacer} />
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : action}
          </Button>
        </footer>
      </form>
    </div>
  )
}
