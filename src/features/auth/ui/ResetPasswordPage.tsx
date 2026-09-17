import { type FormEvent, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Button } from '../../../shared/ui/atoms/Button'
import { TextField } from '../../../shared/ui/atoms/Field'
import { EyeIcon } from '../../../shared/ui/atoms/icons'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import { useAuth } from '../application/authContext'
import {
  AUTH_PATHS,
  PASSWORD_MIN_LENGTH,
  authErrorMessage,
  readResetTokenFromHash,
  validatePassword,
  validatePasswordConfirmation,
} from '../domain/auth'
import { AuthLayout } from './AuthLayout'
import { SessionLoading } from './SessionLoading'
import styles from './AuthForm.module.css'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const { state, resetPassword } = useAuth()
  const [token] = useState(() => readResetTokenFromHash(window.location.hash))
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmationError, setConfirmationError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    // Runs once on mount, before render settles, to avoid leaving the token in history.
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [])

  if (!token) {
    if (state.status === 'loading') return <SessionLoading />
    if (state.status === 'authenticated') return <Navigate to="/" replace />

    return (
      <AuthLayout>
        <div className={styles.form}>
          <header className={styles.formHeader}>
            <h2 className={styles.formTitle}>Enlace no válido</h2>
          </header>
          <FormAlert tone="error">El enlace no es válido o está incompleto.</FormAlert>
          <Link className={styles.forgot} to={AUTH_PATHS.forgot}>
            Solicitar un enlace de recuperación
          </Link>
        </div>
      </AuthLayout>
    )
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const passwordValidation = validatePassword(password, { minLength: PASSWORD_MIN_LENGTH })
    const confirmationValidation = passwordValidation
      ? null
      : validatePasswordConfirmation(password, confirmation)
    setPasswordError(passwordValidation)
    setConfirmationError(confirmationValidation)
    if (passwordValidation || confirmationValidation) return

    setFormError(null)
    setPending(true)
    try {
      await resetPassword({ token, newPassword: password })
      setDone(true)
    } catch (error) {
      setFormError(authErrorMessage(error, 'reset'))
    } finally {
      setPending(false)
    }
  }

  if (done) {
    return (
      <AuthLayout>
        <div className={styles.form}>
          <header className={styles.formHeader}>
            <h2 className={styles.formTitle}>Contraseña actualizada</h2>
          </header>
          <FormAlert tone="success">
            Tu contraseña se actualizó. Inicia sesión con la nueva contraseña.
          </FormAlert>
          <Button type="button" className={styles.submit} onClick={() => navigate(AUTH_PATHS.login, { replace: true })}>
            Ir a iniciar sesión
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <form className={styles.form} noValidate onSubmit={submit}>
        <header className={styles.formHeader}>
          <h2 className={styles.formTitle}>Crea una nueva contraseña</h2>
        </header>

        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

        <div className={styles.passwordField}>
          <TextField
            label="Nueva contraseña"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            hint="Mínimo 12 caracteres."
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={passwordError ?? undefined}
          />
          <button
            type="button"
            className={styles.reveal}
            aria-pressed={showPassword}
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            onClick={() => setShowPassword((value) => !value)}
          >
            <EyeIcon />
          </button>
        </div>

        <TextField
          label="Confirmar contraseña"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          error={confirmationError ?? undefined}
        />

        <Button type="submit" className={styles.submit} disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar contraseña'}
        </Button>
      </form>
    </AuthLayout>
  )
}
