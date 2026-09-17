import { type FormEvent, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../../../shared/ui/atoms/Button'
import { TextField } from '../../../shared/ui/atoms/Field'
import { EyeIcon, LockIcon } from '../../../shared/ui/atoms/icons'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import { useAuth } from '../application/authContext'
import { forgetDevice, readRememberedDevice, rememberDevice } from '../application/sessionPreference'
import { AUTH_PATHS, authErrorMessage, sanitizeReturnPath, validateEmail, validatePassword } from '../domain/auth'
import { isApiError } from '../../../shared/api/problem'
import { AuthLayout } from './AuthLayout'
import { MfaStep } from './organisms/MfaStep'
import styles from './AuthForm.module.css'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, verifyMfa } = useAuth()

  const [remembered] = useState(() => readRememberedDevice())
  const [email, setEmail] = useState(remembered?.email ?? '')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(Boolean(remembered))
  const [showPassword, setShowPassword] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [retryAfter, setRetryAfter] = useState(0)
  const [challengeToken, setChallengeToken] = useState<string | null>(null)
  const [mfaError, setMfaError] = useState<string | null>(null)
  const [mfaPending, setMfaPending] = useState(false)

  useEffect(() => {
    if (retryAfter <= 0) return
    const timer = setInterval(() => setRetryAfter((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => clearInterval(timer)
  }, [retryAfter])

  const goToDestination = () => {
    const from = (location.state as { from?: unknown } | null)?.from
    navigate(sanitizeReturnPath(from), { replace: true })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const emailValidation = validateEmail(email)
    const passwordValidation = validatePassword(password, { minLength: 1 })
    setEmailError(emailValidation)
    setPasswordError(passwordValidation)
    if (emailValidation || passwordValidation) return

    setFormError(null)
    setPending(true)
    try {
      const result = await login({ email, password })
      if (result.kind === 'mfa') {
        setChallengeToken(result.challengeToken)
        return
      }
      if (remember) rememberDevice(email)
      else forgetDevice()
      goToDestination()
    } catch (error) {
      if (isApiError(error) && error.code === 'RATE_LIMITED') {
        setRetryAfter(error.retryAfterSeconds ?? 60)
      }
      setFormError(authErrorMessage(error, 'login'))
    } finally {
      setPending(false)
    }
  }

  const submitMfa = async (code: string) => {
    if (!challengeToken) return
    setMfaError(null)
    setMfaPending(true)
    try {
      await verifyMfa({ challengeToken, code })
      if (remember) rememberDevice(email)
      else forgetDevice()
      goToDestination()
    } catch (error) {
      setMfaError(authErrorMessage(error, 'mfa'))
    } finally {
      setMfaPending(false)
    }
  }

  if (challengeToken) {
    return (
      <AuthLayout>
        <MfaStep
          pending={mfaPending}
          error={mfaError}
          onSubmit={submitMfa}
          onBack={() => {
            setChallengeToken(null)
            setMfaError(null)
          }}
        />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <form className={styles.form} noValidate onSubmit={submit}>
        <header className={styles.formHeader}>
          <h2 className={styles.formTitle}>Entra a tu consultorio</h2>
          <p className={styles.formLead}>Usa la cuenta que te dio la clínica.</p>
        </header>

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

        <div className={styles.passwordField}>
          <TextField
            label="Contraseña"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
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

        <Link className={styles.forgot} to={AUTH_PATHS.forgot}>
          Olvidé mi contraseña
        </Link>

        <label className={styles.remember}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />
          Mantener la sesión en este equipo
        </label>

        <Button type="submit" className={styles.submit} disabled={pending || retryAfter > 0}>
          {pending ? 'Entrando…' : retryAfter > 0 ? `Espera ${retryAfter}s` : 'Entrar'}
        </Button>

        <p className={styles.mfa}>
          <LockIcon size={18} />
          Para ver expedientes y datos fiscales te pediremos un segundo factor la primera vez del
          día.
        </p>

        <p className={styles.patient}>
          ¿Eres paciente? Agenda tu cita en <a href="#sitio">el sitio de la clínica</a>.
        </p>
      </form>
    </AuthLayout>
  )
}

