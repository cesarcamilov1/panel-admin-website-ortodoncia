import { Button } from '../../../../shared/ui/atoms/Button'
import { ChevronRightIcon, ClockIcon } from '../../../../shared/ui/atoms/icons'
import { Card, CardHeader } from '../../../../shared/ui/molecules/Card'
import { MEDICAL_HISTORY, RECORD_PENDING, TIMELINE } from '../../domain/data'
import type { RecordTabId } from '../recordTabs'
import styles from './tabs.module.css'

interface SummaryTabProps {
  onGoToTab: (tab: RecordTabId) => void
}

export function SummaryTab({ onGoToTab }: SummaryTabProps) {
  return (
    <div className={styles.split}>
      <div className={styles.main}>
        <Card>
          <h2 className={styles.title}>Historia médica</h2>
          <div className={styles.grid2}>
            {MEDICAL_HISTORY.map((fact) => (
              <div key={fact.label} className={styles.fact}>
                <span className={styles.factLabel}>{fact.label}</span>
                <span className={`${styles.factValue} ${fact.critical ? styles.critical : ''}`}>
                  {fact.value}
                </span>
              </div>
            ))}
          </div>
          <p className={styles.subtle}>
            <ClockIcon size={14} /> Actualizada el 4 de septiembre por Dra. Mariana Cázares
          </p>
        </Card>

        <Card padded={false}>
          <CardHeader title="Línea de tiempo" />
          {TIMELINE.map((entry) => (
            <div key={`${entry.date}-${entry.title}`} className={styles.row}>
              <span className={styles.timelineDate}>{entry.date}</span>
              <span className={`${styles.dot} ${styles[entry.tone]}`} />
              <span className={styles.rowText}>
                <strong>{entry.title}</strong>
                <small>{entry.detail}</small>
              </span>
            </div>
          ))}
        </Card>
      </div>

      <div className={styles.side}>
        <Card>
          <h2 className={styles.title}>Estado de cuenta</h2>
          <span className={styles.factLabel}>Saldo pendiente</span>
          <p className={styles.balance}>$3,400.00</p>
          <p className={styles.factValue}>
            Plan de ortodoncia, mensualidad de septiembre vencida el 5.
          </p>
          <Button variant="soft" onClick={() => onGoToTab('pagos')}>
            Registrar pago
          </Button>
        </Card>

        <Card>
          <h2 className={styles.title}>Pendientes del expediente</h2>
          {RECORD_PENDING.map((item) => (
            <p key={item.label} className={styles.inlineActions}>
              <span className={`${styles.dot} ${styles[item.tone]}`} />
              <span className={styles.factValue}>{item.label}</span>
              <ChevronRightIcon size={14} />
            </p>
          ))}
        </Card>
      </div>
    </div>
  )
}
