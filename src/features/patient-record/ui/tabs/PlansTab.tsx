import { Badge } from '../../../../shared/ui/atoms/Badge'
import { Button } from '../../../../shared/ui/atoms/Button'
import { Card, CardHeader } from '../../../../shared/ui/molecules/Card'
import { DataTable, type Column } from '../../../../shared/ui/molecules/DataTable'
import { PLAN_LINES, PLAN_TOTALS } from '../../domain/data'
import styles from './tabs.module.css'

type PlanLine = (typeof PLAN_LINES)[number]

const columns: Column<PlanLine>[] = [
  { key: 'n', label: '#', width: '26px', render: (line) => line.n },
  {
    key: 'name',
    label: 'Procedimiento',
    render: (line) => (
      <span className={styles.rowText}>
        <strong>{line.name}</strong>
        <small>{line.code}</small>
      </span>
    ),
  },
  { key: 'tooth', label: 'Diente', width: '132px', render: (line) => line.tooth },
  { key: 'amount', label: 'Importe', width: '104px', align: 'right', render: (line) => line.amount },
  {
    key: 'state',
    label: 'Estado',
    width: '124px',
    render: (line) => <Badge tone={line.tone}>{line.state}</Badge>,
  },
]

export function PlansTab() {
  return (
    <div className={styles.split}>
      <div className={styles.main}>
        <Card padded={false}>
          <CardHeader
            title="Plan 2026-014 · Rehabilitación superior"
            actions={<span className={styles.subtle}>Aceptado el 22 ago 2026</span>}
          />
          <DataTable columns={columns} rows={PLAN_LINES} rowKey={(line) => String(line.n)} />
        </Card>
      </div>

      <div className={`${styles.side} ${styles.sideNarrow}`}>
        <Card>
          <h2 className={styles.title}>Resumen del plan</h2>
          {PLAN_TOTALS.map((total) => (
            <p key={total.label} className={styles.inlineActions}>
              <span className={styles.factValue}>{total.label}</span>
              <span className={styles.spacer} />
              <strong className={styles.factValue}>{total.value}</strong>
            </p>
          ))}
          <p className={styles.inlineActions}>
            <strong className={styles.title}>Total del plan</strong>
            <span className={styles.spacer} />
            <strong className={styles.title}>$24,800.00</strong>
          </p>
          <Button>Agregar procedimiento</Button>
          <Button variant="secondary">Enviar presupuesto</Button>
        </Card>

        <Card>
          <h2 className={styles.title}>Otros planes</h2>
          <p className={styles.factValue}>Plan 2025-233 · Ortodoncia, en fase de retención.</p>
          <p className={styles.subtle}>Plan 2024-118 · Higiene, completado.</p>
        </Card>
      </div>
    </div>
  )
}
