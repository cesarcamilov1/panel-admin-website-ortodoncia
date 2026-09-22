import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../../../shared/ui/atoms/Avatar'
import { Button } from '../../../shared/ui/atoms/Button'
import { TextField } from '../../../shared/ui/atoms/Field'
import { ShieldCheckIcon } from '../../../shared/ui/atoms/icons'
import { Card } from '../../../shared/ui/molecules/Card'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import { useAuth } from '../../auth/application/authContext'
import { ROLE_LABELS, authErrorMessage, fullName } from '../../auth/domain/auth'
import styles from './AccountPage.module.css'

export function AccountPage() {
  const navigate = useNavigate()
  const { state, forgotPassword, logoutAll } = useAuth()
  const [passwordEmailSent, setPasswordEmailSent] = useState(false)
  const [passwordRequestPending, setPasswordRequestPending] = useState(false)
  const [passwordRequestError, setPasswordRequestError] = useState<string | null>(null)
  const [logoutAllError, setLogoutAllError] = useState<string | null>(null)

  if (state.status !== 'authenticated') return null
  const { user } = state

  const requestPasswordChange = async () => {
    setPasswordRequestPending(true)
    setPasswordRequestError(null)
    try {
      await forgotPassword(user.email)
      setPasswordEmailSent(true)
    } catch (error) {
      setPasswordRequestError(authErrorMessage(error, 'forgot'))
    } finally {
      setPasswordRequestPending(false)
    }
  }

  const handleLogoutAll = async () => {
    setLogoutAllError(null)
    try {
      await logoutAll()
      navigate('/login', { replace: true })
    } catch (error) {
      setLogoutAllError(authErrorMessage(error, 'session'))
    }
  }

  return (
    <div className={styles.layout}>
      <Card className={styles.main}>
        <h2 className={styles.title}>Perfil profesional</h2>

        <div className={styles.photo}>
          <Avatar name={fullName(user)} size={68} />
        </div>

        <div className={styles.grid}>
          <TextField label="Nombre(s)" value={user.firstName} readOnly />
          <TextField label="Apellidos" value={user.lastName} readOnly />
          <TextField label="Correo" value={user.email} readOnly />
          <TextField label="Rol" value={ROLE_LABELS[user.role]} readOnly />
        </div>

        <p className={styles.hint}>Para cambiar tus datos, contacta al administrador de la clínica.</p>
      </Card>

      <div className={styles.side}>
        <Card>
          <h2 className={styles.title}>Seguridad</h2>
          <div className={styles.mfa}>
            <ShieldCheckIcon size={18} />
            <span className={styles.mfaText}>
              <strong>{user.mfaRequired ? 'Segundo factor activo' : 'Segundo factor no requerido'}</strong>
              <small>
                {user.mfaRequired
                  ? 'Te pediremos un código adicional al iniciar sesión.'
                  : 'Esta cuenta no requiere un segundo factor.'}
              </small>
            </span>
          </div>

          {passwordEmailSent ? (
            <FormAlert tone="success">
              Te enviamos un enlace a {user.email} para cambiar tu contraseña.
            </FormAlert>
          ) : (
            <>
              {passwordRequestError ? <FormAlert tone="error">{passwordRequestError}</FormAlert> : null}
              <Button variant="secondary" onClick={requestPasswordChange} disabled={passwordRequestPending}>
                Cambiar contraseña
              </Button>
            </>
          )}

          <hr className={styles.divider} />
          <p className={styles.sectionLabel}>Sesiones activas</p>
          <div className={styles.session}>
            <span className={styles.sessionText}>
              <strong>Esta sesión</strong>
              <small>Este equipo · activa ahora</small>
            </span>
          </div>
          {logoutAllError ? <FormAlert tone="error">{logoutAllError}</FormAlert> : null}
          <Button variant="danger" onClick={handleLogoutAll}>
            Cerrar sesión en todos los equipos
          </Button>
        </Card>

        <Card>
          <h2 className={styles.title}>Preferencias de avisos</h2>
          <p className={styles.hint}>No hay un endpoint para guardar preferencias personales. No modificamos avisos locales como si se hubieran guardado.</p>
        </Card>
      </div>
    </div>
  )
}
