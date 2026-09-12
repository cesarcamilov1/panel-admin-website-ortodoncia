import styles from './Toggle.module.css'

interface ToggleProps {
  checked: boolean
  label: string
  onChange: () => void
}

export function Toggle({ checked, label, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`${styles.track} ${checked ? styles.on : ''}`}
    >
      <span className={styles.knob} />
    </button>
  )
}
