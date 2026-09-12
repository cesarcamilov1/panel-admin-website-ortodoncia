import type { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'soft' | 'danger' | 'link'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  const classes = [styles.button, styles[variant], styles[size], className].filter(Boolean).join(' ')
  return <button type="button" className={classes} {...props} />
}
