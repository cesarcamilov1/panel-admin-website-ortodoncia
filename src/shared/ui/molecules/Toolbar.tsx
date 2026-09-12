import type { ReactNode } from 'react'
import { Chip } from '../atoms/Chip'
import styles from './Toolbar.module.css'

interface ToolbarProps {
  filters?: string[]
  selectedFilter?: string
  onFilterChange?: (filter: string) => void
  children?: ReactNode
}

export function Toolbar({ filters = [], selectedFilter, onFilterChange, children }: ToolbarProps) {
  return (
    <div className={styles.toolbar}>
      {filters.map((filter) => (
        <Chip
          key={filter}
          selected={filter === selectedFilter}
          onClick={() => onFilterChange?.(filter)}
        >
          {filter}
        </Chip>
      ))}
      <span className={styles.spacer} />
      {children}
    </div>
  )
}
