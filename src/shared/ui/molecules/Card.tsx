import type { ReactNode } from 'react'
import styles from './Card.module.css'

interface CardProps {
  children: ReactNode
  padded?: boolean
  className?: string
}

export function Card({ children, padded = true, className }: CardProps) {
  return (
    <section className={[styles.card, padded ? styles.padded : '', className].filter(Boolean).join(' ')}>
      {children}
    </section>
  )
}

interface CardHeaderProps {
  title: ReactNode
  meta?: ReactNode
  actions?: ReactNode
}

export function CardHeader({ title, meta, actions }: CardHeaderProps) {
  return (
    <header className={styles.header}>
      <h2 className={styles.title}>{title}</h2>
      {meta ? <span className={styles.meta}>{meta}</span> : null}
      <span className={styles.spacer} />
      {actions}
    </header>
  )
}
