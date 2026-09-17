import type { ReactNode } from 'react'
import styles from './DataTable.module.css'

export interface Column<Row> {
  key: string
  label: string
  /** Fixed width in CSS units; omit to let the column grow. */
  width?: string
  grow?: number
  align?: 'left' | 'right'
  render: (row: Row) => ReactNode
}

interface DataTableProps<Row> {
  columns: Column<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string
  onRowClick?: (row: Row) => void
  footer?: ReactNode
}

/**
 * A fixed column keeps its width and never gives it up; a growing column sizes from its
 * grow factor. Without `flexBasis: 0` a growing cell starts at its max-content width, so
 * one long value claims the row and squeezes every fixed column beside it.
 */
function cellStyle<Row>(column: Column<Row>) {
  if (column.width) {
    return {
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: column.width,
      textAlign: column.align ?? 'left',
    } as const
  }
  return {
    flexGrow: column.grow ?? 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    textAlign: column.align ?? 'left',
  } as const
}

export function DataTable<Row>({ columns, rows, rowKey, onRowClick, footer }: DataTableProps<Row>) {
  return (
    <div className={styles.table}>
      <div className={styles.head} role="row">
        {columns.map((column) => (
          <span key={column.key} className={styles.cell} style={cellStyle(column)}>
            {column.label}
          </span>
        ))}
      </div>
      {rows.map((row) => {
        const clickable = Boolean(onRowClick)
        return (
          <div
            key={rowKey(row)}
            role="row"
            tabIndex={clickable ? 0 : undefined}
            className={`${styles.row} ${clickable ? styles.clickable : ''}`}
            onClick={clickable ? () => onRowClick?.(row) : undefined}
            onKeyDown={
              clickable
                ? (event) => {
                    if (event.key === 'Enter') onRowClick?.(row)
                  }
                : undefined
            }
          >
            {columns.map((column) => (
              <span key={column.key} className={styles.cell} style={cellStyle(column)}>
                {column.render(row)}
              </span>
            ))}
          </div>
        )
      })}
      {footer ? <p className={styles.footer}>{footer}</p> : null}
    </div>
  )
}

export function Primary({ children }: { children: ReactNode }) {
  return <span className={styles.primary}>{children}</span>
}

export function Sub({ children }: { children: ReactNode }) {
  // The text is clipped to one line, so expose the full value on hover.
  const title = typeof children === 'string' ? children : undefined
  return (
    <span className={styles.sub} title={title}>
      {children}
    </span>
  )
}

export function Stacked({ top, bottom }: { top: ReactNode; bottom: ReactNode }) {
  return (
    <span className={styles.stacked}>
      <Primary>{top}</Primary>
      <Sub>{bottom}</Sub>
    </span>
  )
}
