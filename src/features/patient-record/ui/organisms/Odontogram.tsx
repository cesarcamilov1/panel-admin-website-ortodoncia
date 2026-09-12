import { Button } from '../../../../shared/ui/atoms/Button'
import { Badge } from '../../../../shared/ui/atoms/Badge'
import { CloseIcon, PlusIcon } from '../../../../shared/ui/atoms/icons'
import { useOdontogram } from '../../application/useOdontogram'
import {
  CONDITIONS,
  CONDITION_LABELS,
  quadrantGapIndex,
  type Condition,
} from '../../domain/odontogram'
import { ODONTOGRAM_VERSIONS, SEEDED_MARKS } from '../../domain/data'
import { conditionColor } from './conditionColor'
import { Tooth } from './Tooth'
import styles from './Odontogram.module.css'

const DENTITIONS = [
  { id: 'permanent', label: 'Permanente' },
  { id: 'primary', label: 'Temporal' },
] as const

interface OdontogramProps {
  onSendToPlan: () => void
}

export function Odontogram({ onSendToPlan }: OdontogramProps) {
  const chart = useOdontogram(SEEDED_MARKS)

  const renderArch = (teeth: readonly number[], numberFirst: boolean) => {
    const gap = quadrantGapIndex(teeth)
    return (
      <div className={styles.arch}>
        {teeth.map((tooth, index) => (
          <div
            key={tooth}
            style={{ marginRight: index === gap ? 20 : index === teeth.length - 1 ? 0 : 4 }}
          >
            <Tooth tooth={tooth} marks={chart.marks} numberFirst={numberFirst} onPaint={chart.paint} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={styles.layout}>
      <section className={styles.board}>
        <header className={styles.header}>
          <h2 className={styles.title}>Odontograma</h2>
          <Badge tone="warn">Borrador v4</Badge>
          <span className={styles.spacer} />
          <div className={styles.segmented}>
            {DENTITIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={chart.dentition === option.id}
                onClick={() => chart.setDentition(option.id)}
                className={`${styles.segment} ${chart.dentition === option.id ? styles.segmentOn : ''}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </header>

        <div className={styles.tools} role="radiogroup" aria-label="Hallazgo a marcar">
          {CONDITIONS.map((condition: Condition) => (
            <button
              key={condition}
              type="button"
              role="radio"
              aria-checked={chart.tool === condition}
              onClick={() => chart.selectTool(condition)}
              className={`${styles.tool} ${chart.tool === condition ? styles.toolOn : ''}`}
            >
              <span className={styles.swatch} style={{ background: conditionColor(condition) }} />
              {CONDITION_LABELS[condition]}
            </button>
          ))}
        </div>

        <div className={styles.chart}>
          {renderArch(chart.upper, false)}
          <hr className={styles.midline} />
          {renderArch(chart.lower, true)}
        </div>

        <footer className={styles.actions}>
          <p className={styles.hint}>
            Toca una superficie para marcarla. Rojo por tratar, azul ya tratado.
          </p>
          <Button variant="secondary" size="sm" onClick={chart.reset}>
            Limpiar cambios
          </Button>
          <Button size="sm">Guardar y bloquear versión</Button>
        </footer>
      </section>

      <aside className={styles.side}>
        <section className={styles.panel}>
          <header className={styles.panelHeader}>
            <h2 className={styles.title}>Hallazgos</h2>
            <Badge tone="accent">{chart.findings.length}</Badge>
          </header>
          {chart.findings.length === 0 ? (
            <p className={styles.empty}>Sin hallazgos registrados en esta versión.</p>
          ) : (
            chart.findings.map((finding) => (
              <div key={finding.key} className={styles.finding}>
                <span
                  className={styles.swatch}
                  style={{ background: conditionColor(finding.condition) }}
                />
                <span className={styles.findingText}>
                  <strong>{finding.label}</strong>
                  <small>{finding.detail}</small>
                </span>
                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => chart.removeFinding(finding.key)}
                  aria-label={`Quitar ${finding.label}, ${finding.detail}`}
                >
                  <CloseIcon size={15} />
                </button>
              </div>
            ))
          )}
        </section>

        <section className={styles.versions}>
          <h2 className={styles.title}>Versiones</h2>
          {ODONTOGRAM_VERSIONS.map((version) => (
            <p key={version.label} className={styles.version}>
              <span className={`${styles.dot} ${styles[version.tone]}`} />
              <span className={styles.versionLabel}>{version.label}</span>
              <small>{version.date}</small>
            </p>
          ))}
          <Button variant="secondary" size="sm">
            Comparar con la anterior
          </Button>
        </section>

        <Button variant="soft" onClick={onSendToPlan}>
          <PlusIcon />
          Pasar hallazgos al plan
        </Button>
      </aside>
    </div>
  )
}
