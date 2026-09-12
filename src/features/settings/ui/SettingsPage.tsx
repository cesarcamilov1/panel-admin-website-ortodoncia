import { Button } from '../../../shared/ui/atoms/Button'
import {
  ClockIcon,
  DatabaseIcon,
  CodeIcon,
  PinIcon,
  ReceiptIcon,
  UsersIcon,
} from '../../../shared/ui/atoms/icons'
import { Card } from '../../../shared/ui/molecules/Card'
import { SETTINGS_GROUPS } from '../domain/data'
import styles from './SettingsPage.module.css'

const GROUP_ICONS = {
  sedes: PinIcon,
  emisor: ReceiptIcon,
  politicas: ClockIcon,
  usuarios: UsersIcon,
  integraciones: CodeIcon,
  respaldos: DatabaseIcon,
}

export function SettingsPage() {
  return (
    <div className={styles.grid}>
      {SETTINGS_GROUPS.map((group) => {
        const Icon = GROUP_ICONS[group.id]
        return (
          <Card key={group.id}>
            <header className={styles.header}>
              <span className={`${styles.icon} ${styles[group.id]}`}>
                <Icon size={17} />
              </span>
              <span className={styles.headerText}>
                <strong>{group.title}</strong>
                <small>{group.detail}</small>
              </span>
            </header>

            <div className={styles.rows}>
              {group.rows.map((row) => (
                <p key={row.label} className={styles.row}>
                  <span className={styles.rowLabel}>{row.label}</span>
                  <span className={`${styles.rowValue} ${row.tone ? styles[row.tone] : ''}`}>
                    {row.value}
                  </span>
                </p>
              ))}
            </div>

            <Button variant="link">{group.action}</Button>
          </Card>
        )
      })}
    </div>
  )
}
