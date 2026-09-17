import type { ReactNode } from 'react'
import { AlertIcon, CheckCircleIcon } from '../atoms/icons'
import styles from './FormAlert.module.css'

type Tone = 'error' | 'success' | 'info'

interface FormAlertProps {
  tone: Tone
  children: ReactNode
}

export function FormAlert({ tone, children }: FormAlertProps) {
  const Icon = tone === 'error' ? AlertIcon : CheckCircleIcon
  return (
    <p className={[styles.alert, styles[tone]].join(' ')} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={16} className={styles.icon} />
      <span>{children}</span>
    </p>
  )
}
