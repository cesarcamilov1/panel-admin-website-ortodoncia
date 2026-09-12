import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../../../shared/ui/atoms/Avatar'
import { Badge } from '../../../shared/ui/atoms/Badge'
import { Button } from '../../../shared/ui/atoms/Button'
import { PlusIcon, SearchIcon } from '../../../shared/ui/atoms/icons'
import { DataTable, Stacked, type Column } from '../../../shared/ui/molecules/DataTable'
import { Toolbar } from '../../../shared/ui/molecules/Toolbar'
import { PATIENTS, PATIENT_FILTERS, type PatientSummary } from '../domain/data'
import styles from './PatientsPage.module.css'

const columns: Column<PatientSummary>[] = [
  {
    key: 'patient',
    label: 'Paciente',
    grow: 2,
    render: (patient) => (
      <span className={styles.patient}>
        <Avatar name={patient.name} />
        <Stacked top={patient.name} bottom={patient.meta} />
      </span>
    ),
  },
  { key: 'phone', label: 'Contacto', width: '130px', render: (patient) => patient.phone },
  { key: 'last', label: 'Última visita', width: '112px', render: (patient) => patient.lastVisit },
  { key: 'next', label: 'Próxima cita', width: '128px', render: (patient) => patient.nextVisit },
  {
    key: 'balance',
    label: 'Saldo',
    width: '100px',
    align: 'right',
    render: (patient) => (
      <strong className={patient.overdue ? styles.overdue : styles.settled}>{patient.balance}</strong>
    ),
  },
  {
    key: 'tags',
    label: 'Estado',
    width: '172px',
    render: (patient) => (
      <span className={styles.tags}>
        {patient.tags.map((tag) => (
          <Badge key={tag.label} tone={tag.tone}>
            {tag.label}
          </Badge>
        ))}
      </span>
    ),
  },
]

export function PatientsPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState(PATIENT_FILTERS[0])

  return (
    <div className={styles.page}>
      <Toolbar filters={PATIENT_FILTERS} selectedFilter={filter} onFilterChange={setFilter}>
        <Button>
          <PlusIcon />
          Nuevo paciente
        </Button>
      </Toolbar>

      <div className={styles.search}>
        <SearchIcon className={styles.searchIcon} />
        <input
          className={styles.searchInput}
          placeholder="Nombre, expediente, teléfono o RFC"
          aria-label="Buscar pacientes"
        />
      </div>

      <DataTable
        columns={columns}
        rows={PATIENTS}
        rowKey={(patient) => patient.record}
        onRowClick={(patient) => navigate(`/pacientes/${patient.record}`)}
        footer="1 – 8 de 1,284 pacientes"
      />
    </div>
  )
}
