import { Button } from '../../../shared/ui/atoms/Button'
import { Card } from '../../../shared/ui/molecules/Card'
import type { Reminder } from '../domain/reminder'
import { isCancelableReminder, reminderStatusLabel } from '../domain/reminder'

interface ReminderListProps {
  reminders: Reminder[]
  loading: boolean
  loadingMore: boolean
  canLoadMore: boolean
  pendingId: string | null
  selectedId: string | null
  detail: Reminder | null
  detailLoading: boolean
  detailError: string | null
  onLoadMore: () => void
  onSelect: (id: string) => void
  onCancel: (reminder: Reminder) => void
}

export function ReminderList({
  reminders,
  loading,
  loadingMore,
  canLoadMore,
  pendingId,
  selectedId,
  detail,
  detailLoading,
  detailError,
  onLoadMore,
  onSelect,
  onCancel,
}: ReminderListProps) {
  return <Card>
    <h2>Cola de recordatorios</h2>
    {loading ? <p role="status">Cargando recordatorios…</p> : null}
    {!loading && reminders.length === 0 ? <p>No hay recordatorios en esta página.</p> : null}
    <ul>
      {reminders.map((reminder) => <li key={reminder.id}>
        <Button variant="link" onClick={() => onSelect(reminder.id)}>
          {reminder.scheduledFor} · {reminder.channel} · <strong>{reminderStatusLabel(reminder.status)}</strong>
        </Button>
        {isCancelableReminder(reminder)
          ? <Button variant="link" onClick={() => onCancel(reminder)} disabled={pendingId === reminder.id}>Cancelar</Button>
          : null}
      </li>)}
    </ul>
    {canLoadMore ? <Button onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? 'Cargando…' : 'Cargar más recordatorios'}</Button> : null}
    {selectedId ? <section aria-live="polite">
      <h3>Detalle del recordatorio</h3>
      {detailLoading ? <p role="status">Cargando detalle…</p> : null}
      {detailError ? <p role="alert">{detailError}</p> : null}
      {detail ? <dl>
        <dt>Estado</dt><dd>{reminderStatusLabel(detail.status)}</dd>
        <dt>Intentos</dt><dd>{detail.attemptCount}</dd>
        <dt>Próximo intento</dt><dd>{detail.nextAttemptAt || 'No informado'}</dd>
        <dt>Comunicación</dt><dd>{detail.communicationId || 'Aún no creada'}</dd>
      </dl> : null}
    </section> : null}
  </Card>
}
