import { Badge } from '../../../../shared/ui/atoms/Badge'
import { Button } from '../../../../shared/ui/atoms/Button'
import { Card, CardHeader } from '../../../../shared/ui/molecules/Card'
import { PATIENT_CONSENTS, SIGNATURE_EVIDENCE } from '../../domain/data'
import styles from './tabs.module.css'

export function ConsentsTab() {
  return (
    <div className={styles.split}>
      <Card padded={false}>
        <CardHeader title="Consentimientos informados" />
        {PATIENT_CONSENTS.map((consent) => (
          <div key={consent.name} className={styles.row}>
            <span className={styles.rowText}>
              <strong>{consent.name}</strong>
              <small>{consent.meta}</small>
            </span>
            <span style={{ width: 118, flexShrink: 0 }}>
              <Badge tone={consent.tone}>{consent.state}</Badge>
            </span>
            <Button variant="secondary" size="sm">
              {consent.action}
            </Button>
          </div>
        ))}
      </Card>

      <Card className={styles.side}>
        <h2 className={styles.title}>Evidencia de firma</h2>
        {SIGNATURE_EVIDENCE.map((row) => (
          <p key={row.label} className={styles.inlineActions}>
            <span className={styles.subtle}>{row.label}</span>
            <span className={styles.spacer} />
            <span className={styles.factValue}>{row.value}</span>
          </p>
        ))}
        <p className={styles.hash}>
          SHA-256 4f2a9c1e7b0d38a5c6e14f9027bd3ac8e5417d20b9fca6318e04d7b5c92f1a63
        </p>
        <Button variant="secondary">Descargar comprobante</Button>
      </Card>
    </div>
  )
}
