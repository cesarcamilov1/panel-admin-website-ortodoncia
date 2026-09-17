import { useState } from 'react'
import { Avatar } from '../../../shared/ui/atoms/Avatar'
import { Button } from '../../../shared/ui/atoms/Button'
import { SelectField } from '../../../shared/ui/atoms/Field'
import { CloseIcon, PlusIcon } from '../../../shared/ui/atoms/icons'
import { Card, CardHeader } from '../../../shared/ui/molecules/Card'
import { FormAlert } from '../../../shared/ui/molecules/FormAlert'
import { Toolbar } from '../../../shared/ui/molecules/Toolbar'
import { ROLE_LABELS, fullName } from '../../auth/domain/auth'
import { useAuth } from '../../auth/application/authContext'
import type { LocationsApi } from '../../locations/application/locationsApi'
import { useLocations } from '../../locations/application/useLocations'
import { useLocationsApi } from '../../locations/application/useLocationsApi'
import { usePanelActions } from '../../panel/application/panelContext'
import type { SchedulesApi } from '../application/schedulesApi'
import { useSchedulesApi } from '../application/useSchedulesApi'
import { useScheduleBlocks } from '../application/useScheduleBlocks'
import { useWorkSchedules } from '../application/useWorkSchedules'
import {
  BLOCK_WINDOW_DAYS,
  type ScheduleBlock,
  type ScheduleBlockDraft,
  blockErrorMessage,
  blockTypeLabel,
  formatBlockRange,
} from '../domain/scheduleBlock'
import {
  WEEKDAYS,
  type Weekday,
  type WorkSchedule,
  type WorkScheduleDraft,
  formatTimeRange,
  groupByWeekday,
  intervalLabel,
  scheduleErrorMessage,
  weekdayLabel,
} from '../domain/workSchedule'
import { ScheduleBlockModal } from './organisms/ScheduleBlockModal'
import { WorkScheduleModal } from './organisms/WorkScheduleModal'
import styles from './SchedulesPage.module.css'

const NO_LOCATION_FILTER = 'Todas las sedes'

type Dialog =
  | { kind: 'closed' }
  | { kind: 'schedule'; weekday: Weekday }
  | { kind: 'block' }

/** Route-level container: resolves the session provider and the role gate. */
export function SchedulesPage() {
  const api = useSchedulesApi()
  const locationsApi = useLocationsApi()
  const { state } = useAuth()

  if (state.status !== 'authenticated') return null

  return (
    <SchedulesScreen
      api={api}
      locationsApi={locationsApi}
      providerUserId={state.user.id}
      providerName={fullName(state.user)}
      roleLabel={ROLE_LABELS[state.user.role]}
      canManageSchedules={state.user.role === 'OWNER_DENTIST'}
      canManageBlocks={state.user.role === 'OWNER_DENTIST' || state.user.role === 'ASSISTANT'}
    />
  )
}

interface SchedulesScreenProps {
  api: SchedulesApi
  locationsApi: LocationsApi
  providerUserId: string
  providerName: string
  roleLabel: string
  canManageSchedules: boolean
  canManageBlocks: boolean
}

