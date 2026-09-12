import { Link } from 'react-router-dom'
import { Badge } from '../../../shared/ui/atoms/Badge'
import { Button } from '../../../shared/ui/atoms/Button'
import { AlertIcon, ChevronRightIcon, ReceiptIcon, ShieldCheckIcon, StarIcon } from '../../../shared/ui/atoms/icons'
import { Card, CardHeader } from '../../../shared/ui/molecules/Card'
import { KpiRow } from '../../../shared/ui/molecules/KpiCard'
import { STATUS_LABELS, STATUS_TONES, TODAY } from '../../agenda/domain/data'
import { ALERTS, CASH_BREAKDOWN, DAY_KPIS } from '../domain/data'
import styles from './DashboardPage.module.css'

const ALERT_ICONS = {
  consents: ShieldCheckIcon,
  cfdi: ReceiptIcon,
  reminder: AlertIcon,
  review: StarIcon,
} as const

export function DashboardPage() {
  return (
    <div className={styles.page}>
      <KpiRow items={DAY_KPIS} />

      <div className={styles.columns}>
        <Card padded={false}>
          <CardHeader
            title="Agenda de hoy"
            meta="Martes 16 de septiembre"
            actions={
              <Link to="/agenda" className={styles.link}>
                Ver semana completa
              </Link>
            }
          />
          {TODAY.appointments.map((appointment) => (
            <Link key={appointment.id} to="/agenda" className={styles.row}>
              <span className={styles.time}>{appointment.time}</span>
              <span className={`${styles.keyline} ${styles[appointment.status]}`} />
              <span className={styles.rowText}>
                <strong>{appointment.patient}</strong>
                <small>{appointment.service}</small>
              </span>
              <Badge tone={STATUS_TONES[appointment.status]}>
                {STATUS_LABELS[appointment.status]}
              </Badge>
              <ChevronRightIcon className={styles.chevron} />
            </Link>
          ))}
        </Card>

        <div className={styles.side}>
          <Card padded={false}>
            <CardHeader title="Requiere tu atención" />
            {ALERTS.map((alert) => {
              const Icon = ALERT_ICONS[alert.id as keyof typeof ALERT_ICONS]
              return (
                <Link key={alert.id} to={alert.to} className={styles.alert}>
                  <span className={`${styles.alertIcon} ${styles[alert.tone]}`}>
                    <Icon size={15} />
                  </span>
                  <span className={styles.rowText}>
                    <strong>{alert.title}</strong>
                    <small>{alert.detail}</small>
                  </span>
                </Link>
              )
            })}
          </Card>

          <Card>
            <h2 className={styles.cashTitle}>Corte del día</h2>
            {CASH_BREAKDOWN.map((entry) => (
              <p key={entry.label} className={styles.cashRow}>
                <span>{entry.label}</span>
                <strong>{entry.value}</strong>
              </p>
            ))}
            <hr className={styles.divider} />
            <p className={styles.cashTotal}>
              <span>Total cobrado</span>
              <strong>$18,450.00</strong>
            </p>
            <Button variant="soft" className={styles.cashAction}>
              Cerrar caja del día
            </Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
