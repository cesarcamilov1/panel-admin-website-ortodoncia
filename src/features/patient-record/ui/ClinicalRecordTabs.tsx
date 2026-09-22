import { useResource } from '../../../shared/api/useResource'
import type { ClinicalApi } from '../application/clinicalApi'
import type { ClinicalEncounter } from '../domain/clinical'
import styles from './ClinicalRecordTabs.module.css'
import { ItemCollection, ClinicalSummaryTab, MedicalHistoryTab } from './clinical/collections'
import { EncounterPanel } from './clinical/encounters'
import { NotesTab } from './clinical/notes'
import { OdontogramTab } from './clinical/odontograms'

export { ClinicalSummaryTab, MedicalHistoryTab, NotesTab, OdontogramTab }

export function ClinicalTab({ api, patientId, userId, owner }: { api: ClinicalApi; patientId: string; userId: string; owner: boolean }) {
  const encounters = useResource((signal) => api.listEncounters(patientId, signal), [api, patientId])
  return <section className={styles.stack} aria-label="Atención clínica">
    <ItemCollection api={api} patientId={patientId} kind="conditions" title="Padecimientos" />
    <ItemCollection api={api} patientId={patientId} kind="allergies" title="Alergias" />
    <ItemCollection api={api} patientId={patientId} kind="medications" title="Medicamentos" />
    <EncounterPanel api={api} patientId={patientId} userId={userId} owner={owner} resource={encounters as ReturnType<typeof useResource<ClinicalEncounter[]>>} />
  </section>
}
