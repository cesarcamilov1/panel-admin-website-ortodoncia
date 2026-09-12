import { useState } from 'react'
import { Badge } from '../../../../shared/ui/atoms/Badge'
import { Button } from '../../../../shared/ui/atoms/Button'
import { Chip } from '../../../../shared/ui/atoms/Chip'
import { SelectField, TextField } from '../../../../shared/ui/atoms/Field'
import { Toggle } from '../../../../shared/ui/atoms/Toggle'
import { RefundIcon, WalletIcon } from '../../../../shared/ui/atoms/icons'
import { Card, CardHeader } from '../../../../shared/ui/molecules/Card'
import { KpiRow } from '../../../../shared/ui/molecules/KpiCard'
import { PAYMENTS, PAYMENT_KPIS, PAYMENT_METHODS } from '../../domain/data'
import styles from './tabs.module.css'

export function PaymentsTab() {
  const [method, setMethod] = useState('Tarjeta')
  const [stamp, setStamp] = useState(true)

  return (
    <div className={styles.main}>
      <KpiRow items={PAYMENT_KPIS} />

      <div className={styles.split}>
        <Card padded={false}>
          <CardHeader title="Movimientos" />
          {PAYMENTS.map((payment) => (
            <div key={payment.id} className={styles.row}>
              <span className={`${styles.dot} ${payment.refund ? styles.danger : styles.ok}`} />
              {payment.refund ? <RefundIcon size={16} /> : <WalletIcon size={16} />}
              <span className={styles.rowText}>
                <strong>{payment.concept}</strong>
                <small>{payment.meta}</small>
              </span>
              <span className={styles.subtle} style={{ width: 128, flexShrink: 0 }}>
                {payment.method}
              </span>
              <strong style={{ width: 104, flexShrink: 0, textAlign: 'right' }}>
                {payment.amount}
              </strong>
              <span style={{ width: 108, flexShrink: 0, textAlign: 'right' }}>
                <Badge tone={payment.tone}>{payment.state}</Badge>
              </span>
            </div>
          ))}
        </Card>

        <Card className={`${styles.side} ${styles.sideNarrow}`}>
          <h2 className={styles.title}>Registrar pago</h2>
          <TextField label="Importe" defaultValue="$3,400.00" />
          <div>
            <span className={styles.factLabel}>Método</span>
            <div className={styles.chips} style={{ paddingTop: 7 }}>
              {PAYMENT_METHODS.map((option) => (
                <Chip key={option} selected={option === method} onClick={() => setMethod(option)}>
                  {option}
                </Chip>
              ))}
            </div>
          </div>
          <SelectField
            label="Aplicar a"
            options={[
              'Plan 2025-233 · Ortodoncia',
              'Plan 2026-014 · Rehabilitación superior',
              'Saldo a favor',
            ]}
          />
          <div className={styles.medicine}>
            <Toggle checked={stamp} label="Timbrar CFDI al cobrar" onChange={() => setStamp((v) => !v)} />
            <span className={styles.factValue}>Timbrar CFDI al cobrar</span>
          </div>
          <Button>Cobrar</Button>
        </Card>
      </div>
    </div>
  )
}
