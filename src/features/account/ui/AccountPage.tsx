import { useState } from 'react'
import { Avatar } from '../../../shared/ui/atoms/Avatar'
import { Button } from '../../../shared/ui/atoms/Button'
import { TextArea, TextField } from '../../../shared/ui/atoms/Field'
import { Toggle } from '../../../shared/ui/atoms/Toggle'
import { ShieldCheckIcon } from '../../../shared/ui/atoms/icons'
import { Card } from '../../../shared/ui/molecules/Card'
import { NOTIFICATION_PREFS, PROFILE_FIELDS, SESSIONS } from '../domain/data'
import styles from './AccountPage.module.css'

export function AccountPage() {
  const [prefs, setPrefs] = useState(NOTIFICATION_PREFS)

  const toggle = (key: string) =>
    setPrefs((current) =>
      current.map((pref) => (pref.key === key ? { ...pref, enabled: !pref.enabled } : pref)),
    )

  return (
    <div className={styles.layout}>
      <Card className={styles.main}>
        <h2 className={styles.title}>Perfil profesional</h2>

        <div className={styles.photo}>
          <Avatar name="Mariana Cázares" size={68} />
          <div className={styles.photoActions}>
            <Button variant="secondary" size="sm">
              Cambiar foto
            </Button>
            <p className={styles.hint}>JPG o PNG, mínimo 400 × 400 px.</p>
          </div>
        </div>

        <div className={styles.grid}>
          {PROFILE_FIELDS.map((field) => (
            <TextField key={field.label} label={field.label} defaultValue={field.value} />
          ))}
        </div>

        <TextArea
          label="Presentación pública"
          defaultValue="Odontóloga general con 14 años de práctica. Rehabilitación y odontología mínimamente invasiva."
        />

        <div className={styles.signature}>
          <div className={styles.signatureText}>
            <strong>Firma digital para recetas y notas</strong>
            <small>Vigente hasta el 30 de junio de 2027</small>
          </div>
          <svg className={styles.signatureMark} viewBox="0 0 120 40" aria-hidden>
            <path d="M6 28c8-2 10-14 14-14s2 16 8 16 8-20 14-20 4 22 10 22 7-14 12-14 5 8 10 8 8-4 12-8" />
          </svg>
          <Button variant="secondary" size="sm">
            Reemplazar
          </Button>
        </div>

        <Button className={styles.save}>Guardar perfil</Button>
      </Card>

      <div className={styles.side}>
        <Card>
          <h2 className={styles.title}>Seguridad</h2>
          <div className={styles.mfa}>
            <ShieldCheckIcon size={18} />
            <span className={styles.mfaText}>
              <strong>Segundo factor activo</strong>
              <small>App de autenticación · 3 códigos de respaldo sin usar</small>
            </span>
          </div>
          <Button variant="secondary">Cambiar contraseña</Button>
          <hr className={styles.divider} />
          <p className={styles.sectionLabel}>Sesiones activas</p>
          {SESSIONS.map((session) => (
            <div key={session.device} className={styles.session}>
              <span className={styles.sessionText}>
                <strong>{session.device}</strong>
                <small>{session.meta}</small>
              </span>
              {session.current ? (
                <span className={styles.current}>Esta sesión</span>
              ) : (
                <Button variant="link">Cerrar</Button>
              )}
            </div>
          ))}
        </Card>

        <Card>
          <h2 className={styles.title}>Avisos que quiero recibir</h2>
          {prefs.map((pref) => (
            <div key={pref.key} className={styles.pref}>
              <Toggle checked={pref.enabled} label={pref.label} onChange={() => toggle(pref.key)} />
              <span className={styles.prefLabel}>{pref.label}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
