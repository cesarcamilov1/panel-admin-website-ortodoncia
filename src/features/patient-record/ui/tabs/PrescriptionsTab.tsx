import { Badge } from '../../../../shared/ui/atoms/Badge'
import { Button } from '../../../../shared/ui/atoms/Button'
import { TextArea, TextField } from '../../../../shared/ui/atoms/Field'
import { AlertIcon, PrescriptionIcon } from '../../../../shared/ui/atoms/icons'
import { Card } from '../../../../shared/ui/molecules/Card'
import { PRESCRIPTIONS } from '../../domain/data'
import styles from './tabs.module.css'

export function PrescriptionsTab() {
  return (
    <div className={styles.split}>
      <div className={styles.main}>
        {PRESCRIPTIONS.map((prescription) => (
          <Card key={prescription.folio}>
            <div className={styles.inlineActions}>
              <strong className={styles.title}>{prescription.folio}</strong>
              <Badge tone={prescription.tone}>{prescription.state}</Badge>
              <span className={styles.spacer} />
              <span className={styles.subtle}>{prescription.date}</span>
            </div>
            {prescription.items.map((item) => (
              <div key={item.name} className={styles.medicine}>
                <PrescriptionIcon size={17} className={styles.medicineIcon} />
                <span className={styles.rowText}>
                  <strong>{item.name}</strong>
                  <small>{item.dose}</small>
                </span>
              </div>
            ))}
            <div className={styles.inlineActions}>
              <span className={styles.subtle}>{prescription.signer}</span>
              <span className={styles.spacer} />
              <Button variant="secondary" size="sm">
                Descargar PDF
              </Button>
              <Button variant="secondary" size="sm">
                Enviar por WhatsApp
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card className={styles.side}>
        <h2 className={styles.title}>Nueva receta</h2>
        <TextField label="Medicamento" placeholder="Buscar en el vademécum" />
        <div className={styles.grid2}>
          <TextField label="Dosis" placeholder="500 mg" />
          <TextField label="Frecuencia" placeholder="Cada 8 horas" />
        </div>
        <TextArea label="Indicaciones" placeholder="Tomar con alimentos" />
        <p className={`${styles.callout} ${styles.calloutDanger}`}>
          <AlertIcon size={16} />
          Lucía es alérgica a la penicilina. El sistema bloquea amoxicilina y derivados.
        </p>
        <Button>Firmar y emitir</Button>
      </Card>
    </div>
  )
}
