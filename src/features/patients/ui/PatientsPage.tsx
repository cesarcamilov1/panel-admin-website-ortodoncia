import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../../../shared/ui/atoms/Avatar'
import { Badge, type Tone } from '../../../shared/ui/atoms/Badge'
import { Button } from '../../../shared/ui/atoms/Button'
import { SelectField, TextField } from '../../../shared/ui/atoms/Field'
import { PlusIcon, SearchIcon } from '../../../shared/ui/atoms/icons'
import { DataTable, Stacked, type Column } from '../../../shared/ui/molecules/DataTable'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import { Toolbar } from '../../../shared/ui/molecules/Toolbar'
import { useAuth } from '../../auth/application/authContext'
import { usePanelActions } from '../../panel/application/panelContext'
import { type PatientsApi, type PatientSort } from '../application/patientsApi'
import { usePatientList } from '../application/usePatientList'
import { usePatientsApi } from '../application/usePatientsApi'
import { type PatientDraft, type PatientSummary, patientDisplayName } from '../domain/patient'
import { PatientFormModal } from './organisms/PatientFormModal'
import styles from './PatientsPage.module.css'

function statusPresentation(patient: PatientSummary): { label: string; tone: Tone } {
  if (patient.archived) return { label: 'Archivado', tone: 'neutral' }
  if (patient.status === 'INACTIVE') return { label: 'Inactivo', tone: 'neutral' }
  if (patient.status === 'DECEASED') return { label: 'Fallecido', tone: 'danger' }
  if (patient.bookingBlocked) return { label: 'Reservas bloqueadas', tone: 'warn' }
  return { label: 'Activo', tone: 'ok' }
}

/** Route-level container: resolves the app-scoped authenticated transport and session role. */
export function PatientsPage() {
  const api = usePatientsApi()
  const { state } = useAuth()
  if (state.status !== 'authenticated') return null
  return <PatientsScreen api={api} canEdit={state.user.role !== 'BILLING'} />
}

export function PatientsScreen({ api, canEdit }: { api: PatientsApi; canEdit: boolean }) {
  const navigate = useNavigate()
  const { notify } = usePanelActions()
  const list = usePatientList(api)
  const [creating, setCreating] = useState(false)

  const columns: Column<PatientSummary>[] = [
    {
      key: 'patient', label: 'Paciente', grow: 2,
      render: (patient) => <span className={styles.patient}>
        <Avatar name={patientDisplayName(patient)} />
        <Stacked top={patientDisplayName(patient)} bottom={`Expediente ${patient.recordNumber}`} />
      </span>,
    },
    { key: 'phone', label: 'Contacto', width: '168px', render: (patient) => <Stacked top={patient.phoneE164} bottom={patient.email || 'Sin correo'} /> },
    { key: 'status', label: 'Estado', width: '172px', render: (patient) => {
      const status = statusPresentation(patient)
      return <Badge tone={status.tone}>{status.label}</Badge>
    } },
  ]

  const create = async (draft: PatientDraft) => {
    const patient = await api.create(draft)
    setCreating(false)
    notify(`Paciente ${patientDisplayName(patient)} creado.`)
    navigate(`/pacientes/${patient.id}`)
  }

  const sortOptions = [
    { value: 'name', label: 'Nombre' },
    { value: 'record_number', label: 'Expediente' },
    { value: '-created_at', label: 'Más recientes' },
  ]

  return <div className={styles.page}>
    <Toolbar afterFilters={<div className={styles.controls}>
      <div className={styles.search}>
        <SearchIcon className={styles.searchIcon} />
        <TextField type="search" aria-label="Buscar pacientes" placeholder="Nombre, expediente, teléfono o RFC" className={styles.searchInput} value={list.query} maxLength={100} onChange={(event) => list.setQuery(event.target.value)} />
      </div>
      <SelectField label="Ordenar pacientes" className={styles.sort} value={list.sort} options={sortOptions} onChange={(event) => list.setSort(event.target.value as PatientSort)} />
    </div>}>
      {canEdit ? <Button onClick={() => setCreating(true)}><PlusIcon />Nuevo paciente</Button> : null}
    </Toolbar>

    {list.query.length === 1 ? <p className={styles.hint} role="status">Escribe al menos dos caracteres para buscar.</p> : null}
    {list.state.status === 'loading' ? <p className={styles.state} role="status">Cargando pacientes…</p> : null}
    {list.state.status === 'error' ? <div className={styles.errorState}><FormAlert tone="error">{list.state.message}</FormAlert><Button variant="secondary" onClick={list.reload}>Reintentar</Button></div> : null}
    {list.state.status === 'ready' ? (
      list.state.patients.length === 0 ? <p className={styles.state} role="status">No hay pacientes para esta búsqueda.</p> : <>
        <DataTable columns={columns} rows={list.state.patients} rowKey={(patient) => patient.id} onRowClick={(patient) => navigate(`/pacientes/${patient.id}`)} />
        <nav className={styles.pagination} aria-label="Paginación de pacientes">
          <span className={styles.resultCount}>Página {list.canGoPrevious ? 'siguiente' : 'inicial'} · hasta 25 resultados</span>
          <div className={styles.pageControls}>
            <Button variant="secondary" disabled={!list.canGoPrevious} onClick={list.previousPage}>Anterior</Button>
            <Button variant="secondary" disabled={!list.state.nextCursor} onClick={list.nextPage}>Siguiente</Button>
          </div>
        </nav>
      </>
    ) : null}
    {creating ? <PatientFormModal onClose={() => setCreating(false)} onSubmit={create} /> : null}
  </div>
}
