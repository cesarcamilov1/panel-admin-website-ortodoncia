import type { ReactNode } from 'react'
import styles from './Chip.module.css'

interface ChipProps {
  selected?: boolean
  onClick?: () => void
  children: ReactNode
}

export function Chip({ selected = false, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`${styles.chip} ${selected ? styles.selected : ''}`}
    >
      {children}
    </button>
  )
}
