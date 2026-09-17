import { type FormEvent, useState } from 'react'
import { Button } from '../../../../shared/ui/atoms/Button'
import { TextField } from '../../../../shared/ui/atoms/Field'
import { FormAlert } from '../../../../shared/ui/molecules/FormAlert'
import { validateMfaCode } from '../../domain/auth'
import styles from '../AuthForm.module.css'

interface MfaStepProps {
  pending: boolean
  error: string | null
  onSubmit: (code: string) => void
  onBack: () => void
}

export function MfaStep({ pending, error, onSubmit, onBack }: MfaStepProps) {
  const [code, setCode] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const validation = validateMfaCode(code)
    setFieldError(validation)
    if (validation) return
    onSubmit(code.trim())
  }

  return (
    <form className={styles.form} noValidate onSubmit={submit}>
      <header className={styles.formHeader}>
        <h2 className={styles.formTitle}>Código de verificación</h2>
        <p className={styles.formLead}>
          Usa el código de tu app de autenticación o un código de respaldo.
        </p>
      </header>

      {error ? <FormAlert tone="error">{error}</FormAlert> : null}

      <TextField
        label="Código"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={64}
        value={code}
        onChange={(event) => setCode(event.target.value)}
        error={fieldError ?? undefined}
      />

      <Button type="submit" className={styles.submit} disabled={pending}>
        {pending ? 'Verificando…' : 'Verificar'}
      </Button>

      <Button type="button" variant="secondary" onClick={onBack} disabled={pending}>
        Volver
      </Button>
    </form>
  )
}
