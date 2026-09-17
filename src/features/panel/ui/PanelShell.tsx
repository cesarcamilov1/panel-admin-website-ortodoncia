import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { NewAppointmentModal } from '../../agenda/ui/organisms/NewAppointmentModal'
import { Toast } from '../../../shared/ui/molecules/Toast'
import { PanelActionsContext, type PanelActions } from '../application/panelContext'
import { SECTION_TITLES, sectionFromPath } from '../domain/navigation'
import { Sidebar } from './organisms/Sidebar'
import { Topbar } from './organisms/Topbar'
import styles from './PanelShell.module.css'

export function PanelShell() {
  const { pathname } = useLocation()
  const section = sectionFromPath(pathname)
  const [mobile, setMobile] = useState(() => window.matchMedia?.('(max-width: 900px)').matches ?? false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDialogElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeMenu = useCallback(() => {
    if (menuRef.current?.open) menuRef.current.close()
    setMenuOpen(false)
    menuButtonRef.current?.focus()
  }, [])

  const previousPath = useRef(pathname)
  useEffect(() => {
    if (previousPath.current !== pathname) closeMenu()
    previousPath.current = pathname
  }, [pathname, closeMenu])

  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 900px)')
    if (!media) return
    const update = (event: MediaQueryListEvent) => {
      setMobile(event.matches)
      setMenuOpen(false)
    }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (menuOpen) menuRef.current?.showModal()
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [menuOpen])

  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const notify = useCallback((message: string) => setToast(message), [])

  const actions = useMemo<PanelActions>(
    () => ({ openNewAppointment: () => setModalOpen(true), notify }),
    [notify],
  )

  return (
    <PanelActionsContext value={actions}>
      <div className={styles.shell}>
        {!mobile ? <Sidebar current={section} /> : null}
        {mobile && menuOpen ? (
          <dialog
            ref={menuRef}
            id="panel-menu"
            className={styles.menu}
            aria-label="Menú del panel"
            onCancel={(event) => { event.preventDefault(); closeMenu() }}
            onClose={closeMenu}
            onClick={(event) => { if (event.target === event.currentTarget) closeMenu() }}
          >
            <button type="button" className={styles.closeMenu} onClick={closeMenu} autoFocus>
              Cerrar menú
            </button>
            <Sidebar current={section} onNavigate={closeMenu} />
          </dialog>
        ) : null}
        <div className={styles.main}>
          <Topbar
            title={SECTION_TITLES[section]}
            menuButton={mobile ? (
              <button
                ref={menuButtonRef}
                type="button"
                className={styles.openMenu}
                aria-label="Abrir menú"
                aria-expanded={menuOpen}
                aria-controls={menuOpen ? 'panel-menu' : undefined}
                onClick={() => setMenuOpen(true)}
              >
                ☰
              </button>
            ) : null}
            backTo={section === 'ficha' ? { label: 'Pacientes', to: '/pacientes' } : undefined}
            onNewAppointment={() => setModalOpen(true)}
          />
          <main className={styles.content}>
            <Outlet />
          </main>
        </div>

        {modalOpen ? (
          <NewAppointmentModal
            onClose={() => setModalOpen(false)}
            onConfirm={(summary) => {
              setModalOpen(false)
              notify(summary)
            }}
          />
        ) : null}

        {toast ? <Toast message={toast} onDismiss={() => setToast(null)} /> : null}
      </div>
    </PanelActionsContext>
  )
}
