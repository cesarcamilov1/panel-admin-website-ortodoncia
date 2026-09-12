import {
  SURFACES,
  isToothMarked,
  isToothMissing,
  surfaceCondition,
  surfaceName,
  type OdontogramMarks,
  type Surface,
} from '../../domain/odontogram'
import { conditionBorder, conditionColor } from './conditionColor'
import styles from './Odontogram.module.css'

/** Grid position of each surface inside the 3×3 tooth glyph. */
const CELL_AREA: Record<Surface, string> = {
  V: '1 / 2 / 2 / 3',
  M: '2 / 1 / 3 / 2',
  O: '2 / 2 / 3 / 3',
  D: '2 / 3 / 3 / 4',
  L: '3 / 2 / 4 / 3',
}

interface ToothProps {
  tooth: number
  marks: OdontogramMarks
  numberFirst?: boolean
  onPaint: (tooth: number, surface: Surface) => void
}

export function Tooth({ tooth, marks, numberFirst = false, onPaint }: ToothProps) {
  const missing = isToothMissing(marks, tooth)
  const label = (
    <span className={`${styles.number} ${isToothMarked(marks, tooth) ? styles.numberMarked : ''}`}>
      {tooth}
    </span>
  )

  return (
    <div className={styles.tooth}>
      {numberFirst ? label : null}
      <div className={styles.glyph}>
        {SURFACES.map((surface) => {
          const condition = surfaceCondition(marks, tooth, surface)
          return (
            <button
              key={surface}
              type="button"
              className={styles.surface}
              style={{
                gridArea: CELL_AREA[surface],
                background: conditionColor(condition),
                borderColor: conditionBorder(condition),
              }}
              onClick={() => onPaint(tooth, surface)}
              aria-label={`Diente ${tooth}, ${surfaceName(tooth, surface)}`}
            />
          )
        })}
        {missing ? (
          <svg className={styles.missing} viewBox="0 0 30 30" aria-hidden>
            <path d="m6 6 18 18M24 6 6 24" />
          </svg>
        ) : null}
      </div>
      {numberFirst ? null : label}
    </div>
  )
}
