import styles from './KpiCard.module.css'

export interface Kpi {
  label: string
  value: string
  foot?: string
  tone?: 'ink' | 'accent' | 'warn' | 'danger'
}

export function KpiCard({ label, value, foot, tone = 'ink' }: Kpi) {
  return (
    <article className={styles.kpi}>
      <p className={styles.label}>{label}</p>
      <p className={`${styles.value} ${styles[tone]}`}>{value}</p>
      {foot ? <p className={styles.foot}>{foot}</p> : null}
    </article>
  )
}

export function KpiRow({ items }: { items: Kpi[] }) {
  return (
    <div className={styles.row}>
      {items.map((item) => (
        <KpiCard key={item.label} {...item} />
      ))}
    </div>
  )
}
