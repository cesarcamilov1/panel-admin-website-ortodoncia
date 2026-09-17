import { NavLink } from 'react-router-dom'
import { ToothIcon } from '../../../../shared/ui/atoms/icons'
import { Avatar } from '../../../../shared/ui/atoms/Avatar'
import { useAuth } from '../../../auth/application/authContext'
import { ROLE_LABELS, fullName } from '../../../auth/domain/auth'
import { NAV_GROUPS, isNavItemActive, sectionPath, type SectionId } from '../../domain/navigation'
import { SECTION_ICONS } from '../sectionIcons'
import { UserMenu } from './UserMenu'
import styles from './Sidebar.module.css'

interface SidebarProps {
  current: SectionId
  onNavigate?: () => void
}

export function Sidebar({ current, onNavigate }: SidebarProps) {
  const { state } = useAuth()
  const user = state.status === 'authenticated' ? state.user : null

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.mark}>
          <ToothIcon size={19} />
        </span>
        <span className={styles.brandText}>
          <strong>Clínica Aurora</strong>
          <small>Polanco · CDMX</small>
        </span>
      </div>

      <nav className={styles.nav} aria-label="Secciones del panel">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className={styles.group}>
            <p className={styles.groupLabel}>{group.label}</p>
            {group.items.map((item) => {
              const Icon = SECTION_ICONS[item.id]
              const active = isNavItemActive(item.id, current)
              return (
                <NavLink
                  key={item.id}
                  onClick={onNavigate}
                  to={sectionPath(item.id)}
                  className={`${styles.item} ${active ? styles.active : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={18} />
                  <span className={styles.itemLabel}>{item.label}</span>
                  {item.count ? <span className={styles.count}>{item.count}</span> : null}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      {user ? (
        <div className={styles.user}>
          <Avatar name={fullName(user)} />
          <span className={styles.userText}>
            <strong>{fullName(user)}</strong>
            <small>{ROLE_LABELS[user.role]}</small>
          </span>
          <UserMenu />
        </div>
      ) : null}
    </aside>
  )
}
