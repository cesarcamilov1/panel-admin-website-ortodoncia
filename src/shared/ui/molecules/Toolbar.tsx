import type { ReactNode } from 'react'
import { Chip } from '../atoms/Chip'
import styles from './Toolbar.module.css'

interface ToolbarProps {
  filters?: string[]
  selectedFilter?: string
  onFilterChange?: (filter: string) => void
  afterFilters?: ReactNode
  children?: ReactNode
}

export function Toolbar({ filters = [], selectedFilter, onFilterChange, afterFilters, children }: ToolbarProps) {
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
      {afterFilters}
      <span className={styles.spacer} />
      {children}
    </div>
  )
}
