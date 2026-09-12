import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../shared/ui/atoms/Button'
import { TextField } from '../../../shared/ui/atoms/Field'
import { EyeIcon, LockIcon, ReceiptIcon, ShieldCheckIcon, ToothIcon } from '../../../shared/ui/atoms/icons'
import styles from './LoginPage.module.css'

export function LoginPage() {
  const navigate = useNavigate()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    navigate('/')
  }

  return (
    <div className={styles.page}>
      <aside className={styles.brand}>
        <div className={styles.brandMark}>
          <ToothIcon size={26} />
          <span>Consultorio</span>
        </div>

        <div className={styles.pitch}>
          <h1 className={styles.headline}>Toda la clínica en una sola pantalla.</h1>
          <p className={styles.lead}>
            Agenda, expedientes, odontogramas, cobros y facturación con el mismo expediente clínico.
          </p>
        </div>

        <ul className={styles.points}>
          <li>
            <ShieldCheckIcon size={17} />
            Expediente cifrado y bitácora de acceso por usuario
          </li>
          <li>
            <ReceiptIcon size={17} />
            CFDI 4.0 timbrado desde el mismo cobro
          </li>
        </ul>
      </aside>

      <main className={styles.panel}>
        <form className={styles.form} onSubmit={submit}>
          <header className={styles.formHeader}>
            <h2 className={styles.formTitle}>Entra a tu consultorio</h2>
            <p className={styles.formLead}>Usa la cuenta que te dio la clínica.</p>
          </header>

          <TextField label="Correo" type="email" placeholder="nombre@clinica.mx" autoComplete="email" />

          <div className={styles.passwordField}>
            <TextField
              label="Contraseña"
              type="password"
              defaultValue="············"
              autoComplete="current-password"
            />
            <button type="button" className={styles.reveal} aria-label="Mostrar contraseña">
              <EyeIcon />
            </button>
          </div>

          <a className={styles.forgot} href="#recuperar">
            Olvidé mi contraseña
          </a>

          <label className={styles.remember}>
            <input type="checkbox" />
            Mantener la sesión en este equipo
          </label>

          <Button type="submit" className={styles.submit}>
            Entrar
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
      </main>
    </div>
  )
}
