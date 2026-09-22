import { Button } from '../../../shared/ui/atoms/Button'
import { Card } from '../../../shared/ui/molecules/Card'
import type { CommunicationDto, CommunicationEventDto } from '../application/communicationsApi'
import { communicationStatusLabel } from '../domain/communications'

interface CommunicationDetailProps {
  detail: CommunicationDto | null
  events: CommunicationEventDto[]
  loading: boolean
  error: string | null
  canLoadMoreEvents: boolean
  loadingMoreEvents: boolean
  onLoadMoreEvents: () => void
}

export function CommunicationDetail({
  detail, events, loading, error, canLoadMoreEvents, loadingMoreEvents, onLoadMoreEvents,
}: CommunicationDetailProps) {
  if (loading) return <Card><p role="status">Cargando detalle de comunicación…</p></Card>
  if (error) return <Card><p role="alert">{error}</p></Card>
  if (!detail) return <Card><p>Elegí una comunicación para ver su detalle y eventos.</p></Card>

  return <Card>
    <h2>Detalle de comunicación</h2>
    <p><strong>Estado:</strong> {communicationStatusLabel(detail.status)}</p>
    <p><strong>Canal:</strong> {detail.channel}</p>
    <p><strong>Vista segura:</strong> {detail.safe_preview}</p>
    <h3>Eventos</h3>
    {events.length === 0 ? <p>No hay eventos en esta página.</p> : (
      <ul>
        {events.map((event) => (
          <li key={event.id}>{event.created_at} · {event.event_type}</li>
        ))}
      </ul>
    )}
    {canLoadMoreEvents ? (
      <Button onClick={onLoadMoreEvents} disabled={loadingMoreEvents}>
        {loadingMoreEvents ? 'Cargando eventos…' : 'Cargar más eventos'}
      </Button>
    ) : null}
  </Card>
}
