import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Badge } from '../../../shared/ui/atoms/Badge'
import { Button } from '../../../shared/ui/atoms/Button'
import { PlusIcon } from '../../../shared/ui/atoms/icons'
import { DataTable, type Column } from '../../../shared/ui/molecules/DataTable'
import { KpiRow } from '../../../shared/ui/molecules/KpiCard'
import { Toolbar } from '../../../shared/ui/molecules/Toolbar'
import {
  RECORD_SECTIONS,
  type RecordRow,
  type RecordSectionId,
} from '../domain/sections'
import styles from './RecordsPage.module.css'
import { RouteBoundary } from '../../../shared/ui/organisms/RouteBoundary'
import { PaymentsPage } from './PaymentsPage'

const IntegratedRecordsPage = lazy(() => import('./IntegratedRecordsPage').then(({ IntegratedRecordsPage }) => ({ default: IntegratedRecordsPage })))
const BillingPage = lazy(() => import('../../billing/ui/BillingPage').then(({ BillingPage }) => ({ default: BillingPage })))
const RemindersPage = lazy(() => import('../../reminders/ui/RemindersPage').then(({ RemindersPage }) => ({ default: RemindersPage })))
const ReviewsPage = lazy(() => import('../../reviews/ui/ReviewsPage').then(({ ReviewsPage }) => ({ default: ReviewsPage })))

interface RecordsPageProps {
  section: RecordSectionId
}

function buildColumns(section: RecordSectionId): Column<RecordRow>[] {
  return RECORD_SECTIONS[section].columns.map((column, index) => ({
    key: `${column.label}-${index}`,
    label: column.label,
    width: column.width,
    grow: column.grow,
    align: column.align,
    render: (row) => {
      const cell = row.cells[index]
      if (!cell) return null
      if (cell.badge) return <Badge tone={cell.badge}>{cell.text}</Badge>
      const classes = [
        cell.strong ? styles.strong : '',
        cell.muted ? styles.muted : '',
        cell.emphasis ? styles[cell.emphasis] : '',
      ]
        .filter(Boolean)
        .join(' ')
      return (
        <span className={styles.cell}>
          <span className={classes}>{cell.text}</span>
          {cell.sub ? <small className={styles.sub}>{cell.sub}</small> : null}
        </span>
      )
    },
  }))
}

function FeatureRoute({ children }: { children: ReactNode }) {
  return (
    <RouteBoundary>
      <Suspense fallback={<p role="status" aria-live="polite">Cargando sección…</p>}>
        {children}
      </Suspense>
    </RouteBoundary>
  )
}

export function RecordsPage({ section }: RecordsPageProps) {
  if (section === 'pagos') return <PaymentsPage />
  if (section === 'facturacion') return <FeatureRoute><BillingPage /></FeatureRoute>
  if (section === 'ortodoncia' || section === 'recetas' || section === 'consentimientos') return <FeatureRoute><IntegratedRecordsPage section={section} /></FeatureRoute>
  if (section === 'recordatorios') return <FeatureRoute><RemindersPage /></FeatureRoute>
  if (section === 'resenas') return <FeatureRoute><ReviewsPage /></FeatureRoute>
  if (section === 'reportes') return <ReportsUnavailable />
  return <LegacyRecordsPage section={section} />
}

function ReportsUnavailable() {
  return (
    <div className={styles.page}>
      <div role="status">
        <h1>Reportes no disponibles</h1>
        <p>El backend no expone un endpoint de reportes ni una exportación verificable. No mostramos gráficos, totales ni descargas inventadas.</p>
      </div>
    </div>
  )
}

function LegacyRecordsPage({ section }: RecordsPageProps) {
  const config = RECORD_SECTIONS[section]
  const [filter, setFilter] = useState(config.filters[0])

  return (
    <div className={styles.page}>
      {config.kpis ? <KpiRow items={config.kpis} /> : null}

      <Toolbar filters={config.filters} selectedFilter={filter} onFilterChange={setFilter}>
        {config.altAction ? <Button variant="secondary">{config.altAction}</Button> : null}
        <Button>
          <PlusIcon />
          {config.action}
        </Button>
      </Toolbar>

      <DataTable
        columns={buildColumns(section)}
        rows={config.rows}
        rowKey={(row) => row.id}
        footer={config.footer}
      />
    </div>
  )
}
