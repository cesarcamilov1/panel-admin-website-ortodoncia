import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../../shared/ui/atoms/Button'
import { TextField } from '../../../shared/ui/atoms/Field'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import { isApiError } from '../../../shared/api/problem'
import { useAuth } from '../application/authContext'
import { AUTH_PATHS, authErrorMessage, normalizeEmail, validateEmail } from '../domain/auth'
import { AuthLayout } from './AuthLayout'
import styles from './AuthForm.module.css'

const SUCCESS_MESSAGE =
  'Si el correo está registrado, recibirás las instrucciones en unos minutos. Revisa también tu carpeta de spam.'

export function ForgotPasswordPage() {
  const { forgotPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const [retryAfter, setRetryAfter] = useState(0)

  useEffect(() => {
    if (retryAfter <= 0) return
    const timer = setInterval(() => setRetryAfter((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => clearInterval(timer)
  }, [retryAfter])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const validation = validateEmail(email)
    setEmailError(validation)
    if (validation) return

    setFormError(null)
    setPending(true)
    try {
      await forgotPassword(normalizeEmail(email))
      setSent(true)
    } catch (error) {
      if (isApiError(error) && error.code === 'RATE_LIMITED') {
        setRetryAfter(error.retryAfterSeconds ?? 60)
      }
      setFormError(authErrorMessage(error, 'forgot'))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout>
      <form className={styles.form} noValidate onSubmit={submit}>
        <header className={styles.formHeader}>
          <h2 className={styles.formTitle}>Recupera tu contraseña</h2>
          <p className={styles.formLead}>Te enviaremos instrucciones a tu correo.</p>
        </header>

        {sent ? (
          <FormAlert tone="success">{SUCCESS_MESSAGE}</FormAlert>
        ) : (
          <>
            {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

            <TextField
              label="Correo"
              type="email"
              placeholder="nombre@clinica.mx"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={emailError ?? undefined}
            />

            <Button type="submit" className={styles.submit} disabled={pending || retryAfter > 0}>
              {pending ? 'Enviando…' : retryAfter > 0 ? `Espera ${retryAfter}s` : 'Enviar instrucciones'}
            </Button>
          </>
        )}

        <Link className={styles.forgot} to={AUTH_PATHS.login}>
          Volver al inicio de sesión
        </Link>
      </form>
    </AuthLayout>
  )
}
