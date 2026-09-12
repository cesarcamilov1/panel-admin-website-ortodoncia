import { Link } from 'react-router-dom'
import { Badge } from '../../../../shared/ui/atoms/Badge'
import { Button } from '../../../../shared/ui/atoms/Button'
import { TextField } from '../../../../shared/ui/atoms/Field'
import { LockIcon } from '../../../../shared/ui/atoms/icons'
import { Card } from '../../../../shared/ui/molecules/Card'
import { FISCAL_FIELDS, PATIENT_CFDI } from '../../domain/data'
import styles from './tabs.module.css'

export function FiscalTab() {
  return (
    <div className={styles.split}>
      <Card>
        <div className={styles.inlineActions}>
          <h2 className={styles.title}>Datos fiscales del receptor</h2>
          <Badge tone="ok">Validados ante el SAT</Badge>
        </div>
        <div className={styles.grid2}>
          {FISCAL_FIELDS.map((field) => (
            <TextField
              key={field.label}
              label={field.label}
              hint={field.hint}
              defaultValue={field.value}
            />
          ))}
        </div>
        <div className={styles.inlineActions}>
          <Button>Guardar cambios</Button>
          <Button variant="secondary">Cargar constancia de situación fiscal</Button>
        </div>
      </Card>

      <div className={styles.side}>
        <div className={`${styles.callout} ${styles.calloutWarn}`} style={{ flexDirection: 'column', gap: 11 }}>
          <span className={styles.inlineActions}>
            <LockIcon size={17} />
            <strong>Zona protegida</strong>
          </span>
          <span>
            Editar o borrar datos fiscales pide un segundo factor reciente. Los CFDI ya timbrados
            conservan el dato con el que se emitieron.
          </span>
        </div>

        <Card>
          <h2 className={styles.title}>CFDI emitidos</h2>
          {PATIENT_CFDI.map((cfdi) => (
            <p key={cfdi.label} className={styles.inlineActions}>
              <span className={styles.factValue}>{cfdi.label}</span>
              <span className={styles.spacer} />
              <strong className={styles.factValue}>{cfdi.total}</strong>
            </p>
          ))}
          <Link to="/facturacion">Ver facturación</Link>
        </Card>
      </div>
    </div>
  )
}
