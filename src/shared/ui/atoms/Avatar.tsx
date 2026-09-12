import { initialsOf } from './initials'
import styles from './Avatar.module.css'

interface AvatarProps {
  name: string
  size?: number
}

export function Avatar({ name, size = 34 }: AvatarProps) {
  return (
    <span
      className={styles.avatar}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.35) }}
      aria-hidden
    >
      {initialsOf(name)}
    </span>
  )
}
