import { type FormEvent, useEffect, useState } from 'react'
import { isApiError } from '../../../../shared/api/problem'
import { Button } from '../../../../shared/ui/atoms/Button'
import { SelectField, TextArea, TextField } from '../../../../shared/ui/atoms/Field'
import { CloseIcon } from '../../../../shared/ui/atoms/icons'
import { FormAlert } from '../../../../shared/ui/molecules/FormAlert'
import {
  EMPTY_PATIENT_DRAFT,
  type Patient,
  type PatientDraft,
  type PatientDraftErrors,
  fromPatient,
  patientErrorMessage,
  validatePatientDraft,
} from '../../domain/patient'
import styles from './PatientFormModal.module.css'

const FIELD_BY_SERVER_NAME: Record<string, keyof PatientDraft> = {
  first_name: 'firstName', middle_name: 'middleName', last_name: 'lastName',
  second_last_name: 'secondLastName', preferred_name: 'preferredName', birth_date: 'birthDate',
  sex_at_birth: 'sexAtBirth', phone_e164: 'phoneE164', email: 'email', occupation: 'occupation',
  status: 'status', notes: 'notes',
}

interface PatientFormModalProps {
  patient?: Patient
  onClose: () => void
  onSubmit: (draft: PatientDraft) => Promise<void>
}

export function PatientFormModal({ patient, onClose, onSubmit }: PatientFormModalProps) {
  const editing = patient !== undefined
  const [draft, setDraft] = useState<PatientDraft>(() => patient ? fromPatient(patient) : EMPTY_PATIENT_DRAFT)
  const [errors, setErrors] = useState<PatientDraftErrors>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, saving])

  const patch = <Key extends keyof PatientDraft>(key: Key, value: PatientDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const nextErrors = validatePatientDraft(draft)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    setBanner(null)
    try {
      await onSubmit({
        ...draft,
        firstName: draft.firstName.trim(), lastName: draft.lastName.trim(), phoneE164: draft.phoneE164.trim(),
      })
    } catch (error) {
      const serverErrors: PatientDraftErrors = {}
      if (isApiError(error)) {
        for (const field of error.fields ?? []) {
          const key = FIELD_BY_SERVER_NAME[field.field]
          if (key) serverErrors[key] = field.message
        }
      }
      setErrors(serverErrors)
      if (Object.keys(serverErrors).length === 0) setBanner(patientErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const title = editing ? 'Editar paciente' : 'Nuevo paciente'
  return (
    <div className={styles.scrim} role="dialog" aria-modal="true" aria-label={title}>
      <form className={styles.modal} onSubmit={submit} noValidate>
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} disabled={saving} aria-label="Cerrar">
            <CloseIcon />
          </button>
        </header>
        <div className={styles.body}>
          {banner ? <FormAlert tone="error">{banner}</FormAlert> : null}
          <div className={styles.pair}>
            <TextField label="Nombre" autoComplete="given-name" value={draft.firstName} error={errors.firstName} onChange={(event) => patch('firstName', event.target.value)} />
            <TextField label="Segundo nombre" autoComplete="additional-name" value={draft.middleName} error={errors.middleName} onChange={(event) => patch('middleName', event.target.value)} />
          </div>
          <div className={styles.pair}>
            <TextField label="Primer apellido" autoComplete="family-name" value={draft.lastName} error={errors.lastName} onChange={(event) => patch('lastName', event.target.value)} />
            <TextField label="Segundo apellido" value={draft.secondLastName} error={errors.secondLastName} onChange={(event) => patch('secondLastName', event.target.value)} />
          </div>
          <div className={styles.pair}>
            <TextField label="Nombre preferido" value={draft.preferredName} error={errors.preferredName} onChange={(event) => patch('preferredName', event.target.value)} />
            <TextField label="Fecha de nacimiento" type="date" value={draft.birthDate} error={errors.birthDate} onChange={(event) => patch('birthDate', event.target.value)} />
          </div>
          <div className={styles.pair}>
            <TextField label="Teléfono" autoComplete="tel" inputMode="tel" placeholder="+525512345678" value={draft.phoneE164} error={errors.phoneE164} onChange={(event) => patch('phoneE164', event.target.value)} />
            <TextField label="Correo" type="email" autoComplete="email" value={draft.email} error={errors.email} onChange={(event) => patch('email', event.target.value)} />
          </div>
          <div className={styles.pair}>
            <SelectField label="Sexo al nacer" value={draft.sexAtBirth} error={errors.sexAtBirth} onChange={(event) => patch('sexAtBirth', event.target.value as PatientDraft['sexAtBirth'])} options={[
              { value: '', label: 'No especificado' }, { value: 'FEMALE', label: 'Femenino' },
              { value: 'MALE', label: 'Masculino' }, { value: 'INTERSEX', label: 'Intersexual' },
              { value: 'UNSPECIFIED', label: 'Sin especificar' },
            ]} />
            <SelectField label="Estado" value={draft.status} error={errors.status} onChange={(event) => patch('status', event.target.value as PatientDraft['status'])} options={[
              { value: 'ACTIVE', label: 'Activo' }, { value: 'INACTIVE', label: 'Inactivo' }, { value: 'DECEASED', label: 'Fallecido' },
            ]} />
          </div>
          <TextField label="Ocupación" value={draft.occupation} error={errors.occupation} onChange={(event) => patch('occupation', event.target.value)} />
          <TextArea label="Notas administrativas" rows={3} value={draft.notes} error={errors.notes} onChange={(event) => patch('notes', event.target.value)} />
        </div>
        <footer className={styles.footer}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear paciente'}</Button>
        </footer>
      </form>
    </div>
  )
}
