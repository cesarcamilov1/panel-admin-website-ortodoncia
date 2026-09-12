import { useState } from 'react'
import { Avatar } from '../../../shared/ui/atoms/Avatar'
import { Badge } from '../../../shared/ui/atoms/Badge'
import { Button } from '../../../shared/ui/atoms/Button'
import { CalendarIcon, MessageIcon } from '../../../shared/ui/atoms/icons'
import { TabBar } from '../../../shared/ui/molecules/TabBar'
import { usePanelActions } from '../../panel/application/panelContext'
import { PATIENT } from '../domain/data'
import { Odontogram } from './organisms/Odontogram'
import { RECORD_TABS, type RecordTabId } from './recordTabs'
import { ConsentsTab } from './tabs/ConsentsTab'
import { FilesTab } from './tabs/FilesTab'
import { FiscalTab } from './tabs/FiscalTab'
import { NotesTab } from './tabs/NotesTab'
import { PaymentsTab } from './tabs/PaymentsTab'
import { PlansTab } from './tabs/PlansTab'
import { PrescriptionsTab } from './tabs/PrescriptionsTab'
import { SummaryTab } from './tabs/SummaryTab'
import styles from './PatientRecordPage.module.css'

export function PatientRecordPage() {
  const { openNewAppointment } = usePanelActions()
  const [tab, setTab] = useState<RecordTabId>('resumen')

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Avatar name={PATIENT.name} size={56} />
        <div className={styles.identity}>
          <div className={styles.nameRow}>
            <h2 className={styles.name}>{PATIENT.name}</h2>
            {PATIENT.alerts.map((alert) => (
              <Badge key={alert.label} tone={alert.tone}>
                {alert.label}
              </Badge>
            ))}
          </div>
          <div className={styles.facts}>
            <span>Expediente {PATIENT.record}</span>
            <span>{PATIENT.age}</span>
            <span>{PATIENT.phone}</span>
            <span>{PATIENT.email}</span>
            <span>{PATIENT.since}</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.buttons}>
            <Button variant="secondary" size="sm">
              <MessageIcon size={15} />
              Escribir
            </Button>
            <Button size="sm" onClick={openNewAppointment}>
              <CalendarIcon size={15} />
              Agendar
            </Button>
          </div>
          <span className={styles.next}>Próxima cita: {PATIENT.nextVisit}</span>
        </div>
      </header>

      <TabBar tabs={RECORD_TABS} current={tab} onSelect={setTab} label="Secciones del expediente" />

      {tab === 'resumen' ? <SummaryTab onGoToTab={setTab} /> : null}
      {tab === 'notas' ? <NotesTab /> : null}
      {tab === 'odontograma' ? <Odontogram onSendToPlan={() => setTab('planes')} /> : null}
      {tab === 'planes' ? <PlansTab /> : null}
      {tab === 'recetas' ? <PrescriptionsTab /> : null}
      {tab === 'pagos' ? <PaymentsTab /> : null}
      {tab === 'archivos' ? <FilesTab /> : null}
      {tab === 'consentimientos' ? <ConsentsTab /> : null}
      {tab === 'fiscales' ? <FiscalTab /> : null}
    </div>
  )
}
