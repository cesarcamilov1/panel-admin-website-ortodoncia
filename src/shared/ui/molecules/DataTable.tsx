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

function cellStyle<Row>(column: Column<Row>) {
  return {
    width: column.width ?? 'auto',
    flexGrow: column.width ? 0 : (column.grow ?? 1),
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
  return <span className={styles.sub}>{children}</span>
}

export function Stacked({ top, bottom }: { top: ReactNode; bottom: ReactNode }) {
  return (
    <span className={styles.stacked}>
      <Primary>{top}</Primary>
      <Sub>{bottom}</Sub>
    </span>
  )
}
