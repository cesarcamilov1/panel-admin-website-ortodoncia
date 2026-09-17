import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../../../shared/ui/atoms/Button'
import {
  BellIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  PlusIcon,
  SearchIcon,
} from '../../../../shared/ui/atoms/icons'
import styles from './Topbar.module.css'

interface TopbarProps {
  menuButton?: ReactNode
  title: string
  backTo?: { label: string; to: string }
  onNewAppointment: () => void
}

export function Topbar({ menuButton, title, backTo, onNewAppointment }: TopbarProps) {
  return (
    <header className={styles.topbar}>
      {menuButton}
      <div className={styles.titleBlock}>
        {backTo ? (
          <Link to={backTo.to} className={styles.crumb}>
            <ChevronLeftIcon size={13} />
            {backTo.label}
          </Link>
        ) : null}
        <h1 className={styles.title}>{title}</h1>
      </div>

      <span className={styles.spacer} />

      <div className={styles.search}>
        <SearchIcon className={styles.searchIcon} />
        <input
          className={styles.searchInput}
          placeholder="Buscar paciente, expediente o teléfono"
          aria-label="Buscar en el panel"
        />
        <kbd className={styles.kbd}>Ctrl K</kbd>
      </div>

      <span className={styles.selectWrap}>
        <select className={styles.select} aria-label="Sede">
          <option>Sede Polanco</option>
          <option>Sede Roma Norte</option>
          <option>Sede Satélite</option>
        </select>
        <ChevronDownIcon className={styles.selectIcon} />
      </span>

      <button type="button" className={styles.iconButton} aria-label="Notificaciones">
        <BellIcon />
        <span className={styles.dot} />
      </button>

      <Button onClick={onNewAppointment}>
        <PlusIcon />
        Nueva cita
      </Button>
    </header>
  )
}
