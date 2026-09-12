import { useCallback, useMemo, useState } from 'react'
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
        <Sidebar current={section} />
        <div className={styles.main}>
          <Topbar
            title={SECTION_TITLES[section]}
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
