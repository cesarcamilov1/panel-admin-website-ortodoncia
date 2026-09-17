import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../auth/application/authContext'
import { authErrorMessage } from '../../../auth/domain/auth'
import { MoreIcon } from '../../../../shared/ui/atoms/icons'
import { usePanelActions } from '../../application/panelContext'
import styles from './UserMenu.module.css'

export function UserMenu() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { notify } = usePanelActions()

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const goToAccount = () => {
    setOpen(false)
    navigate('/cuenta')
  }

  const handleLogout = async () => {
    setOpen(false)
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (error) {
      notify(authErrorMessage(error, 'session'))
    }
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-label="Opciones de la cuenta"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreIcon />
      </button>

      {open ? (
        <div className={styles.menu} role="menu">
          <button type="button" role="menuitem" className={styles.item} onClick={goToAccount}>
            Mi cuenta
          </button>
          <button type="button" role="menuitem" className={styles.item} onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      ) : null}
    </div>
  )
}