export function SchedulesScreen({
  api,
  locationsApi,
  providerUserId,
  providerName,
  roleLabel,
  canManageSchedules,
  canManageBlocks,
}: SchedulesScreenProps) {
  const { notify } = usePanelActions()
  const locationsCatalog = useLocations(locationsApi, providerUserId)
  const [locationId, setLocationId] = useState('')
  const schedules = useWorkSchedules(api, providerUserId, locationId)
  const blocks = useScheduleBlocks(api, providerUserId, locationId)
  const [dialog, setDialog] = useState<Dialog>({ kind: 'closed' })
  const [rowError, setRowError] = useState<string | null>(null)

  const locations = locationsCatalog.state.status === 'ready' ? locationsCatalog.state.locations : []
  const closeDialog = () => setDialog({ kind: 'closed' })

  const week = schedules.state.status === 'ready' ? groupByWeekday(schedules.state.schedules) : null
  const blockList = blocks.state.status === 'ready' ? blocks.state.blocks : []

  const locationOptions = [
    { value: '', label: NO_LOCATION_FILTER },
    ...locations.map((location) => ({ value: location.id, label: location.name })),
  ]

  const handleCreateSchedule = async (draft: WorkScheduleDraft) => {
    await schedules.create(draft)
    closeDialog()
    notify(`Franja de ${weekdayLabel(draft.weekday).toLowerCase()} creada.`)
  }

  const handleRemoveSchedule = async (schedule: WorkSchedule) => {
    setRowError(null)
    try {
      await schedules.remove(schedule)
      notify(`Franja de ${weekdayLabel(schedule.weekday).toLowerCase()} eliminada.`)
    } catch (error) {
      setRowError(scheduleErrorMessage(error))
    }
  }

  const handleCreateBlock = async (draft: ScheduleBlockDraft) => {
    await blocks.create(draft)
    closeDialog()
    notify('Bloqueo creado.')
  }

  const handleRemoveBlock = async (block: ScheduleBlock) => {
    setRowError(null)
    try {
      await blocks.remove(block)
      notify('Bloqueo eliminado.')
    } catch (error) {
      setRowError(blockErrorMessage(error))
    }
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.rail} aria-label="Profesional">
        <Avatar name={providerName} size={40} />
        <p className={styles.providerName}>{providerName}</p>
        <p className={styles.providerRole}>{roleLabel}</p>
        <p className={styles.railNote}>
          El panel administra el horario del profesional con la sesión iniciada: la API no expone un
          directorio de profesionales.
        </p>
      </aside>

      <div className={styles.main}>
        <Toolbar>
          <SelectField
            label="Sede"
            options={locationOptions}
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
          />
        </Toolbar>

        {rowError ? <FormAlert tone="error">{rowError}</FormAlert> : null}

        <Card padded={false}>
          <CardHeader
            title="Horario de trabajo"
            meta="Las franjas se agregan y se quitan; no hay edición: para cambiar un horario, quítalo y crea uno nuevo."
          />

          {!canManageSchedules ? (
            <div className={styles.notice}>
              <FormAlert tone="info">
                Solo el odontólogo titular puede crear o quitar franjas de horario.
              </FormAlert>
            </div>
          ) : null}

          {schedules.state.status === 'loading' ? (
            <p className={styles.state} role="status">
              Cargando el horario…
            </p>
          ) : null}

          {schedules.state.status === 'error' ? (
            <div className={styles.errorState}>
              <FormAlert tone="error">{schedules.state.message}</FormAlert>
              <Button variant="secondary" onClick={() => void schedules.reload()}>
                Reintentar
              </Button>
            </div>
          ) : null}

          {week
            ? WEEKDAYS.map((option) => {
                const ranges = week[option.value]
                return (
                  <div key={option.value} className={styles.day}>
                    <span className={styles.dayName}>{option.label}</span>
                    <div className={styles.ranges}>
                      {ranges.length === 0 ? (
                        <span className={styles.closed}>Sin atención</span>
                      ) : (
                        ranges.map((schedule) => (
                          <span key={schedule.id} className={styles.range}>
                            {formatTimeRange(schedule)}
                            {schedule.intervalWeeks !== 1
                              ? ` · ${intervalLabel(schedule.intervalWeeks)}`
                              : ''}
                            {canManageSchedules ? (
                              <button
                                type="button"
                                className={styles.rangeRemove}
                                aria-label={`Quitar franja de ${option.label.toLowerCase()} ${formatTimeRange(schedule)}`}
                                onClick={() => void handleRemoveSchedule(schedule)}
                              >
                                <CloseIcon size={12} />
                              </button>
                            ) : null}
                          </span>
                        ))
                      )}
                      {canManageSchedules ? (
                        <button
                          type="button"
                          className={styles.addRange}
                          onClick={() => setDialog({ kind: 'schedule', weekday: option.value })}
                        >
                          <PlusIcon size={12} />
                          Franja
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })
            : null}
        </Card>

        <Card padded={false}>
          <CardHeader
            title="Bloqueos"
            meta={`Vacaciones, comidas y ausencias de los próximos ${BLOCK_WINDOW_DAYS} días. Ganan sobre el horario de trabajo.`}
            actions={
              canManageBlocks ? (
                <Button size="sm" onClick={() => setDialog({ kind: 'block' })}>
                  <PlusIcon size={14} />
                  Nuevo bloqueo
                </Button>
              ) : undefined
            }
          />

          {!canManageBlocks ? (
            <div className={styles.notice}>
              <FormAlert tone="info">
                Solo el odontólogo titular y las asistentes pueden crear o quitar bloqueos.
              </FormAlert>
            </div>
          ) : null}

          {blocks.state.status === 'loading' ? (
            <p className={styles.state} role="status">
              Cargando los bloqueos…
            </p>
          ) : null}

          {blocks.state.status === 'error' ? (
            <div className={styles.errorState}>
              <FormAlert tone="error">{blocks.state.message}</FormAlert>
              <Button variant="secondary" onClick={() => void blocks.reload()}>
                Reintentar
              </Button>
            </div>
          ) : null}

          {blocks.state.status === 'ready' && blockList.length === 0 ? (
            <p className={styles.state}>
              No hay bloqueos en los próximos {BLOCK_WINDOW_DAYS} días.
            </p>
          ) : null}

          {blockList.map((block) => (
            <div key={block.id} className={styles.block}>
              <span className={styles.blockText}>
                <strong>{blockTypeLabel(block.blockType)}</strong>
                {block.reason ? <small>{block.reason}</small> : null}
              </span>
              <span className={styles.blockRange}>{formatBlockRange(block)}</span>
              {canManageBlocks ? (
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Quitar bloqueo ${blockTypeLabel(block.blockType)} ${formatBlockRange(block)}`}
                  onClick={() => void handleRemoveBlock(block)}
                >
                  <CloseIcon size={15} />
                </button>
              ) : null}
            </div>
          ))}
        </Card>
      </div>

      {dialog.kind === 'schedule' ? (
        <WorkScheduleModal
          weekday={dialog.weekday}
          locations={locations}
          onClose={closeDialog}
          onSubmit={handleCreateSchedule}
        />
      ) : null}

      {dialog.kind === 'block' ? (
        <ScheduleBlockModal locations={locations} onClose={closeDialog} onSubmit={handleCreateBlock} />
      ) : null}
    </div>
  )
}
