import type { ReactNode } from 'react'
import { ReceiptIcon, ShieldCheckIcon, ToothIcon } from '../../../shared/ui/atoms/icons'
import styles from './AuthLayout.module.css'

interface AuthLayoutProps {
  children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
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

      <main className={styles.panel}>{children}</main>
    </div>
  )
}
