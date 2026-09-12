import { CheckCircleIcon } from '../atoms/icons'
import styles from './Toast.module.css'

interface ToastProps {
  message: string
  onDismiss: () => void
}

export function Toast({ message, onDismiss }: ToastProps) {
  return (
    <button type="button" className={styles.toast} onClick={onDismiss} role="status">
      <CheckCircleIcon className={styles.icon} />
      {message}
    </button>
  )
}
