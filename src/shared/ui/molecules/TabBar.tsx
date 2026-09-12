import styles from './TabBar.module.css'

export interface Tab<Id extends string> {
  id: Id
  label: string
}

interface TabBarProps<Id extends string> {
  tabs: Tab<Id>[]
  current: Id
  onSelect: (id: Id) => void
  label: string
}

export function TabBar<Id extends string>({ tabs, current, onSelect, label }: TabBarProps<Id>) {
  return (
    <div className={styles.bar} role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === current}
          onClick={() => onSelect(tab.id)}
          className={`${styles.tab} ${tab.id === current ? styles.active : ''}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
